varying vec2 vUv;
uniform float time;

void main() {
  // Normalize the pixel coordinates to [-1, 1]
  vec2 st  = vUv.xy-vec2(0.5);

  // Calculate the distance from the center of the screen
  float d = length(st);

  // Create a circle with radius 0.5
  float thickness = 0.001;
  float r = 0.5;
  float c = smoothstep(r, r-thickness , d);
  c *= 1.0-smoothstep(r-thickness*2.,r-thickness*3.,d);

 

  c = max(c,0.0);


  

  //uv angle
  float angle = atan(st.y,st.x);

  float angle_cutoff = max(0.0,sin(angle*20.0-time-sin(angle*40.0+time+angle)));

  float angle2_cutoff = max(0.0,sin(angle*22.0+time-cos(angle*30.0-time+angle*2.0)));
  
  angle_cutoff *= angle2_cutoff;

  c *= angle_cutoff;
  c = pow(c,0.05);

  float glow = (1.0-smoothstep(r, r*0.8, d)) * (1.0-step(r,d)) * (angle_cutoff - angle2_cutoff);

//   c += glow * glow * glow;
  // Set the color of the pixel to white  
  vec3 color = vec3(1.0);
  gl_FragColor = vec4(color * c, 1.0);
}