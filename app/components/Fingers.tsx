'use client';

import * as THREE from 'three';
import { CCDIKSolver } from 'three/addons/animation/CCDIKSolver.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SubsurfaceScatteringShader } from 'three/addons/shaders/SubsurfaceScatteringShader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import Stats from 'three/addons/libs/stats.module.js';
import { DragControls } from 'three/addons/controls/DragControls.js';

import Matter from 'matter-js';


THREE.Vector2.prototype.angleTo = function (v2) {
	let angle = Math.atan2(v2.y - this.y, v2.x - this.x);
	return angle;
}


Math.lerp = function (start, end, t) {
	return (1 - t) * start + t * end;
}

Math.step = function (x, y) {
	return x < y ? 0 : 1;
}
// this class represents each individual lipid
// a lipid has 2 neighbor lipids, a left and a right
// a lipid has a width and a height
// a lipid has a mouth and a tongue
// a lipid has 2 eyes
// depending on the width of the lipid, the eyes and mouth will change shape
// lipids are all about the same height but have different widths
// lipids animate in waves and have varying widths
// when the width of the lipid reaches a certain threshold the lipid will split into 2 lipids after a certain amount of time or it will emit a token and shrink back in width to reach equillibrium
// lipids will also merge into 1 lipid if the width is too small




let i_ray = new THREE.Ray()
let i_plane = new THREE.Plane()
function findIntersection(v1, n_1, v2, n_2) {
	i_ray.origin.copy(v2)
	i_ray.direction.copy(n_2);
	i_plane.setFromCoplanarPoints(v1, v1.clone().add(n_1), v1.clone().set(v1.x, v2.y, 2.0))
	// console.log(v2_ray.intersectPlane(v1_plane, new THREE.Vector3()))
	return i_ray.intersectPlane(i_plane, new THREE.Vector3());
}



function findExternalTangents(cv_1, cr_1, cv_2, cr_2) {
	const dx = cv_2.x - cv_1.x;
	const dy = cv_2.y - cv_1.y;
	const dist = Math.sqrt(dx * dx + dy * dy);

	const a = Math.atan2(dy, dx);

	const r1 = cr_1;
	const r2 = cr_2;

	const angle1 = Math.acos((r1 - r2) / dist) || 0;

	let t1_a = new THREE.Vector3(cv_1.x + r1 * Math.cos(a + angle1), cv_1.y + r1 * Math.sin(a + angle1), 0)
	let t1_b = new THREE.Vector3(cv_2.x + r2 * Math.cos(a + angle1), cv_2.y + r2 * Math.sin(a + angle1), 0)


	return [t1_a, t1_b]

}

//project ray 

// function findIntersection(A, vectorA, B, vectorB) {
// 	const rayA = new THREE.Ray(A, vectorA);
// 	const rayB = new THREE.Ray(B, vectorB);

// 	const planeNormal = vectorA.clone().cross(vectorB).normalize();
// 	if (planeNormal.lengthSq() === 0) {
// 		console.log("The vectors are parallel and do not intersect.");
// 		return null;
// 	}

// 	const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, A);
// 	const intersectionPoint = new THREE.Vector3();
// 	rayB.intersectPlane(plane, intersectionPoint);

// 	if (rayA.distanceToPoint(intersectionPoint) === 0) {
// 		console.log("Intersection point:", intersectionPoint);
// 		return intersectionPoint;
// 	} else {
// 		console.log("The lines do not intersect.");
// 		return null;
// 	}
// }


function isPointInTriangle(p1, p2, p3, p) {
	function sign(a, b, c) {
		return (a.x - c.x) * (b.y - c.y) - (b.x - c.x) * (a.y - c.y);
	}

	const b1 = sign(p, p1, p2) < 0;
	const b2 = sign(p, p2, p3) < 0;
	const b3 = sign(p, p3, p1) < 0;

	return (b1 === b2) && (b2 === b3);
}


function findScaledNormal(point_a, point_b) {
	// Calculate the connecting vector AB
	const AB = new THREE.Vector2().subVectors(point_b, point_a);

	// Find the normal vector by swapping x and y components and negating one of them
	const normal = new THREE.Vector2(-AB.y, AB.x);

	// Normalize the normal vector and scale it by the given factor
	const scaledNormal = normal.normalize();

	return new THREE.Vector3(scaledNormal.x, scaledNormal.y, 0);
}

