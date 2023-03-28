import Head from 'next/head';
import { useEffect } from 'react';
import Main from './Main';
import './style.css'

export default function Home() {

	return (
		<div>
			<Head>
				<title>playdao.ai</title>
				<link rel="icon" href="/favicon.ico" />
			</Head>
			<Main />
		</div>
	)
}
