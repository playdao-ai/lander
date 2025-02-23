'use client';

import { useEffect } from "react";

export function FixTags() {
	useEffect(() => {
		function addTargetBlankToAllLinks() {
			const links = document.getElementsByTagName('a');

			//@ts-ignore
			for (let link of links) {
				link.setAttribute('target', '_blank');
				link.setAttribute('rel', 'noopener noreferrer');
			}
		}
		addTargetBlankToAllLinks()
	})

	return <></>

}