// a cell is a 2d circle of any diameter with waves of arbitrary size on the surface
// each cell has some amount of lipids depending on how big the cell is and what the viewport is
// each cell also has a viewport
// there can be an arbirary number of lipids
// the lipids will be placed along normals of the outer surface of the cell mesh.


export class Cell {
	public root: THREE.Object3D;
	private settings: any;
	private camera: THREE.Camera;
	private renderer: THREE.Renderer;

	private pill_height_buffer: Float32Array;
	private joints_buffer: Float32Array;
	private joints_line: THREE.Line;
	private joint_handles: THREE.Mesh[] = [];
	private pills: THREE.Mesh[] = [];
	private world: Matter.World;
	private engine: Matter.Engine;
	private scene: THREE.Scene;



	constructor(settings, camera, renderer, world, engine, scene) {
		this.root = new THREE.Object3D()
		this.scene = scene
		this.settings = settings
		this.camera = camera
		this.renderer = renderer
		this.world = world
		this.engine = engine

		this.buildJoints()
		this.buildPills()
		// this.buildFrames()
		this.buildDragControls()
		this.animate()
	}

	buildDragControls() {
		let joint_drag_controls = new DragControls(this.joint_handles, this.camera, this.renderer.domElement);
		joint_drag_controls.addEventListener('drag', function (event) {
			event.object.position.z = 0
			let joint_index = event.object._index
			this.joints_buffer[joint_index * 3 + 0] = event.object.position.x
			this.joints_buffer[joint_index * 3 + 1] = event.object.position.y
			this.joints_buffer[joint_index * 3 + 2] = event.object.position.z

		}.bind(this))

		let height_drag_controls = new DragControls(this.pills.map((pill) => {
			return pill.helper.height_handle
		}), this.camera, this.renderer.domElement);

		height_drag_controls.addEventListener('drag', function (event) {

			let pill = event.object.pill
			let { v0, v1, v2, v3, normal, prev_normal, next_normal, left_normal, right_normal, midpoint, left_intersection_point, right_intersection_point, max_height } = this.getPillVertices(pill)
			let pos = event.object.position


			let new_height = Math.min(pos.distanceTo(midpoint), max_height)


			this.pill_height_buffer[pill._index] = new_height

			// console.log(new_height, normal)
			pill.helper.height_handle.position.copy(midpoint).add(normal.clone().multiplyScalar(new_height))


		}.bind(this))
	}


