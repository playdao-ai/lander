uniform float time;
varying vec2 vUv;

float random (vec2 st) {
    return fract(sin(dot(st.xy,
                         vec2(12.9898,78.233)))
                 * 43758.5453123);
}

void main() {
  // Normalize the texture coordinates to [-1, 1] and shrink the scale
  vec2 st = vUv * 2.0 - 1.0;
  float c_dist = length(st);
  st *= 40.0*(0.98+sin(vUv.y*40.0 + time)*0.03+sin(vUv.x*40.0 + time)*0.03);

  // Create the cube lattice and add noise
  vec3 cube = floor(vec3(st, 0.1));
  vec2 rel = abs(st - cube.xy - 0.5);
  float d = max(rel.x, rel.y);
  float n = random(cube.xy + vec2(time)) * 0.2;


  // Create the star field effect
  float c = 1.0 - smoothstep(0.0, 0.06, d);
  c *= sin(time*4.-c_dist*80.0)*2.0;
  // c *= sin(time*4.+vUv.y*20.0)*2.0;
  c = max(0.0,c);
  float ring = smoothstep(0.7,0.8,c_dist) * smoothstep(0.9,0.8,c_dist);

  c *= ring;

  vec3 color = vec3(1.0);




  gl_FragColor = vec4(color * c, 1.0);
}