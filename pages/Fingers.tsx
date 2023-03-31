import * as THREE from 'three';
import { CCDIKSolver } from 'three/addons/animation/CCDIKSolver.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SubsurfaceScatteringShader } from 'three/addons/shaders/SubsurfaceScatteringShader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import Stats from 'three/addons/libs/stats.module.js';
import { DragControls } from 'three/addons/controls/DragControls.js';


THREE.Vector2.prototype.angleTo = function (v2) {
	let angle = Math.atan2(v2.y - this.y, v2.x - this.x);
	return angle;
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


class Lipid {
	constructor() {

	}
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
	private bones_buffer: Float32Array;
	private bones_line: THREE.Line;
	private bone_handles: THREE.Mesh[] = [];
	private frames: THREE.Mesh[] = [];

	constructor(settings, camera, renderer) {
		this.root = new THREE.Object3D()
		this.settings = settings
		this.camera = camera
		this.renderer = renderer

		this.buildBones()
		this.buildFrames()
		this.buildDragControls()
		this.animate()
	}

	buildDragControls() {
		let drag_controls = new DragControls(this.bone_handles, this.camera, this.renderer.domElement);
		drag_controls.addEventListener('drag', function (event) {
			let bone_index = event.object._index
			this.bones_buffer[bone_index * 3 + 0] = event.object.position.x
			this.bones_buffer[bone_index * 3 + 1] = event.object.position.y
			this.bones_buffer[bone_index * 3 + 2] = event.object.position.z

		}.bind(this))
	}

	addBoneHandle(bone_index) {
		let handle = new THREE.Mesh(new THREE.SphereGeometry(0.15, 4, 4), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
		handle._index = bone_index
		this.bone_handles.push(handle)
		this.root.add(handle)
		handle.position.set(this.bones_buffer[bone_index * 3 + 0], this.bones_buffer[bone_index * 3 + 1], this.bones_buffer[bone_index * 3 + 2])
	}

	buildBones() {
		this.bones_buffer = new Float32Array(this.settings.bone_count * 3); // 3 vertices per point
		for (let i = 0; i < this.settings.bone_count; i++) {
			this.bones_buffer[i * 3 + 0] = -this.settings.bone_count + i * 2
			this.bones_buffer[i * 3 + 1] = Math.sin(i * 2) * 2
			this.addBoneHandle(i)
		}

		const bones_geometry = new THREE.BufferGeometry();
		const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
		bones_geometry.setAttribute('position', new THREE.BufferAttribute(this.bones_buffer, 3));
		const line = new THREE.Line(bones_geometry, material);
		this.root.add(line);
		console.log(line);
		line.geometry.attributes.position.needsUpdate = true;
		this.bones_line = line
	}


	animate() {
		this.bones_line.geometry.attributes.position.needsUpdate = true;
		this.updateFrames()
		// this.skeleton_helper.updateMatrixWorld()
		// this.ikSolver.update();
		// this.skeleton_helper.bones.forEach((bone, i) => {
		// 	this.bone_handles[i].position.copy(bone.getWorldPosition(new THREE.Vector3()))
		// })
	}

	buildFrame(left_i, right_i) {
		const frame_geom = new THREE.PlaneGeometry();
		let mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
		mat.transparent = true
		mat.opacity = 0.5
		let frame = new THREE.Mesh(frame_geom, mat);


		frame._buffer = frame_geom.attributes.position.array
		frame._left = left_i
		frame._right = right_i
		frame._prev = this.frames.length && this.frames[this.frames.length - 1]
		if (frame._prev) {
			frame._prev._next = frame
		}

		// console.log(frame._buffer)

		this.frames.push(frame)

		this.root.add(frame)
	}

	updateFrames() {
		this.frames.forEach(this.updateFrame.bind(this))
	}





	updateFrame(frame: THREE.Mesh) {

		//bottom left
		let v3 = new THREE.Vector3(this.bones_buffer[frame._left * 3 + 0], this.bones_buffer[frame._left * 3 + 1], this.bones_buffer[frame._left * 3 + 2])

		//bottom left prev
		if (frame._prev) {
			var v3_prev = new THREE.Vector3(this.bones_buffer[(frame._left - 1) * 3 + 0], this.bones_buffer[(frame._left - 1) * 3 + 1], this.bones_buffer[(frame._left - 1) * 3 + 2])
		} else {
			var v3_prev = v3
		}

		//bottom right
		let v4 = new THREE.Vector3(this.bones_buffer[frame._right * 3 + 0], this.bones_buffer[frame._right * 3 + 1], this.bones_buffer[frame._right * 3 + 2])

		// bottom right next
		if (frame._next) {
			var v4_next = new THREE.Vector3(this.bones_buffer[(frame._right + 1) * 3 + 0], this.bones_buffer[(frame._right + 1) * 3 + 1], this.bones_buffer[(frame._right + 1) * 3 + 2])
		} else {
			var v4_next = v4
		}

		//bottom left
		frame._buffer[2 * 3 + 0] = v3.x
		frame._buffer[2 * 3 + 1] = v3.y

		//bottom right
		frame._buffer[3 * 3 + 0] = v4.x
		frame._buffer[3 * 3 + 1] = v4.y

		function isPointInTriangle(p1, p2, p3, p) {
			function sign(a, b, c) {
				return (a.x - c.x) * (b.y - c.y) - (b.x - c.x) * (a.y - c.y);
			}

			const b1 = sign(p, p1, p2) < 0;
			const b2 = sign(p, p2, p3) < 0;
			const b3 = sign(p, p3, p1) < 0;

			return (b1 === b2) && (b2 === b3);
		}


		function findScaledNormal(point_a, point_b, scale) {
			// Calculate the connecting vector AB
			const AB = new THREE.Vector2().subVectors(point_b, point_a);

			// Find the normal vector by swapping x and y components and negating one of them
			const normal = new THREE.Vector2(-AB.y, AB.x);

			// Normalize the normal vector and scale it by the given factor
			const scaledNormal = normal.normalize().multiplyScalar(scale);

			return new THREE.Vector3(scaledNormal.x, scaledNormal.y, 0);
		}


		let v3_v4_normal = findScaledNormal(v3, v4, 1);

		//top left is combine angle of previous frame left and current frame right


		let n_a = findScaledNormal(v3_prev, v3, 1);
		let n_b = v3_v4_normal
		n_a.lerp(n_b, .5)

		let n_f = v3.clone().add(n_a);
		let s_f = v3.clone().add(n_b)

		let v_f = s_f


		if (isPointInTriangle(v3_prev, v3, v4, v3.clone().add(n_a.clone().multiplyScalar(0.01)))) {
			v_f = n_f
		}

		frame._buffer[0 * 3 + 0] = v_f.x
		frame._buffer[0 * 3 + 1] = v_f.y


		//CALCULATE TOP RIGHT VERTEX
		//top right is combined angle of frame right and next frame left


		n_a = v3_v4_normal;
		n_b = findScaledNormal(v4, v4_next, 1);
		n_b.lerp(n_a, .5);


		n_f = v4.clone().add(n_b);
		s_f = v4.clone().add(n_a);

		v_f = s_f


		// if (frame._prev) {
		// 	let n_2 = new THREE.Vector3(frame._buffer[0 * 3 + 0] - frame._buffer[2 * 3 + 0], frame._buffer[0 * 3 + 1] - frame._buffer[2 * 3 + 1], 0).reflect(v3_v4_normal)
		// 	let v_f2 = v4.clone().sub(n_2)
		// 	v_f = v_f2
		// 	frame._buffer[1 * 3 + 0] = v_f.x
		// 	frame._buffer[1 * 3 + 1] = v_f.y
		// }

		//point is inside triangle that is formed by v3, v4, v4_next
		if (isPointInTriangle(v3, v4, v4_next, v4.clone().add(n_b.clone().multiplyScalar(0.01)))) {
			v_f = n_f
			frame._buffer[1 * 3 + 0] = v_f.x
			frame._buffer[1 * 3 + 1] = v_f.y

			if (frame._prev) {
				let n_2 = new THREE.Vector3(frame._buffer[0 * 3 + 0] - frame._buffer[2 * 3 + 0], frame._buffer[0 * 3 + 1] - frame._buffer[2 * 3 + 1], 0).reflect(v3_v4_normal)
				let s_f = v4.clone().sub(n_2)
				frame._buffer[1 * 3 + 0] = s_f.x
				frame._buffer[1 * 3 + 1] = s_f.y

			}


		} else {
			frame._buffer[1 * 3 + 0] = v_f.x
			frame._buffer[1 * 3 + 1] = v_f.y

			if (frame._prev) {
				let n_2 = new THREE.Vector3(frame._buffer[0 * 3 + 0] - frame._buffer[2 * 3 + 0], frame._buffer[0 * 3 + 1] - frame._buffer[2 * 3 + 1], 0).reflect(v3_v4_normal)
				let s_f = v4.clone().sub(n_2)
				frame._buffer[1 * 3 + 0] = s_f.x
				frame._buffer[1 * 3 + 1] = s_f.y

			}
		}

		frame.geometry.attributes.position.needsUpdate = true;
	}

	buildFrames() {
		for (let i = 1; i < this.settings.bone_count; i++) {
			this.buildFrame(i - 1, i)
		}
		this.updateFrames()
	}

	buildCircle(left_i, right_i) {

	}

	buildCircles() {
		for (let i = 1; i < this.settings.bone_count; i++) {
			this.buildCircle(i - 1, i)
		}
		// this.updateFrames()
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

	constructor(canvas_el) {
		console.log('constructing scene')
		this.canvas_el = canvas_el;
		this.width = canvas_el.clientWidth;
		this.height = canvas_el.clientHeight;
		let settings = {
			camera_rotation: false,
			bone_count: 6,
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

		gui.add(settings, 'bone_count')
			.name('bone count')
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
		console.log(this.controls)

		//move camera back
		this.camera.position.z = 10;
		this.camera.lookAt(0, 0, 0)

		this.scene = new THREE.Scene();


		const grid = new THREE.GridHelper(0, 0);
		grid.rotation.x = Math.PI / 2;
		grid.material.opacity = 0.15
		grid.material.transparent = true
		this.scene.add(grid);
		const axesHelper = new THREE.AxesHelper(5);
		axesHelper.position.y = -6
		this.scene.add(axesHelper);

		// const geometry = new THREE.PlaneGeometry(1, 1);
		// const wireframe = new THREE.WireframeGeometry(geometry);
		// const material = new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide });
		// const plane = new THREE.Mesh(geometry, material);
		// plane.rotation.set(Math.PI / 2, 0, 0);
		// this.scene.add(plane);

		// const line = new THREE.LineSegments(wireframe);
		// line.material.depthTest = false;
		// line.material.opacity = 0.25;
		// line.material.transparent = true;
		// this.scene.add(line);

		const light = new THREE.AmbientLight(0x404040); // soft white light
		this.scene.add(light);

		this.controls.enableRotate = settings.camera_rotation




		window.addEventListener('resize', this.resize.bind(this));


		this.cell = new Cell(this.settings, this.camera, this.renderer)
		this.scene.add(this.cell.root)

		this.animate()
		this.resize()
	}



	resize() {
		this.width = this.canvas_el.clientWidth;
		this.height = this.canvas_el.clientHeight;
		this.renderer.setSize(this.width, this.height);
	}

	animate() {
		if (this.stop) {
			return;
		}

		this.controls.update();
		this.renderer.render(this.scene, this.camera);
		this.cell.animate();
		requestAnimationFrame(this.animate.bind(this));
		// this.cell.animate()
	}

	destroy() {
		console.log('destroying scene')
		// this.canvas_el.remove();
		this.stop = true;
		this.gui.destroy();
	}
}