	createJointHelperHandle(joint_index) {
		let handle = new THREE.Mesh(new THREE.SphereGeometry(0.15, 4, 4), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
		handle._index = joint_index
		this.joint_handles.push(handle)
		this.root.add(handle)
		handle.position.set(this.joints_buffer[joint_index * 3 + 0], this.joints_buffer[joint_index * 3 + 1], this.joints_buffer[joint_index * 3 + 2])
	}





	buildJoints() {
		this.joints_buffer = new Float32Array(this.settings.joint_count * 3); // 3 vertices per point
		this.pill_height_buffer = new Float32Array(this.settings.joint_count - 1); // 3 vertices per point

		for (let i = 0; i < this.settings.joint_count; i++) {
			this.joints_buffer[i * 3 + 0] = -this.settings.joint_count + i * 2
			this.joints_buffer[i * 3 + 1] = Math.sin(i * 2) * 2
			this.createJointHelperHandle(i)
		}

		for (let i = 0; i < this.settings.joint_count - 1; i++) {
			this.pill_height_buffer[i] = 0.5 + Math.sin(i * 2) * .5
		}

		this.buildJointHelpers()
	}

	buildJointHelpers() {
		const joints_geometry = new THREE.BufferGeometry();
		const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
		joints_geometry.setAttribute('position', new THREE.BufferAttribute(this.joints_buffer, 3));
		const line = new THREE.Line(joints_geometry, material);
		this.root.add(line);
		line.geometry.attributes.position.needsUpdate = true;
		this.joints_line = line
	}



	animate() {
		this.joints_line.geometry.attributes.position.needsUpdate = true;
		this.updatePills()
	}

	updatePills() {
		this.pills.forEach(pill => { this.updatePill(pill) })
	}


	updatePill(pill) {
		this.updatePillHelper(pill)
		this.updatePillConstraints(pill)
	}

	updatePillConstraints(pill) {
		let { v0, v1, v2, v3, midpoint, base_radius, normal, tip_position, max_height_point } = this.getPillVertices(pill)


		pill.base_target_point.copy(midpoint)

		let basepoint = new THREE.Vector3(pill.matter_base.position.x, pill.matter_base.position.y, 0)
		let tippoint = new THREE.Vector3(pill.matter_tip.position.x, pill.matter_tip.position.y, 0)

		pill.base_radius = Math.lerp(pill.base_radius, base_radius, 0.1)
		pill.tip_radius = Math.lerp(pill.tip_radius, base_radius / 2, 0.1)

		pill.matter_base.circleRadius = pill.base_radius
		pill.matter_tip.circleRadius = 0.00

		pill.cylinder.position.copy(basepoint).add(normal.clone().multiplyScalar(pill.base_radius))

		pill.tip_target_point.copy(midpoint).add(normal.clone().multiplyScalar(this.pill_height_buffer[pill._index]))


		let vc = pill.cylinder.geometry.attributes.position.array.length / 3
		let sides = pill.sides

		let [p1, p2] = findExternalTangents(tippoint, pill.tip_radius, basepoint, pill.base_radius)


		let basepoint_normal = new THREE.Vector3().subVectors(tippoint, basepoint).normalize()

		const plane2 = new THREE.Plane().setFromNormalAndCoplanarPoint(basepoint_normal, basepoint);

		const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(findScaledNormal(basepoint, basepoint.clone().add(basepoint_normal)), basepoint);
		// Calculate the distance from the plane to point B
		const r = plane.distanceToPoint(p1);
		let r2 = plane2.distanceToPoint(p1);


		const r3 = plane.distanceToPoint(p2);
		let r4 = plane2.distanceToPoint(p2);


		for (let i = 0; i < vc / 2; i++) {
			pill.cylinder.geometry.attributes.position.array[i * 3 + 0] = Math.cos((Math.PI * 2 / sides) * i) * r
			pill.cylinder.geometry.attributes.position.array[i * 3 + 2] = Math.sin((Math.PI * 2 / sides) * i) * r
			pill.cylinder.geometry.attributes.position.array[i * 3 + 1] = r2
		}


		for (let i = vc / 2; i < vc; i++) {
			pill.cylinder.geometry.attributes.position.array[i * 3 + 0] = Math.cos((Math.PI * 2 / sides) * i) * r3
			pill.cylinder.geometry.attributes.position.array[i * 3 + 2] = Math.sin((Math.PI * 2 / sides) * i) * r3
			pill.cylinder.geometry.attributes.position.array[i * 3 + 1] = r4
		}

		let rot_y = Math.atan2(basepoint_normal.x, basepoint_normal.y)

		pill.cylinder.geometry.attributes.position.needsUpdate = true
		pill.cylinder.position.set(0, 0, 0)
		pill.cylinder.position.z = 0

		pill.cylinder.rotation.z = -rot_y
		pill.cylinder.position.copy(basepoint)


		//tip_tangent_offset


		// pill.tip.position.copy(pill.matter_base.position).add(normal.multiplyScalar(tip_tangent_offset))
		pill.tip.position.z = 0
		pill.tip.rotation.y = rot_y
		pill.tip.position.set(tippoint.x, tippoint.y, 0)
		pill.tip.scale.x = pill.tip_radius
		pill.tip.scale.y = pill.tip_radius
		pill.tip.scale.z = pill.tip_radius

		pill.base.position.z = 0
		pill.base.rotation.y = rot_y
		pill.base.position.set(basepoint.x, basepoint.y, 0)
		pill.base.scale.x = pill.base_radius
		pill.base.scale.y = pill.base_radius
		pill.base.scale.z = pill.base_radius


		pill.cylinder.scale.x = 1
		pill.cylinder.scale.y = 1
		pill.cylinder.scale.z = 1



		// pill.matter_constraint_2.length = pill.base_radius + pill.tip_radius

	}


	updatePillHelper(pill) {
		let { v0, v1, v2, v3, normal, base_radius, tip_position, prev_normal, next_normal, left_normal, right_normal, midpoint, max_height_point, max_height, left_intersection_point, right_intersection_point } = this.getPillVertices(pill)

		let v1_line_v2 = v1.clone().add(left_normal.clone().multiplyScalar(10))
		let v2_line_v2 = v2.clone().add(right_normal.clone().multiplyScalar(4))

		pill.helper.v1_normal_buffer.set([v1.x, v1.y, v1.z, v1_line_v2.x, v1_line_v2.y, v1_line_v2.z])
		pill.helper.v2_normal_buffer.set([v2.x, v2.y, v2.z, v2_line_v2.x, v2_line_v2.y, v2_line_v2.z])
		pill.helper.mid_normal_buffer.set([midpoint.x, midpoint.y, midpoint.z, max_height_point.x, max_height_point.y, max_height_point.z])







		pill.helper.v1_mixed_normal_line.geometry.attributes.position.needsUpdate = true
		pill.helper.v2_mixed_normal_line.geometry.attributes.position.needsUpdate = true
		pill.helper.mid_normal_line.geometry.attributes.position.needsUpdate = true

		let max_point = midpoint.clone().add(normal)
		let diameter = v1.distanceTo(v2)
		let r = diameter


		pill.helper.bottom_circle.position.x = pill.matter_base.position.x
		pill.helper.bottom_circle.position.y = pill.matter_base.position.y



		pill.helper.bottom_circle.scale.set(pill.base_radius * 2, pill.base_radius * 2, 1)
		pill.helper.top_circle.scale.set(pill.tip_radius * 2, pill.tip_radius * 2, 1)

		pill.helper.top_circle.position.x = pill.matter_tip.position.x
		pill.helper.top_circle.position.y = pill.matter_tip.position.y

		pill.helper.top_circle.position.copy(tip_position)



		pill.helper.height_handle.position.copy(tip_position)

		pill.top_position = pill.helper.height_handle.position

		let [p1, p2] = findExternalTangents(midpoint, base_radius, tip_position, pill.tip_radius)



		pill.helper.tangent_buffer.set([p1.x, p1.y, 0, p2.x, p2.y, 0])
		pill.helper.tangent_line.geometry.attributes.position.needsUpdate = true


	}


	buildPillHelper(pill) {

		let v1_normal_buffer = new Float32Array(3 * 2)
		let v2_normal_buffer = new Float32Array(3 * 2)
		let mid_normal_buffer = new Float32Array(3 * 2)
		let tangent_buffer = new Float32Array(3 * 2)

		let mid_normal_geometry = new THREE.BufferGeometry();
		mid_normal_geometry.setAttribute('position', new THREE.BufferAttribute(mid_normal_buffer, 3));

		let v1_normal_geometry = new THREE.BufferGeometry();
		v1_normal_geometry.setAttribute('position', new THREE.BufferAttribute(v1_normal_buffer, 3));

		let v2_normal_geometry = new THREE.BufferGeometry();
		v2_normal_geometry.setAttribute('position', new THREE.BufferAttribute(v2_normal_buffer, 3));

		let tangent_geometry = new THREE.BufferGeometry();
		tangent_geometry.setAttribute('position', new THREE.BufferAttribute(tangent_buffer, 3));


		let mid_normal_line = new THREE.LineSegments(mid_normal_geometry);
		let tangent_line = new THREE.LineSegments(tangent_geometry);
		let v1_mixed_normal_line = new THREE.LineSegments(v1_normal_geometry);
		let v2_mixed_normal_line = new THREE.LineSegments(v2_normal_geometry);


		tangent_line.material.depthTest = false;
		tangent_line.material.opacity = 0.25;
		tangent_line.material.transparent = true;
		tangent_line.material.color = new THREE.Color(0xff8c00);

		v1_mixed_normal_line.material.depthTest = false;
		v1_mixed_normal_line.material.opacity = 0.25;
		v1_mixed_normal_line.material.transparent = true;
		v1_mixed_normal_line.material.color = new THREE.Color(0xff8c00);

		v2_mixed_normal_line.material.depthTest = false;
		v2_mixed_normal_line.material.opacity = 0.25;
		v2_mixed_normal_line.material.transparent = true;
		v2_mixed_normal_line.material.color = new THREE.Color(0xff4400);

		mid_normal_line.material.depthTest = false;
		mid_normal_line.material.opacity = 0.25;
		mid_normal_line.material.transparent = true;
		mid_normal_line.material.color = new THREE.Color(0xffa200);


		// console.log(v1_mixed_normal_line.geometry.attributes)

		let top_circle_geom = new THREE.CircleGeometry(0.5, 32)
		let bottom_circle_geom = new THREE.CircleGeometry(0.5, 32)
		let top_circle_wire = new THREE.WireframeGeometry(top_circle_geom)
		let bottom_circle_wire = new THREE.WireframeGeometry(bottom_circle_geom)

		let top_circle = new THREE.LineSegments(top_circle_wire);
		top_circle.material.depthTest = false;
		top_circle.material.opacity = 0.1;
		top_circle.material.transparent = true;
		top_circle.material.color = new THREE.Color(0xb3fffe);

		let bottom_circle = new THREE.LineSegments(bottom_circle_wire);
		bottom_circle.material.depthTest = false;
		bottom_circle.material.opacity = 0.1;
		bottom_circle.material.transparent = true;
		bottom_circle.material.color = new THREE.Color(0xffffff)



		let helper = new THREE.Group()


		helper.add(mid_normal_line).add(v1_mixed_normal_line).add(v2_mixed_normal_line).add(top_circle).add(bottom_circle)
		helper.mid_normal_line = mid_normal_line

		helper.add(tangent_line)
		helper.tangent_line = tangent_line

		helper.v1_mixed_normal_line = v1_mixed_normal_line
		helper.v2_mixed_normal_line = v2_mixed_normal_line

		helper.v1_normal_buffer = v1_normal_buffer
		helper.v2_normal_buffer = v2_normal_buffer

		helper.mid_normal_buffer = mid_normal_buffer

		helper.bottom_circle = bottom_circle
		helper.top_circle = top_circle

		helper.tangent_buffer = tangent_buffer

		// helper.left_intersection = left_intersection
		// helper.right_intersection = right_intersection
		// helper.add(left_intersection).add(right_intersection)



		// build height handle
		let height_handle = new THREE.Mesh(new THREE.CircleGeometry(0.15, 5), new THREE.MeshBasicMaterial({ color: 0xff5e00 }));
		height_handle.pill = pill
		helper.add(height_handle)
		helper.height_handle = height_handle

		return helper
	}



	buildPill(joint_index_a, joint_index_b, prev_pill) {

		let pill = new THREE.Group()
		pill.v1_index = joint_index_a
		pill.v2_index = joint_index_b
		pill._index = joint_index_a
		pill._prev = prev_pill
		if (prev_pill) prev_pill._next = pill
		let pill_helper = this.buildPillHelper(pill)
		this.root.add(pill_helper)
		pill.helper = pill_helper
		pill.height = Math.abs(Math.sin(joint_index_a * 2) * 2)
		this.root.add(pill)
		this.pills.push(pill)


		let { midpoint, max_height_point } = this.getPillVertices(pill)


		pill.base_target_point = midpoint.clone()

		pill.tip_target_point = max_height_point.clone()

		pill.matter_base = Matter.Bodies.circle(midpoint.x, midpoint.y, 1, {
			airFriction: 0.01,
			collisionFilter: {
				category: 0x0002,
				mask: 0x0001
			}
			// slop: 0.1,
		});

		pill.matter_tip = Matter.Bodies.circle(midpoint.x, midpoint.y, 0.1, {
			airFriction: 0.01,
			// slop: 0.1,
		});

		pill.matter_constraint = Matter.Constraint.create({
			pointA: pill.base_target_point,
			bodyB: pill.matter_base,
			length: 0,
			stiffness: 0.001,
			damping: 0.01
		});

		pill.matter_constraint_2 = Matter.Constraint.create({
			bodyA: pill.matter_base,
			bodyB: pill.matter_tip,
			stiffness: 0.00004,
			damping: 0.001
		});

		pill.matter_constraint_tip = Matter.Constraint.create({
			pointA: pill.tip_target_point,
			bodyB: pill.matter_tip,
			length: 0,
			stiffness: 0.001,
			damping: 0.001
		});


		pill.matter_tip.collisionFilter.group = 0;
		pill.matter_base.collisionFilter.group = 0;

		pill.matter_tip.collisionFilter.category = 0x0003;

		pill.matter_base.collisionFilter.category = 0x0001;
		pill.matter_tip.collisionFilter.category = 0x0002;

		// const material = new THREE.ShaderMaterial({

		// 	uniforms: {

		// 		time: { value: 1.0 },
		// 		resolution: { value: new THREE.Vector2() }

		// 	},

		// 	vertexShader: document.getElementById('vertexShader').textContent,

		// 	fragmentShader: document.getElementById('fragmentShader').textContent

		// });

		let sides = 16
		pill.sides = sides


		// const finger_material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
		const finger_material = new THREE.MeshStandardMaterial({ color: 0xffff00 });
		finger_material.wireframe = true;
		finger_material.transparency = true;
		finger_material.opacity = 0.5;
		finger_material.isVisible = false

		const tip_geometry = new THREE.SphereGeometry(1, 12, 12, 0, Math.PI, 0, Math.PI);
		const finger_geometry = new THREE.CylinderGeometry(1, 1, 1, sides, 1, true, 0, Math.PI * 2);
		const base_geometry = new THREE.SphereGeometry(1, 24, 24, 0, Math.PI * 2, 0, Math.PI * 2);

		pill.cylinder = new THREE.Mesh(finger_geometry, finger_material);
		pill.tip = new THREE.Mesh(tip_geometry, finger_material);
		pill.base = new THREE.Mesh(base_geometry, finger_material);

		pill.tip.rotation.x = pill.base.rotation.x = -Math.PI / 2

		this.root.add(pill.cylinder);
		this.root.add(pill.tip)
		this.root.add(pill.base)
		// console.log(pill.cylinder);

		pill.base_radius = 0
		pill.tip_radius = 0



		Matter.Composite.add(this.world, [pill.matter_base, pill.matter_tip, pill.matter_constraint, pill.matter_constraint_tip, pill.matter_constraint_2]);

		return pill
	}

	buildPills() {
		let pill = undefined
		for (let i = 1; i < this.settings.joint_count; i++) {
			pill = this.buildPill(i - 1, i, pill)
		}
	}


	//create line extending out into the shared normal
	//shared normal line is 1 unit long
	//find midpoint of line
	//find point on normal line that intersects with midpoint normal line
	//calculate position and radius of pill tip
	//pill tip is a circle, circle max radius is same as base radius
	//pill tip circle radius is 1 - distance from midpoint base circle tip to intersection point
	//pill top position is max


	getPillVertices(pill) {

		let joint_index_a = pill.v1_index
		let joint_index_b = pill.v2_index



		let v1 = new THREE.Vector3(this.joints_buffer[joint_index_a * 3 + 0], this.joints_buffer[joint_index_a * 3 + 1], this.joints_buffer[joint_index_a * 3 + 2])
		let v0 = joint_index_a > 0 ? new THREE.Vector3(this.joints_buffer[(joint_index_a - 1) * 3 + 0], this.joints_buffer[(joint_index_a - 1) * 3 + 1], this.joints_buffer[(joint_index_a - 1) * 3 + 2]) : v1
		let v2 = new THREE.Vector3(this.joints_buffer[joint_index_b * 3 + 0], this.joints_buffer[joint_index_b * 3 + 1], this.joints_buffer[joint_index_b * 3 + 2])
		let v3 = joint_index_b < this.settings.joint_count - 1 ? new THREE.Vector3(this.joints_buffer[(joint_index_b + 1) * 3 + 0], this.joints_buffer[(joint_index_b + 1) * 3 + 1], this.joints_buffer[(joint_index_b + 1) * 3 + 2]) : v2
		let normal = findScaledNormal(v1, v2)
		let prev_normal = findScaledNormal(v0, v1)
		let next_normal = findScaledNormal(v2, v3)
		let left_normal = new THREE.Vector3().lerpVectors(prev_normal, normal, 0.5).normalize()
		let right_normal = new THREE.Vector3().lerpVectors(normal, next_normal, 0.5).normalize()
		let midpoint = new THREE.Vector3().addVectors(v1, v2).divideScalar(2)
		let base_radius = v1.distanceTo(v2) / 2


		let max_height = 10 //this.pill_height_buffer[pill._index]

		var max_height_point = new THREE.Vector3()

		pill.left_normal = left_normal
		pill.right_normal = right_normal

		if (pill._prev) {

			let prev_intersection_point = findIntersection(v0, pill._prev.left_normal, midpoint, normal);
			if (prev_intersection_point) {
				max_height = Math.min(max_height, midpoint.distanceTo(prev_intersection_point))
			}
		}

		if (pill._next && pill._next.right_normal) {

			let next_intersection_point = findIntersection(v3, pill._next.right_normal, midpoint, normal);
			if (next_intersection_point) {
				max_height = Math.min(max_height, midpoint.distanceTo(next_intersection_point))
			}
		}

		// let prev_intersection_point = findIntersection(v0, prev_normal, midpoint, normal);
		let left_intersection_point = findIntersection(v1, left_normal, midpoint, normal);
		let right_intersection_point = findIntersection(v2, right_normal, midpoint, normal);

		if (left_intersection_point) {
			max_height = Math.min(max_height, midpoint.distanceTo(left_intersection_point))
		}

		if (right_intersection_point) {
			max_height = Math.min(max_height, midpoint.distanceTo(right_intersection_point))
		}



		max_height_point.copy(midpoint).addScaledVector(normal, max_height)

		let height = Math.min(max_height, this.pill_height_buffer[pill._index])
		let tip_position = midpoint.clone().addScaledVector(normal, height)

		return { v0, v1, v2, v3, normal, base_radius, prev_normal, next_normal, left_normal, right_normal, midpoint, max_height_point, max_height, height, tip_position, left_intersection_point, right_intersection_point }
	}

}


export class SampleLipidScene {
	public mouse: THREE.Vector2;
	private canvas_el: HTMLCanvasElement;
	private renderer: THREE.WebGLRenderer;
	private scene: THREE.Scene;
	private camera: THREE.PerspectiveCamera;
	private width: number;
	private height: number;
	private stop: boolean = false;
	private controls: THREE.OrbitControls;
	public settings: any;
	private cell: Cell;
	private gui: GUI;
	private runner: Matter.Runner;
	private engine: Matter.Engine;
	private world: Matter.World;

