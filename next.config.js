/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	swcMinify: true,
	webpack: (config) => {
		config.module.rules.push({
			test: /\.(frag|vert)$/,
			type: 'asset/source'
		})
		return config
	},
	plugins: [
		require('tailwindcss'),
		require('autoprefixer'),
	],
}

module.exports = nextConfig