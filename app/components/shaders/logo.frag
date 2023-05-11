varying vec2 vUv;
uniform float alpha;

#define CIRCLE 6.28318530718
#ifndef PI
#define PI 3.141592653589793
#endif

#ifndef HALF_PI
#define HALF_PI 1.5707963267948966
#endif

float elasticIn(float t) {
  return sin(13.0 * t * HALF_PI) * pow(2.0, 14.0 * (t - 1.0));
}

float backOut(float t) {
  float f = 1.0 - t;
  return 1.0 - (pow(f, 3.0) - f * sin(f * PI));
}

float elasticOut(float t) {
  return sin(-13.0 * (t + 1.0) * HALF_PI) * pow(2.0, -10.0 * t) + 1.0;
}

float elasticInOut(float t) {
  return t < 0.5
    ? 0.5 * sin(+13.0 * HALF_PI * 2.0 * t) * pow(2.0, 10.0 * (2.0 * t - 1.0))
    : 0.5 * sin(-13.0 * HALF_PI * ((2.0 * t - 1.0) + 1.0)) * pow(2.0, -10.0 * (2.0 * t - 1.0)) + 1.0;
}


float meatball(vec2 p, float r){return r / dot(p, p);}

float speed = 4.5;

void main()
{

    // Normalized pixel coordinates (from 0 to 1)
   	vec2 center = (vUv.xy+vec2(0.5))*.5;
    center = center - vec2(1.0)*.5;
	float t = elasticOut(alpha);
	// t = time;

    float rot = smoothstep(0.0,1.,mod(t*.5,1.0))*PI*2.0/3.0+PI;
    
    float center_ball = meatball(center,0.03*(0.02+t*.98));

    vec3 trace = vec3(center_ball);
    // trace = mix(vec3(center_ball),trace,1.0-t);
    
    for(int i = 0;i<3;i++){
        vec2 offset = vec2(cos(CIRCLE/3.0*float(i)-rot),sin(CIRCLE/3.0*float(i)-rot));
        trace -= meatball(center-offset*.12,0.005);
    }

    //vec3 b = vec3(0.0);
    float inner_ball = meatball(center,0.007*t);
    vec3 b = vec3(inner_ball);
    // b = mix(b,vec3(inner_ball*2.,inner_ball,inner_ball*.5),0.0);
    for(int i = 0;i<3;i++){
        vec2 offset = vec2(cos(CIRCLE/3.0*float(i)+PI-rot),sin(CIRCLE/3.0*float(i)+PI-rot));
        b -= meatball(center-offset*.10,0.005);
    }
    
    //vec3 inner = smoothstep(vec3(0.92*(0.9+t*.1)),vec3(1.0),vec3(b));
    trace = smoothstep(vec3(0.96),vec3(1.0),min(vec3(1.0),trace)-max(vec3(0.0),smoothstep(0.6,1.0,b)));
    gl_FragColor = vec4(trace,length(trace));
}