varying vec2 vUv;
uniform float time;
uniform float seed;

void main() {
	// Normalize the pixel coordinates to [-1, 1]
	vec2 st  = vec2(vUv.x,vUv.y)-vec2(0.5);

	st.y *= 1.0 + 20.*pow((0.5+sin(time*5.+seed)*0.5),60.);
	// Calculate the distance from the center of the screen
	float d = length(st);
	float dx = abs(st.x);
	float dy = 1.0-abs(st.y);

	// Create a circle with radius 0.5
	float r = 0.25;
	float thickness = 0.001;

	float clamp_x = smoothstep(0.5,0.1,dx);
	float c = smoothstep(r, r-thickness , d);
	

	// c *= smoothstep(0.5,st.y * 0.5 + 0.5);

	vec3 color = vec3(1.0, 1.0, 1.0);

	gl_FragColor = vec4(color * c, c);
}