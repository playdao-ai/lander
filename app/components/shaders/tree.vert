 // Set the precision for data types used in this shader
precision highp float;
precision highp int;
// Variables to pass from vertex to fragment shader
varying vec3 vNormal;
varying vec3 vPosition;
void main() {
	vNormal = normal;
	vPosition = position;
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}