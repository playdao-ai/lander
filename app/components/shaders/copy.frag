 uniform sampler2D tDiffuse;
varying vec2 vUv;
void main() {
	gl_FragColor = texture2D(tDiffuse, vUv);
	// gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
}