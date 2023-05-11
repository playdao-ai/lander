#include <common>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
uniform sampler2D tReflectionMap;
uniform sampler2D tRefractionMap;
uniform sampler2D tNormalMap0;
uniform sampler2D tNormalMap1;
#ifdef USE_FLOWMAP
	uniform sampler2D tFlowMap;
#else
	uniform vec2 flowDirection;
#endif
uniform vec3 color;
uniform float reflectivity;
uniform vec4 config;
varying vec4 vCoord;
varying vec2 vUv;
varying vec3 vToEye;
void main() {
	#include <logdepthbuf_fragment>
	float flowMapOffset0 = config.x;
	float flowMapOffset1 = config.y;
	float halfCycle = config.z;
	float scale = config.w;
	vec3 toEye = normalize( vToEye );
	// determine flow direction
	vec2 flow;
	#ifdef USE_FLOWMAP
		flow = texture2D( tFlowMap, vUv ).rg * 2.0 - 1.0;
	#else
		flow = flowDirection;
	#endif
	flow.x *= - 1.0;
	// sample normal maps (distort uvs with flowdata)
	vec4 normalColor0 = texture2D( tNormalMap0, ( vUv * scale ) + flow * flowMapOffset0 );
	vec4 normalColor1 = texture2D( tNormalMap1, ( vUv * scale ) + flow * flowMapOffset1 );
	// linear interpolate to get the final normal color
	float flowLerp = abs( halfCycle - flowMapOffset0 ) / halfCycle;
	vec4 normalColor = mix( normalColor0, normalColor1, flowLerp );
	// calculate normal vector
	vec3 normal = normalize( vec3( normalColor.r * 2.0 - 1.0, normalColor.b,  normalColor.g * 2.0 - 1.0 ) );
	// calculate the fresnel term to blend reflection and refraction maps
	float theta = max( dot( toEye, normal ), 0.0 );
	float reflectance = reflectivity + ( 1.0 - reflectivity ) * pow( ( 1.0 - theta ), 5.0 );
	// calculate final uv coords
	vec3 coord = vCoord.xyz / vCoord.w;
	vec2 uv = coord.xy + coord.z * normal.xz * 0.05;
	vec4 reflectColor = texture2D( tReflectionMap, vec2( 1.0 - uv.x, uv.y ) );
	vec4 refractColor = texture2D( tRefractionMap, uv );
	// multiply water color with the mix of both textures
	gl_FragColor = vec4( color, 1.0 ) * mix( refractColor, reflectColor, reflectance );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
	#include <fog_fragment>
}