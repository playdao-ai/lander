'use client';

import * as THREE from 'three';
import { CCDIKSolver } from 'three/addons/animation/CCDIKSolver.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SubsurfaceScatteringShader } from 'three/addons/shaders/SubsurfaceScatteringShader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import Stats from 'three/addons/libs/stats.module.js';
import { DragControls } from 'three/addons/controls/DragControls.js';
import { LightProbeGenerator } from 'three/addons/lights/LightProbeGenerator.js';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';

import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

import Matter from 'matter-js';
import MatterAttractors from 'matter-attractors'
Matter.use(MatterAttractors)

import default_vertex_shader from './shaders/default.vert';
import eye_frag_shader from './shaders/eye.frag';
import mouth_frag_shader from './shaders/mouth.frag';
import water_frag_shader from './shaders/water.frag';
import tree_vert_shader from './shaders/tree.vert';
import tree_frag_shader from './shaders/tree.frag';
import plugin from 'tailwindcss';

const V = Matter.Vector;


THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

THREE.Vector2.prototype.angleTo = function (v2) {
	let angle = Math.atan2(v2.y - this.y, v2.x - this.x);
	return angle;
}

const CENTER = new THREE.Vector3(0, 0, 0)

Math.lerp = function (start, end, t) {
	return (1 - t) * start + t * end;
}

