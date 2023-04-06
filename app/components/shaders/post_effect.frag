uniform sampler2D tDiffuse;
uniform sampler2D bufferTexture;
varying vec2 vUv;

void main() {
	vec4 currentColor = texture2D(tDiffuse, vUv);
	
	float center_angle = atan(vUv.y - 0.5, vUv.x - 0.5);

	float dist = 0.001;
	
	vec2 offset = vec2(cos(center_angle)*dist,sin(center_angle)*dist);
	
	vec4 previousColor = texture2D(bufferTexture, vec2(vUv.x,vUv.y)-offset);
	// gl_FragColor = previousColor;
	gl_FragColor = currentColor+previousColor* 0.97;
}