	constructor(canvas_el) {
		console.log('constructing scene')
		this.canvas_el = canvas_el;
		this.width = canvas_el.clientWidth;
		this.height = canvas_el.clientHeight;
		let settings = {
			camera_rotation: false,
			joint_count: 3,
		}
		this.settings = settings
		let gui = new GUI();
		this.gui = gui
		gui.add(settings, 'camera_rotation')
			.name('camera rotation')
			.onChange(value => {
				this.controls.enableRotate = value;
				if (value == false) {

					this.camera.position.set(0, 0, 10)
					// this.camera.rotation.set(0, 0, 0)
					this.camera.lookAt(0, 0, 0);
				}
			});

		gui.add(settings, 'joint_count')
			.name('joint count')
			.onChange(value => {

			});


		this.renderer = new THREE.WebGLRenderer({
			canvas: canvas_el,
			width: this.width,
			height: this.height,
			antialias: false
		});

		let stats = new Stats();
		document.body.appendChild(stats.dom);


		this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 1000);
		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		// console.log(this.controls)

		//move camera back
		this.camera.position.z = 10;
		this.camera.lookAt(0, 0, 0)
		this.scene = new THREE.Scene();

		const grid = new THREE.GridHelper(20, 20);
		grid.rotation.x = Math.PI / 2;
		grid.material.opacity = 0.15
		grid.material.transparent = true
		grid.material.depthWrite = false
		grid.material.depthTest = false
		grid.material.color = new THREE.Color(0x404040)
		this.scene.add(grid);

