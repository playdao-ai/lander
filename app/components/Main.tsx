'use client';
//import threejs
import { useEffect } from 'react';
import * as THREE from 'three';
import { useState, useRef } from 'react'
// import circle_shader from './shaders/circle_a.frag';
// import logo_shader from './shaders/logo.frag';
// import default_vertex_shader from './shaders/default.vert';
// import lattice_shader from './shaders/lattice.frag';
// import post_effect_shader from './shaders/post_effect.frag';
// import copy_shader from './shaders/copy.frag';

// import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
// import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
// import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
// import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';

import { SampleLipidScene } from './Fingers'
import Readme from '../../README.md'

// console.log(EffectComposer)
//lerp between two values
function lerp(a, b, t) {
	return a + (b - a) * t;
}


function nearestPowerOf2(value) {
	return Math.pow(2, Math.round(Math.log(value) / Math.log(2)));
}


let t1 = undefined
let t2 = undefined
function useScene(ref, { top = true }) {
	useEffect(() => {
		if (ref.current) {
			var debug_scene = new SampleLipidScene(ref.current, { top: top });

		}
		return () => {
			console.log('unmount')
			debug_scene.destroy()
		}

	}, [ref]);
}



export default function Main() {
	const ref = useRef(null);
	const ref2 = useRef(null);
	const scene = useScene(ref, { top: true });
	const scene2 = useScene(ref2, { top: false });

	return <div className='w-full h-[200vh] relative'>

		<div className='w-full h-[900px]'>
			<canvas className='w-full h-full' ref={ref} />
		</div>
		<div className='w-full flex flex-down justify-center px-4 z-20 relative min-h-screen top-[-500px] text-white'>
			<div className='w-[600px] max-w-full'>
				<div className='flex w-full items-center content-center justify-center'>
					<img src='./logo-name.svg ' className='w-[300px]'></img>
				</div>
				<div className='content text-yellow-100'><Readme /></div>

			</div>

		</div>

		<div className='w-full h-[400px] relative top-[-300px]'>
			<div className='flex flex-down w-full items-center content-center justify-center'>
				<a href='https://www.notion.so/another-draft-a0b2e273c0e0487891d3ff178cb0ba29?pvs=4'><div className='bg-yellow-100 cursor-pointer rounded-full px-8 p-3 text-black w-auto font-uppercase'>read full whitepaper</div></a>
			</div>
			<canvas className='w-full h-full' ref={ref2} />
		</div>
		{/* <canvas className='w-full h-[500px] absolute bottom-0' ref={ref2} /> */}
	</div>
}