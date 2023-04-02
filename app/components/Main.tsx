'use client';
//import threejs
import { useEffect } from 'react';
import * as THREE from 'three';
import { useState, useRef } from 'react'
import circle_shader from './shaders/circle_a.frag';
import logo_shader from './shaders/logo.frag';
import default_vertex_shader from './shaders/default.vert';
import lattice_shader from './shaders/lattice.frag';
import post_effect_shader from './shaders/post_effect.frag';
import copy_shader from './shaders/copy.frag';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';

import { SampleLipidScene } from './Fingers'

// console.log(EffectComposer)
//lerp between two values
function lerp(a, b, t) {
	return a + (b - a) * t;
}


function nearestPowerOf2(value) {
	return Math.pow(2, Math.round(Math.log(value) / Math.log(2)));
}

function createScene(canvas_el) {
	console.log('create scene')


	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(75, canvas_el.clientWidth / canvas_el.clientHeight, 0.1, 1000);

	const width = canvas_el.clientWidth //nearestPowerOf2(window.innerWidth);
	const height = canvas_el.clientHeight //nearestPowerOf2(window.innerHeight);

	camera.position.set(0, 0, 2);

	const renderer = new THREE.WebGLRenderer({
		canvas: canvas_el,
		width: width,
		height: height,
		antialias: false
	});

	renderer.setSize(canvas_el.clientWidth, canvas_el.clientHeight);

	const geometry = new THREE.PlaneGeometry(2, 2, 1);

	const time_uniform = { value: 0 }
	const alpha_uniform = { value: 0 }
	const u_resolution = { value: new THREE.Vector2(canvas_el.clientWidth, canvas_el.clientHeight) }

	// Create the shader material
	const circle_a_material = new THREE.ShaderMaterial({
		transparent: true,
		uniforms: {
			resolution: u_resolution,
			time: time_uniform,
			alpha: alpha_uniform
		},
		vertexShader: default_vertex_shader,
		fragmentShader: circle_shader,
	});

	const logo_material = new THREE.ShaderMaterial({
		transparent: true,
		uniforms: {
			resolution: u_resolution,
			time: time_uniform,
			alpha: alpha_uniform,
		},
		vertexShader: default_vertex_shader,
		fragmentShader: logo_shader,
	});

	const lattice_material = new THREE.ShaderMaterial({
		transparent: true,
		uniforms: {
			resolution: u_resolution,
			time: time_uniform,
			alpha: alpha_uniform,
		},
		vertexShader: default_vertex_shader,
		fragmentShader: lattice_shader,
	});

	//add post processing effect here
	const composer = new EffectComposer(renderer);
	const composer2 = new EffectComposer(renderer, composer.renderTarget2);
	const composer3 = new EffectComposer(renderer, composer.renderTarget2);

	let copy_pass = new ShaderPass({
		uniforms: {
			tDiffuse: { value: null },
		},
		vertexShader: default_vertex_shader,
		fragmentShader: copy_shader
	})

	const effectPass = new ShaderPass({
		uniforms: {
			tDiffuse: { value: null },
			bufferTexture: { type: 't', value: null },
		},
		vertexShader: default_vertex_shader,
		fragmentShader: post_effect_shader
	});




	composer.addPass(new RenderPass(scene, camera));
	composer.addPass(effectPass);
	composer.renderToScreen = false;

	composer2.addPass(copy_pass);
	composer2.renderToScreen = false;

	composer3.addPass(copy_pass);
	composer3.renderToScreen = true;

	effectPass.uniforms.bufferTexture.value = composer2.renderTarget2.texture



	// Create the plane mesh
	const plane = new THREE.Mesh(geometry, circle_a_material);
	const logo_plane = new THREE.Mesh(geometry, logo_material);
	const lattice_plane = new THREE.Mesh(geometry, lattice_material);

	scene.add(plane);
	scene.add(logo_plane);
	scene.add(lattice_plane);

	camera.lookAt(plane.position);

	let is_stopped = false

	function animate(time) {
		if (is_stopped) {
			console.log('stop animate')
			return
		}
		requestAnimationFrame(animate);
		time_uniform.value = time / 1000;
		alpha_uniform.value = lerp(alpha_uniform.value, 1.0, 0.01);

		composer.render();
		composer2.render();
		composer3.render();

	}

	animate(0);

	function stop() {
		is_stopped = true
	}

	return [stop]

}



let t1 = undefined
let t2 = undefined
function useScene(ref) {
	useEffect(() => {
		if (ref.current) {
			var debug_scene = new SampleLipidScene(ref.current);

		}
		return () => {
			console.log('unmount')
			debug_scene.destroy()
		}

	}, [ref]);
}


export default function Main() {
	const ref = useRef(null);
	const scene = useScene(ref);


	return <div className='w-full h-[100vh]'>
		<canvas className='w-full h-full' ref={ref} />
	</div>
}