		const axesHelper = new THREE.AxesHelper(5);
		axesHelper.position.y = 0
		this.scene.add(axesHelper);

		const light = new THREE.AmbientLight(0x404040); // soft white light
		this.scene.add(light);
		this.controls.enableRotate = settings.camera_rotation

		let engine = Matter.Engine.create()
		let world = engine.world

		this.runner = Matter.Runner.create();
		this.world = world
		this.engine = engine
		this.engine.gravity.scale = 0

		window.addEventListener('resize', this.resize.bind(this));

		this.cell = new Cell(this.settings, this.camera, this.renderer, this.world, this.engine, this.scene)
		this.scene.add(this.cell.root)

		this.animate(0)
		this.resize()
	}



	resize() {
		this.width = this.canvas_el.clientWidth;
		this.height = this.canvas_el.clientHeight;
		this.renderer.setSize(this.width, this.height);
	}

	animate(t) {
		if (this.stop) {
			return;
		}

		this.controls.update();
		this.renderer.render(this.scene, this.camera);
		this.camera.updateProjectionMatrix()
		this.cell.animate();

		requestAnimationFrame(this.animate.bind(this));
		// this.cell.animate() 
		Matter.Runner.tick(this.runner, this.engine, t)
	}

	destroy() {
		console.log('destroying scene')
		// this.canvas_el.remove();
		Matter.Runner.stop(this.runner);
		this.stop = true;
		this.gui.destroy();
	}
}
