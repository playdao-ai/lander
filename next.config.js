/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	swcMinify: true,

	webpack: (config) => {
		config.module.rules.push({
			test: /\.(frag|vert)$/,
			type: 'asset/source'
		}, {
			test: /\.(txt|md)$/,
			loader: '@mdx-js/loader'
		})
		return config
	}
}

module.exports = nextConfig