Math.smoothstep = function (x, min, max) {
	if (x <= min) return 0;
	if (x >= max) return 1;
	x = (x - min) / (max - min);
	return x * x * (3 - 2 * x);
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
let plane_rot = new THREE.Euler(0, 0, Math.PI / 2, 'XYZ');
function findIntersection(v1, n_1, v2, n_2) {
	i_ray.origin.copy(v2)
	i_ray.direction.copy(n_2);
	// i_plane.setFromCoplanarPoints(v1, v1.clone().add(n_1), v1.clone().set(v1.x, v2.y, 2.0))
	i_plane.setFromNormalAndCoplanarPoint(n_1.clone().applyEuler(plane_rot), v1)
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


	return [t1_a, t1_b, angle1]

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
	private gui: GUI;
	private camera: THREE.Camera;
	private renderer: THREE.Renderer;

	private pill_height_buffer: Float32Array;
	private joints_buffer: Float32Array;
	private joints_line: THREE.Line;
	private joint_handles: THREE.Mesh[] = [];
	private pills: THREE.Mesh[] = [];
	private world: Matter.World;
	private blob_world: Matter.World;
	private engine: Matter.Engine;
	private scene: THREE.Scene;
	private finger_material: any;
	private cell_uniforms: any;
	private raycaster: THREE.Raycaster = new THREE.Raycaster();
	private joints: any[] = [];
	private joint_constraints: any[] = [];
	private drag_start: THREE.Vector3 = new THREE.Vector3();
	private drag_current: THREE.Vector3 = new THREE.Vector3();
	private drag_index: number = -1;
	private blob_parts: any[] = [];
	private blob: THREE.Mesh;
	private runner: Matter.Runner;
	private blob_engine: Matter.Engine;
	private mouse_down: boolean = false;
	private screen_mouse: THREE.Vector2 = new THREE.Vector2();
	private world_mouse: THREE.Vector3 = new THREE.Vector3(0, 0, 0);


	constructor(settings, gui, camera, renderer, scene, cell_uniforms) {
		this.root = new THREE.Object3D()
		this.scene = scene
		this.cell_uniforms = cell_uniforms
		this.gui = gui
		this.settings = settings
		this.camera = camera
		this.renderer = renderer

		this.raycaster.firstHitOnly = true

		this.runner = Matter.Runner.create();

		let engine = Matter.Engine.create()
		let world = engine.world

		let blob_engine = Matter.Engine.create()
		this.blob_world = blob_engine.world


		this.world = world
		this.blob_engine = blob_engine


		this.engine = engine
		this.engine.gravity.scale = 0

		this.engine = engine
		this.blob_world.gravity.scale = 0


		this.buildJoints()
		this.buildPills()
		this.buildBlob()
		// this.buildFrames()
		this.buildDragControls()
		this.initJointPositions()
	}

	screenToWorld(screen_vec: THREE.Vector2, world_vec: THREE.Vector3 = new THREE.Vector3()) {
		world_vec.copy(screen_vec)
		world_vec.x = (world_vec.x / window.innerWidth) * 2 - 1;
		world_vec.y = -(world_vec.y / window.innerHeight) * 2 + 1;
		world_vec.z = 0.5
		world_vec.unproject(this.camera)

		return world_vec
	}

	buildDragControls() {


		window.addEventListener('mousedown', () => {
			this.mouse_down = true
		});

		window.addEventListener('mouseup', () => {
			this.mouse_down = false
		})

		window.addEventListener('mousemove', (e) => {
			this.screen_mouse.set(e.screenX, e.screenY)
			this.screenToWorld(this.screen_mouse, this.world_mouse)
		})


		let joint_drag_controls = new DragControls(this.joint_handles, this.camera, this.renderer.domElement);
		joint_drag_controls.addEventListener('drag', function (event) {
			event.object.position.z = 0
			this.drag_current.x = event.object.position.x
			this.drag_current.y = event.object.position.y
		}.bind(this))


		joint_drag_controls.addEventListener('dragstart', function (event) {
			event.object.position.z = 0
			let joint_index = event.object._index
			this.drag_index = joint_index
			this.drag_start.x = event.object.position.x
			this.drag_start.y = event.object.position.y
			this.drag_current.x = event.object.position.x
			this.drag_current.y = event.object.position.y
		}.bind(this))


		joint_drag_controls.addEventListener('dragend', function (event) {
			this.drag_index = -1
		}.bind(this))


		// let height_drag_controls = new DragControls(this.pills.map((pill) => {
		// 	return pill.helper.height_handle
		// }), this.camera, this.renderer.domElement);


		// height_drag_controls.addEventListener('drag', function (event) {

		// 	let pill = event.object.pill
		// 	let { v0, v1, v2, v3, normal, prev_normal, next_normal, left_normal, right_normal, midpoint, left_intersection_point, right_intersection_point, max_height } = this.getPillVertices(pill)
		// 	let pos = event.object.position

		// 	let new_height = Math.min(pos.distanceTo(midpoint), max_height)

		// 	this.pill_height_buffer[pill._index] = new_height

		// 	pill.helper.height_handle.position.copy(midpoint).add(normal.clone().multiplyScalar(new_height))

		// }.bind(this))
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
			this.joints[i] = Matter.Bodies.circle(this.joints_buffer[i * 3 + 0], this.joints_buffer[i * 3 + 1], 2)

			// this.createJointHelperHandle(i)
		}




		// let left_point = new THREE.Vector3(-30, 0, 0)
		// this.joint_constraints.push(Matter.Constraint.create({
		// 	pointA: left_point,
		// 	bodyB: this.joints[0],
		// 	length: 0,
		// 	stiffness: 0.04,
		// 	damping: 0.01
		// }))


		// let right_point = new THREE.Vector3(30, 0, 0)
		// this.joint_constraints.push(Matter.Constraint.create({
		// 	pointA: right_point,
		// 	bodyB: this.joints[this.joints.length - 1],
		// 	length: 0,
		// 	stiffness: 0.04,
		// 	damping: 0.01
		// }))



		for (let i = 0; i < this.settings.joint_count - 1; i++) {
			this.pill_height_buffer[i] = 1 + Math.sin(i * 2) * .5

			// this.joint_constraints.push(Matter.Constraint.create({
			// 	bodyA: this.joints[i],
			// 	bodyB: this.joints[i + 1],
			// 	length: Math.random() * 4,
			// 	stiffness: 0.01,
			// }))
		}

		// Matter.Composite.add(this.world, this.joint_constraints)

		// this.buildJointHelpers()
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

	animate(t) {
		this.time = t
		Matter.Runner.tick(this.runner, this.engine, t);
		Matter.Runner.tick(this.runner, this.blob_engine, t);
		this.joints_line ? this.joints_line.geometry.attributes.position.needsUpdate = true : null
		this.updateJoints()
		this.updatePills()
		this.updateBlob()
		this.projectJointsOnBlob()
		this.updateDrag()
	}

	destroy() {
		Matter.Runner.stop(this.runner);
	}

	updateDrag() {
		if (this.drag_index >= 0) {
			this.joints[this.drag_index].position.x = this.drag_current.x
			this.joints[this.drag_index].position.y = this.drag_current.y
		}
	}

	updateJoints() {
		for (let i = 0; i < this.settings.joint_count; i++) {
			this.joints_buffer[i * 3 + 0] = this.joints[i].position.x
			this.joints_buffer[i * 3 + 1] = this.joints[i].position.y
			// this.joint_handles[i].position.copy(this.joints[i].position)
			// this.joint_handles[i].position.z = 0

			// this.joints[i].position.y += 0.02 * Math.sin(Matter.Common.now() * 0.0003 + this.joints[i].position.x * 0.2)

		}
	}

	updatePills() {
		this.pills.forEach(pill => { this.updatePill(pill) })
	}


	updatePill(pill) {
		this.updatePillConstraints(pill)
		this.updatePillFace(pill)
		this.updatePillLight(pill)
	}

	updatePillConstraints(pill) {
		let { v0, v1, v2, v3, midpoint, base_radius, tip_radius, normal, tip_position, max_height_point } = this.getPillVertices(pill)


		pill.base_target_point.copy(midpoint)

		let basepoint = new THREE.Vector3(pill.matter_base.position.x, pill.matter_base.position.y, 0)
		let tippoint = new THREE.Vector3(pill.matter_tip.position.x, pill.matter_tip.position.y, 0)
		// tippoint = tip_position



		pill.base_radius = Math.lerp(pill.base_radius, base_radius, 0.1)
		pill.tip_radius = Math.lerp(pill.tip_radius, tip_radius, 0.1)

		pill.matter_base.circleRadius = pill.base_radius
		pill.matter_tip.circleRadius = 0.00

		pill.cylinder.position.copy(basepoint).add(normal.clone().multiplyScalar(pill.base_radius))

		pill.tip_target_point.copy(tip_position)//.add(normal.clone().multiplyScalar(this.pill_height_buffer[pill._index]))



		let vc = pill.cylinder.geometry.attributes.position.array.length / 3
		let sides = pill.sides

		let [p1, p2, angle] = findExternalTangents(tippoint, pill.tip_radius, basepoint, pill.base_radius)




		// let tangent_angle = p2.angleTo(p1)
		pill.tangent_angle = angle

		let basepoint_normal = new THREE.Vector3().subVectors(tippoint, basepoint).normalize()

		const plane2 = new THREE.Plane().setFromNormalAndCoplanarPoint(basepoint_normal, basepoint);
		const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(findScaledNormal(basepoint, basepoint.clone().add(basepoint_normal)), basepoint);

		// Calculate the distance from the plane to point B
		const r = plane.distanceToPoint(p1);
		let r2 = plane2.distanceToPoint(p1);
		const r3 = plane.distanceToPoint(p2);
		let r4 = plane2.distanceToPoint(p2);


		for (let i = 0; i < vc / 2; i++) {
			pill.cylinder.geometry.attributes.position.array[i * 3 + 0] = Math.cos((Math.PI * 2 / sides) * i) * r3
			pill.cylinder.geometry.attributes.position.array[i * 3 + 2] = Math.sin((Math.PI * 2 / sides) * i) * r3
			pill.cylinder.geometry.attributes.position.array[i * 3 + 1] = r4
		}

		for (let i = vc / 2; i < vc; i++) {
			pill.cylinder.geometry.attributes.position.array[i * 3 + 0] = Math.cos((Math.PI * 2 / sides) * i) * r
			pill.cylinder.geometry.attributes.position.array[i * 3 + 2] = Math.sin((Math.PI * 2 / sides) * i) * r
			pill.cylinder.geometry.attributes.position.array[i * 3 + 1] = r2
		}


		pill.cylinder.geometry.computeVertexNormals();

		let rot_y = Math.atan2(basepoint_normal.x, basepoint_normal.y)

		pill.cylinder.geometry.attributes.position.needsUpdate = true
		pill.cylinder.position.set(0, 0, 0)
		pill.cylinder.position.z = 0

		pill.cylinder.rotation.z = -rot_y
		pill.cylinder.position.copy(basepoint)

		//tip_tangent_offset
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

		// let max_point = midpoint.clone().add(normal)
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



		let [p1, p2, tan_angle] = findExternalTangents(midpoint, base_radius, tip_position, pill.tip_radius)

		// let tangent_angle = p2.angleTo(p1)
		pill.tangent_angle = tan_angle
		// console.log(tanget_angle)

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


		// build height handle
		let height_handle = new THREE.Mesh(new THREE.CircleGeometry(0.15, 5), new THREE.MeshBasicMaterial({ color: 0xff5e00 }));
		height_handle.material.depthTest = false;
		height_handle.material.depthWrite = false;
		// height_handle.renderOrder = 999
		// height_handle.onBeforeRender = function (renderer) { renderer.clearDepth(); };

		height_handle.pill = pill
		helper.add(height_handle)
		helper.height_handle = height_handle

		return helper
	}



	buildPill(joint_index_a, joint_index_b, prev_pill) {


		let pill = new THREE.Group()

		// pill.pill_light_enabled = joint_index_a % 2 == 0
		pill.pill_light_enabled = true

		pill.v1_index = joint_index_a
		pill.v2_index = joint_index_b
		pill._index = joint_index_a
		pill._prev = prev_pill
		if (prev_pill) prev_pill._next = pill
		// let pill_helper = this.buildPillHelper(pill)
		// this.root.add(pill_helper)
		// pill.helper = pill_helper
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

		pill.matter_tip_light = Matter.Bodies.circle(midpoint.x, midpoint.y, 0.2, {
			airFriction: 0.01,
		});


		pill.matter_constraint = Matter.Constraint.create({
			pointA: pill.base_target_point,
			bodyB: pill.matter_base,
			length: 0,
			stiffness: 0.02,
			damping: 0.01
		});

		pill.matter_constraint_2 = Matter.Constraint.create({
			bodyA: pill.matter_base,
			bodyB: pill.matter_tip,
			stiffness: 0.02,
			damping: 0.05
		});

		pill.matter_constraint_tip = Matter.Constraint.create({
			pointA: pill.tip_target_point,
			bodyB: pill.matter_tip,
			length: 0,
			stiffness: 0.03,
			damping: 0.05
		});

		pill.matter_constraint_light = Matter.Constraint.create({
			pointA: pill.matter_base.position,
			bodyB: pill.matter_tip_light,
			length: 0,
			stiffness: 0.1,
			damping: 0.4
		});


		pill.matter_tip_light.collisionFilter.group = -1;
		pill.matter_tip.collisionFilter.group = -1;
		pill.matter_base.collisionFilter.group = -1;


		let sides = 24
		pill.sides = sides


		const finger_material = this.buildFingerMaterial()
		pill.finger_material = finger_material

		finger_material.opacity = 0.3;


		const tip_geometry = new THREE.SphereGeometry(1, pill.sides, pill.sides, 0, Math.PI * 2, 0, Math.PI * 2);
		const finger_geometry = new THREE.CylinderGeometry(1, 1, 1, sides, 1, true, 0, Math.PI * 2);
		const base_geometry = new THREE.SphereGeometry(1, pill.sides, pill.sides, 0, Math.PI * 2, 0, Math.PI * 2);

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

		pill.cylinder.renderOrder = 10
		pill.tip.renderOrder = 10
		pill.base.renderOrder = 10


		Matter.Composite.add(this.world, [
			pill.matter_base,
			pill.matter_tip,
			pill.matter_constraint,
			pill.matter_constraint_tip,
			pill.matter_constraint_2,
			pill.matter_tip_light,
			pill.matter_constraint_light
		]);

		//build pill light
		if (pill.pill_light_enabled) {
			let pill_light = new THREE.PointLight((new THREE.Color()).setHSL(Math.random(), 0.5, 0.5), 0.3, 2)
			pill_light.position.set(0, 0, 0)
			this.root.add(pill_light)
			pill.light = pill_light
		}

		pill.frustumCulled = false

		return pill
	}

	updatePillLight(pill) {
		if (!pill.pill_light_enabled) return

		// let tip_normal = new THREE.Vector3().set(pill.matter_tip.position.x, pill.matter_tip.position.y, 0).sub(new THREE.Vector3().set(pill.matter_base.position.x, pill.matter_base.position.y, 0)).normalize()

		pill.light.position.set(pill.matter_tip_light.position.x, pill.matter_tip_light.position.y, 0)

		// pill.light_mesh.position.copy(new THREE.Vector3(pill.matter_tip.position.x, pill.matter_tip.position.y, 0)).lerp(new THREE.Vector3().set(pill.matter_base.position.x, pill.matter_base.position.y, 0), -2Z)

	}


	buildBlobMaterial() {
		if (this.blob_material) return this.blob_material

		const loader = new THREE.TextureLoader();
		const imgTexture = loader.load('moss.png');
		const thicknessTexture = loader.load('test2.png');
		imgTexture.wrapS = imgTexture.wrapT = THREE.RepeatWrapping;

		const shader = SubsurfaceScatteringShader;
		const uniforms = THREE.UniformsUtils.clone(shader.uniforms);


		uniforms['map'].value = imgTexture;

		uniforms['diffuse'].value = new THREE.Vector3(0.0, 0.2, .3);
		uniforms['shininess'].value = 10;

		uniforms['thicknessMap'].value = thicknessTexture;
		uniforms['thicknessColor'].value = new THREE.Vector3(0.0, 0.3, .6);
		uniforms['thicknessDistortion'].value = 0.71;
		uniforms['thicknessAmbient'].value = 1.75;
		uniforms['thicknessAttenuation'].value = 0.65;
		uniforms['thicknessPower'].value = 1.8;
		uniforms['thicknessScale'].value = 11.3;

		const material = new THREE.ShaderMaterial({
			uniforms: uniforms,
			vertexShader: shader.vertexShader,
			fragmentShader: shader.fragmentShader,
			lights: true
		});
		material.extensions.derivatives = true;
		this.blob_material = material


		this.settings.thicknessAmbient = 0.4



		const ThicknessControls = function () {

			this.distortion = uniforms['thicknessDistortion'].value;
			this.ambient = uniforms['thicknessAmbient'].value;
			this.attenuation = uniforms['thicknessAttenuation'].value;
			this.power = uniforms['thicknessPower'].value;
			this.scale = uniforms['thicknessScale'].value;

		};

		const thicknessControls = new ThicknessControls();




		return material
	}


	buildFingerMaterial() {
		if (this.finger_material) return this.finger_material

		const loader = new THREE.TextureLoader();
		const imgTexture = loader.load('moss.png');
		const thicknessTexture = loader.load('test2.png');
		imgTexture.wrapS = imgTexture.wrapT = THREE.RepeatWrapping;

		const shader = SubsurfaceScatteringShader;
		const uniforms = THREE.UniformsUtils.clone(shader.uniforms);


		uniforms['map'].value = imgTexture;

		uniforms['diffuse'].value = new THREE.Vector3(.7, 0.8, 1.0);
		uniforms['shininess'].value = 10;

		uniforms['thicknessMap'].value = thicknessTexture;
		uniforms['thicknessColor'].value = new THREE.Vector3(0.5, 0.5, 0.8);
		uniforms['thicknessDistortion'].value = 0.71;
		uniforms['thicknessAmbient'].value = 1.75;
		uniforms['thicknessAttenuation'].value = 0.65;
		uniforms['thicknessPower'].value = 1.8;
		uniforms['thicknessScale'].value = 11.3;

		const material = new THREE.ShaderMaterial({
			uniforms: uniforms,
			vertexShader: shader.vertexShader,
			fragmentShader: shader.fragmentShader,
			lights: true
		});
		material.extensions.derivatives = true;
		this.finger_material = material


		this.settings.thicknessAmbient = 0.4



		const ThicknessControls = function () {

			this.distortion = uniforms['thicknessDistortion'].value;
			this.ambient = uniforms['thicknessAmbient'].value;
			this.attenuation = uniforms['thicknessAttenuation'].value;
			this.power = uniforms['thicknessPower'].value;
			this.scale = uniforms['thicknessScale'].value;

		};

		const thicknessControls = new ThicknessControls();

		let gui = this.gui

		// gui.add(thicknessControls, 'distortion').min(0.01).max(1).step(0.01).onChange(function () {

		// 	uniforms['thicknessDistortion'].value = thicknessControls.distortion;
		// 	console.log('distortion');

		// });

		// gui.add(thicknessControls, 'ambient').min(0.01).max(5.0).step(0.05).onChange(function () {

		// 	uniforms['thicknessAmbient'].value = thicknessControls.ambient;

		// });

		// gui.add(thicknessControls, 'attenuation').min(0.01).max(5.0).step(0.05).onChange(function () {

		// 	uniforms['thicknessAttenuation'].value = thicknessControls.attenuation;

		// });

		// gui.add(thicknessControls, 'power').min(0.01).max(16.0).step(0.1).onChange(function () {

		// 	uniforms['thicknessPower'].value = thicknessControls.power;

		// });

		// gui.add(thicknessControls, 'scale').min(0.01).max(50.0).step(0.1).onChange(function () {

		// 	uniforms['thicknessScale'].value = thicknessControls.scale;

		// });

		return material
	}


	buildPillFace(pill) {
		let { midpoint, max_height_point } = this.getPillVertices(pill)
		let seed = Math.random() * 10.0

		let eye_material = new THREE.ShaderMaterial({
			uniforms: {
				time: this.cell_uniforms.time,
				seed: { value: seed }
			},
			vertexShader: default_vertex_shader,
			fragmentShader: eye_frag_shader,
			transparent: true
		})

		let mouth_material = new THREE.ShaderMaterial({
			uniforms: {
				time: this.cell_uniforms.time,
				seed: { value: Math.random() }
			},
			vertexShader: default_vertex_shader,
			fragmentShader: mouth_frag_shader,
			transparent: true
		})



		let eye_material2 = new THREE.ShaderMaterial({
			uniforms: {
				time: this.cell_uniforms.time,
				seed: { value: seed + 0.1 }
			},
			vertexShader: default_vertex_shader,
			fragmentShader: eye_frag_shader,
			transparent: true
		})





		// eye_material.depthWrite = false
		// eye_material.depthTest = false

		// mouth_material.depthWrite = false
		// mouth_material.depthTest = false

		let left_eye_geom = new THREE.PlaneGeometry(1, 1, 1, 1)
		let right_eye_geom = new THREE.PlaneGeometry(1, 1, 1, 1)
		let mouth_geom = new THREE.PlaneGeometry(1, 1, 1, 1)

		let left_eye = new THREE.Mesh(left_eye_geom, eye_material)
		let right_eye = new THREE.Mesh(right_eye_geom, eye_material2)
		let mouth = new THREE.Mesh(mouth_geom, mouth_material)

		left_eye.position.x = -0.75
		right_eye.position.x = 0.75
		mouth.position.y = -1


		let face = new THREE.Group()
		let face_inner = new THREE.Group()
		face_inner.add(left_eye)
		face_inner.add(right_eye)
		face_inner.add(mouth)

		face.add(face_inner)

		face.renderOrder = 99

		this.root.add(face)

		pill.face = face
		pill.face_inner = face_inner
		pill.left_eye = left_eye
		pill.right_eye = right_eye

	}

	updatePillFace(pill) {
		// let { midpoint, tip_position, tip_radius, base_radius } = this.getPillVertices(pill)

		// console.log('update pill face')

		pill.face.position.copy(pill.matter_tip.position)
		pill.face.position.z = pill.tip_radius + 0.25
		pill.face.scale.set(pill.tip_radius, pill.tip_radius, pill.tip_radius).multiplyScalar(0.5)


		// console.log
		pill.face.rotation.copy(pill.cylinder.rotation)
		// console.log(pill.tanget_angle)
		pill.face_inner.rotation.x = -Math.pow(Math.abs((pill.tip_radius - pill.base_radius)) * .5, 0.8) //pill.tanget_angle
		pill.face_inner.rotation.x = (pill.tangent_angle - Math.PI / 2)

		// pill.left_eye.lookAt(new THREE.Vector3(pill.matter_tip.position.x, pill.matter_tip.position.y, 0))
		pill.left_eye.rotation.y = -0.2
		pill.right_eye.rotation.y = 0.2
		// pill.face.rotation.z = 0

		// pill.tip_position.copy(tip_position).(camera.position,tip_radius)


	}

	buildPills() {
		let pill = undefined


		for (let i = 1; i < this.settings.joint_count; i++) {
			// if (i %  == 0) continue

			pill = this.buildPill(i - 1, i, pill)
			this.buildPillFace(pill)
		}
	}


	buildBlob() {
		const loader = new THREE.TextureLoader();

		let r = '';
		const urls = [
			r + 'px.png', r + 'nx.png',
			r + 'py.png', r + 'ny.png',
			r + 'pz.png', r + 'nz.png'
		];

		let test_mat = new THREE.MeshBasicMaterial({
			color: 0x00ff00, transparent: true,
			opacity: 0.1
		})

		const colors = new Uint8Array(6);

		for (let c = 0; c <= colors.length; c++) {
			colors[c] = (c / colors.length) * 256;
		}

		const format = THREE.RedFormat
		const gradientMap = new THREE.DataTexture(colors, colors.length, 1, format);
		gradientMap.needsUpdate = true;

		// basic monochromatic energy preservation
		const diffuseColor = new THREE.Color().setHSL(0.4, 0.5, 0.5)

		// const toon_material = new THREE.MeshToonMaterial({
		// 	color: diffuseColor,
		// 	aoMapIntensity: 1,
		// 	gradientMap: gradientMap,
		// });

		// toon_material.opacity = 0.5


		const blob_material = this.buildBlobMaterial()
		let resolution = 42
		let blob = new MarchingCubes(resolution, blob_material, true, true, 3000);
		blob.position.set(0, 0, 10);
		blob.scale.set(20, 20, 20);
		blob.enableUvs = false;
		blob.enableColors = false;
		this.blob = blob;
		this.root.add(blob);

		blob.frustumCulled = true


		this.blob_center_part = Matter.Bodies.circle(0, 0, 1.0, {
			collisionFilter: {
				group: -1
			},
			friction: 10.0,
			mass: 4000
			//add attraction to center
		})
		this.blob_center_light = new THREE.PointLight(new THREE.Color(1.0, 0.3, 0.3), 1.0, 20)

		this.root.add(this.blob_center_light)


		Matter.World.add(this.blob_world, this.blob_center_part)





		for (let i = 0; i < this.settings.blob_parts; i++) {
			let blob_part = Matter.Bodies.circle(-1 + Math.random() * 2, -1 + Math.random() * 2, 1.0, {
				collisionFilter: {
					group: -1
				}
				//add attraction to center
			})

			let constraint = Matter.Constraint.create({
				pointA: { x: 0, y: 0 },
				bodyB: blob_part,
				length: 0,
				stiffness: 0.001,
				damping: 0.002
			})




			// blob_part.constraint = constraint
			this.blob_parts.push(blob_part)
			Matter.World.add(this.blob_world, blob_part)
			Matter.Composite.add(this.world, [constraint])
		}


		for (let i = 0; i < this.settings.blob_parts; i++) {
			for (let j = 0; j < this.settings.blob_parts; j++) {
				if (i == j) {
					continue
				}

				let constraint = Matter.Constraint.create({
					bodyA: this.blob_parts[j],
					bodyB: this.blob_parts[i],
					length: 4,
					stiffness: 0.001,
					damping: 0.01
				})

				this.blob_parts[i].constraints = this.blob_parts[i].constraints || []
				this.blob_parts[i].constraints.push(constraint)

				Matter.World.add(this.blob_world, constraint)
			}
		}


		this.updateBlob()
	}

	updateBlob() {
		this.blob.reset()

		// this.mouse_constraint.stiffness = this.world_mouse.length() * 0.0001




		let center_force = V.mult(V.neg(this.blob_center_part.position), 0.006)


		// let mouse_force = V.mult(V.normalise(V.clone(this.world_mouse)), 0.00001)

		let mouse_force = V.mult(V.sub(V.clone(this.world_mouse), this.blob_center_part.position), 0.001)

		// console.log(mouse_force)

		this.blob_center_part.force.x = center_force.x + (mouse_force.x || 0)
		this.blob_center_part.force.y = center_force.y + (mouse_force.y || 0)



		let x = this.blob_center_part.position.x / (20 * 1)
		let y = this.blob_center_part.position.y / (20 * 1)
		this.blob.addBall(.5 + x, .5 + y, 0.1, 0.64, 20.0);




		for (let i = 0; i < this.blob_parts.length; i++) {
			let x = this.blob_parts[i].position.x / (20 * 1)
			let y = this.blob_parts[i].position.y / (20 * 1)
			this.blob.addBall(.5 + x, .5 + y, 0.1, 0.64, 10.0);


			if (this.mouse_down) {
				this.blob.scale.x = this.blob.scale.y = this.blob.scale.z = Math.lerp(this.blob.scale.x, 20, 0.05)
				this.blob.position.z = Math.lerp(this.blob.position.z, 15, 0.1)
				// console.log('test')
				// Matter.Body.applyForce(this.blob_parts[i], this.blob_parts[i].position, force)
				this.blob_parts[i].constraints.forEach((constraint) => { constraint.length = Math.lerp(constraint.length, 6, 0.1) })
			} else {
				this.blob.scale.x = this.blob.scale.y = this.blob.scale.z = Math.lerp(this.blob.scale.x, 10, 0.05)
				this.blob.position.z = Math.lerp(this.blob.position.z, 7.5, 0.1)
				this.blob_parts[i].constraints.forEach((constraint) => { constraint.length = Math.lerp(constraint.length, 3, 0.1) })
			}
		}

		this.blob_center_light.position.x = this.blob_center_part.position.x
		this.blob_center_light.position.y = this.blob_center_part.position.y
		this.blob_center_light.position.z = this.blob.position.z

		this.blob.update();
		this.blob.geometry.computeBoundsTree()
		// console.log(.boundingBox)
		//this.blob.geometry.computeBoundsTree();
	}

	initJointPositions() {
		let c_r = 10

		for (let i = 0; i < this.joints.length; i++) {
			this.joints[i].position.x = Math.cos(-(Math.PI * 2) / this.joints.length * i) * c_r
			this.joints[i].position.y = Math.sin(-(Math.PI * 2) / this.joints.length * i) * c_r
			this.joints_buffer[i * 3 + 0] = this.joints[i].position.x
			this.joints_buffer[i * 3 + 1] = this.joints[i].position.y
			this.joints_buffer[i * 3 + 2] = 0
		}
	}

	projectJointsOnBlob() {

		let c_r = 20
		let origin = new THREE.Vector3()
		// let origin_lerp = new THREE.Vector3()
		let normal = new THREE.Vector3()
		// let raycaster_intersections = [new THREE.Vector3]

		this.step = this.step || 0
		this.step++

		// console.log(Math.floor(step) % this.joints.length)

		let i = this.step
		i = i % this.joints.length


		for (let i = 0; i < this.joints.length; i++) {



			origin.x = Math.cos(-(Math.PI * 2) / this.joints.length * i + 0.01 * i) * c_r
			origin.y = Math.sin(-(Math.PI * 2) / this.joints.length * i + 0.01 * i) * c_r
			origin.z = 0
			normal.copy(origin).lerp(CENTER, 0.1).sub(origin).normalize()
			this.raycaster.set(origin, normal)
			// console.log(normal)
			let raycaster_intersections = this.raycaster.intersectObject(this.blob, false)

			if (raycaster_intersections.length > 0) {

				origin.copy(this.joints[i].position)
				origin.z = 0
				origin.copy(raycaster_intersections[0].point)
				this.joints[i].position.x = origin.x
				this.joints[i].position.y = origin.y
				// this.joints[i].position.z = origin.z

			}
		}

	}



	getPillVertices(pill) {

		let joint_index_a = pill.v1_index
		let joint_index_b = pill.v2_index

		let padding = 0.1

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
		let base_radius = v1.distanceTo(v2) / 2 - padding


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

		let left_plane = (new THREE.Plane()).setFromNormalAndCoplanarPoint(left_normal.clone().applyEuler(plane_rot), v1)
		let right_plane = (new THREE.Plane()).setFromNormalAndCoplanarPoint(right_normal.clone().applyEuler(plane_rot), v2)


		let target_tip_radius = base_radius
		let target_height = this.pill_height_buffer[pill._index]

		if (!this.mouse_down) {
			target_height = 0.1
		}




		let target_tip_point = midpoint.clone().addScaledVector(normal, target_height)

		let tip_radius = Math.min(target_tip_radius, Math.abs(left_plane.distanceToPoint(target_tip_point)) - padding)
		tip_radius = Math.min(tip_radius, Math.abs(right_plane.distanceToPoint(target_tip_point)) - padding)
		tip_radius = Math.max(tip_radius, base_radius / 4)

		base_radius = Math.min(base_radius, Math.abs(right_plane.distanceToPoint(midpoint)) - padding)
		base_radius = Math.min(base_radius, Math.abs(left_plane.distanceToPoint(midpoint)) - padding)

		let mid_line = new THREE.Line3(midpoint.clone().addScaledVector(normal, -999), midpoint.clone().addScaledVector(normal, 999))


		if (left_intersection_point) {
			left_plane.translate(left_normal.clone().applyEuler(plane_rot).multiplyScalar(tip_radius).negate())
			left_plane.intersectLine(mid_line, max_height_point)
			max_height = Math.min(max_height, max_height_point.distanceTo(midpoint))
		}

		if (right_intersection_point) {
			right_plane.translate(right_normal.clone().applyEuler(plane_rot).multiplyScalar(tip_radius))
			right_plane.intersectLine(mid_line, max_height_point)
			max_height = Math.min(max_height, max_height_point.distanceTo(midpoint))
		}

		max_height_point.copy(midpoint).addScaledVector(normal, max_height)

		let height = Math.min(max_height, target_height)
		let tip_position = midpoint.clone().addScaledVector(normal, height)


		// target_height += pill.tip.position.distanceTo(this.world_mouse) * 0.1

		// target_height += Math.smoothstep(tip_position.distanceTo(this.world_mouse), 0, 0.1) * 0.1
		// pill.matter_tip && console.log(pill.matter_tip.position)

		return { v0, v1, v2, v3, normal, base_radius, tip_radius, prev_normal, next_normal, left_normal, right_normal, midpoint, max_height_point, max_height, height, tip_position, left_intersection_point, right_intersection_point }
	}

}


export class SampleLipidScene {
	public mouse: THREE.Vector2;
	private canvas_el: HTMLCanvasElement;
	private renderer: THREE.WebGLRenderer;
	private scene: THREE.Scene;
	private camera: any;
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
	private uniforms: any;

	constructor(canvas_el) {
		console.log('constructing scene')
		this.canvas_el = canvas_el;
		this.width = canvas_el.clientWidth;
		this.height = canvas_el.clientHeight;
		let settings = {
			joint_stiffness: 0.1,
			joint_spacing: 0.1,
			thicknessAmbient: 0.1,
			camera_rotation: false,
			joint_count: 24,
			blob_parts: 3,
		}
		this.settings = settings
		let gui = new GUI();
		this.gui = gui

		gui.add(settings, 'camera_rotation')
			.name('camera rotation')
			.onChange(value => {
				this.controls.enableRotate = value;
				if (value == false) {
					console.log('test')
					this.controls.reset();
					this.camera.position.set(0, 0, 10)
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
		this.camera = new THREE.OrthographicCamera(this.width / -2, this.width / 2, this.height / 2, this.height / -2, 0.1, 1000);
		this.controls = new OrbitControls(this.camera, this.renderer.domElement);

		window.camera = this.camera
		// console.log(this.controls)

		//move camera back
		this.camera.position.z = 20;
		this.camera.zoom = 60
		this.camera.lookAt(0, 0, 0)
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(0xffffff);

		this.controls.enableRotate = false;
		// this.scene.background = new THREE.Color().setHSL(0.6, 0.5, 0.5);

		// const grid = new THREE.GridHelper(20, 20);
		// grid.rotation.x = Math.PI / 2;
		// grid.material.opacity = 0.15
		// grid.material.transparent = true
		// grid.material.depthWrite = false
		// grid.material.depthTest = false
		// grid.material.color = new THREE.Color(0x404040)
		// this.scene.add(grid);

		this.scene = new THREE.Scene();


		this.buildLights()

		// const axesHelper = new THREE.AxesHelper(5);
		// axesHelper.position.y = 0
		// this.scene.add(axesHelper);

		// const light = new THREE.AmbientLight(new THREE.Color(1, 1, 1), 0.1); // soft white light
		// this.scene.add(light);
		// this.controls.enableRotate = settings.camera_rotation


		window.addEventListener('resize', this.resize.bind(this));


		this.uniforms = {
			time: { value: 0 },
		}


		this.cell = new Cell(this.settings, this.gui, this.camera, this.renderer, this.scene, this.uniforms)
		this.scene.add(this.cell.root)

		this.animate(0)
		this.resize()
	}

	buildLights() {
		const pointLight1 = new THREE.Mesh(new THREE.SphereGeometry(0, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));

		pointLight1.add(new THREE.PointLight(new THREE.Color(1, 1, 1), .8, 20));
		this.scene.add(pointLight1);
		pointLight1.position.x = 0;
		pointLight1.position.y = 0;
		pointLight1.position.z = 15;

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
		this.cell.animate(t);

		requestAnimationFrame(this.animate.bind(this));


		this.uniforms.time.value = t / 1000

	}

	destroy() {
		console.log('destroying scene')
		// this.canvas_el.remove();
		this.cell.destroy();
		this.stop = true;
		this.gui.destroy();
	}
}
