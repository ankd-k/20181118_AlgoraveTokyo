/*{
  pixelRatio: 2.0,
  frameskip: 1.0,
  PASSES:[
    {
      TARGET: 'sceneTex',
      FLOAT: true,
    },
    {}
  ],
}*/
precision highp float;

#pragma glslify: blur = require('glsl-fast-gaussian-blur')
#pragma glslify: snoise3 = require('glsl-noise/simplex/3d')

#define FADE_IN pow(clamp(0.2*float(FRAMEINDEX)/60.0, 0., 1.), 1.2)
#define BACKGROUND_COLOR vec3(0.0)

#define BASE_POS vec3(0., 0.6, 0.)

// basic
uniform vec2 resolution;
uniform vec2 mouse;
uniform float time;
uniform int FRAMEINDEX;
#define FRAMETIME float(FRAMEINDEX)/60.0
// audio
uniform float volume;
uniform sampler2D samples;
uniform sampler2D spectrum;
// osc
uniform sampler2D osc_msg_audio;
float getAudio(in float num){
  return texture2D(osc_msg_audio, vec2(num/6.0, 0.)).r;
}

const float PI = 3.14159265359;

// multipass
uniform int PASSINDEX;
uniform sampler2D sceneTex;

// utils
float usin(in float x){return 0.5+0.5*sin(x);}
float ucos(in float x){return 0.5+0.5*cos(x);}

float random(in vec2 n){ highp float a=12.9898, b=4.1414, c=43123.9878; highp float dt = dot(n.xy, vec2(a, b)); highp float sn = mod(dt, PI); return fract(sin(sn)*c);}
vec3 random3(in vec2 n){ return vec3(random(n+vec2(10.2, 9.3)), random(n+vec2(5.1, 8.6)), random(n+vec2(3.9, 7.5)));}

float ease_in(float x, float n){ return pow(x, n);}
float ease_out(float x, float n){ return 1.0-pow(1.0-x, n);}
float ease_inout(float x, float n){ float x2 = x*2.0; return x2<1.?ease_in(x2, n)*0.5:ease_out(x2-1., n)*0.5+0.5;}
float ease_outin(float x, float n){ float x2 = x*2.0; return x2<1.?ease_out(x2, n)*0.5:ease_in(x2-1., n)*0.5+0.5;}

vec3 rotX(vec3 p, float r){return mat3(1.0, 0.0, 0.0, 0.0, cos(r), -sin(r), 0.0, sin(r), cos(r))*p;}
vec3 rotY(vec3 p, float r){return mat3(cos(r), 0.0, sin(r), 0.0, 1.0, 0.0, -sin(r), 0.0, cos(r))*p;}
vec3 rotZ(vec3 p, float r){return mat3(cos(r), -sin(r), 0.0, sin(r), cos(r), 0.0, 0.0, 0.0, 1.0)*p;}
vec3 rot(vec3 p, vec3 r){ return rotX(rotY(rotZ(p, r.z), r.y), r.x);}

/*
  SDF
*/
float sdPlane   (in vec3 p, in float y){return (p.y - y);}
float sdSphere  (in vec3 p, in float r){return (length(p)-r);}
float sdBox     (in vec3 p, in vec3 b){ vec3 d = abs(p)-b;   return abs(length(max(d,0.0)) + min(max(d.x,max(d.y,d.z)),0.0));}
float sdTorus   (vec3 p, vec2 t){vec2 q = vec2(length(p.xz)-t.x, p.y); return length(q)-t.y;}
float sdCylinder(in vec3 p, in vec3 c){ return length(p.xz - c.xy)-c.z; }
float sdHexPrism(vec3 p, vec2 h){ vec3 q = abs(p); return max(q.z-h.y, max((q.x*0.866025 + q.y*0.5), q.y) - h.x); }
float sdTriPrism( vec3 p, vec2 h ){ vec3 q = abs(p); return max(q.z-h.y,max(q.x*0.866025+p.y*0.5,-p.y)-h.x*0.5); }
float sdCapsule (vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a; vec3 ba = b - a; float h = clamp(dot(pa,ba)/dot(ba,ba), 0., 1.); return length(pa - ba*h)-r; }

float sdTetrahedron(in vec3 z, in float r){
  vec3 a1 = r*vec3(1,1,1);
	vec3 a2 = r*vec3(-1,-1,1);
	vec3 a3 = r*vec3(1,-1,-1);
	vec3 a4 = r*vec3(-1,1,-1);

	vec3 c;
	int n = 0;
	float dist, d;
  for(int i=0;i<8;i++){
		 c = a1; dist = length(z-a1);
	   d = length(z-a2); if (d < dist) { c = a2; dist=d; }
		 d = length(z-a3); if (d < dist) { c = a3; dist=d; }
		 d = length(z-a4); if (d < dist) { c = a4; dist=d; }
		z = 2.0*z-c*(2.0-1.0);
	}
	return length(z) * pow(2.0, -8.0);}

// operation
vec2 opU(in vec2 d1, in vec2 d2){ return d1.x<d2.x ? d1 : d2; }
vec2 opS(in vec2 d1, in vec2 d2){ return -d1.x>d2.x ? d1 : d2;}
vec2 opI(in vec2 d1, in vec2 d2){ return d1.x>d2.x ? d1 : d2;}
vec2 opSmoothU(in vec2 d1, in vec2 d2, in float k){
  float h = clamp(0.5+0.5*(d2.x - d1.x)/k, 0., 1.);
  float d = mix(d2.x, d1.x, h) - k*h*(1.0-h);
  return vec2(d, d1.y);}
vec3 opRep(in vec3 p, in vec3 c){return mod(p, c)-0.5*c;}
vec3 opTwist(in vec3 p, in float r){ float c = cos(r*p.y); float s = sin(r*p.y); mat2 m = mat2(c, -s, s, c); return vec3(m*p.xz, p.y); }

/*
  map
*/
vec2 map(in vec3 p){
  float d = 0.; vec3 q;
  // ground
  q = p;
  // vec2 res = vec2(sdPlane(q, texture2D(samples, vec2(fract(length(p.xz)), 0.)).r), 0.);
  vec2 res = vec2(sdPlane(q, -0.5+0.5*sin(length(p.xz)+time)), 0.);

  // main object
  q = p - BASE_POS;
  // for(int i=0;i<5;i++){
  //   q = opTwist(q, 2.0*sin(time) * float(i));
  // }
  // q = rot(q, vec3(time*0.2));
  float ratio = clamp(pow(0.2*getAudio(0.0), 4.0), 0., 1.);
  float r = mix(0., 6.0, ratio);
  // r = 0.0;
  q = opTwist((q), r);
  d = sdTetrahedron(q, mix(0.3, 0.8, ratio));
  res = opU(res, vec2(d, 1.0));

  float tmp = sdSphere(q + vec3(sin(time), sin(time*0.6), sin(time*0.8)), 1.3);
  res = opU(res, vec2(d, 1.0));
  // sub object

  q = p - BASE_POS;
  q = opRep(q, vec3(2.0, 1.0, 2.0));
  q *= vec3(1.0-getAudio(0.));
  q.y += fract(time);
  q = rot(q, vec3(time));
  d = sdBox(q, vec3(0.1, 0.2, 0.3));
  res = opU(res, vec2(d, 2.0));

  return res;
}

// calc Normal
vec3 calcNormal(in vec3 p){
  vec2 e = vec2(1.0, -1.0) * 0.001;
  return normalize(vec3(
      e.xyy * map(p + e.xyy).x +
      e.yxy * map(p + e.yxy).x +
      e.yyx * map(p + e.yyx).x +
      e.xxx * map(p + e.xxx).x
    ));
}
// castRay
vec2 castRay(in vec3 ro, in vec3 rd){
  float dmin = 0.01;
  float dmax = 10.0;

  float d=0.0, m=-1.0;
  for(int i=0;i<50;i++){
    float precis = 0.004*d;
    vec2 tmp = map(ro + rd*d) * vec2(0.95, 1.0);
    if(tmp.x<precis || dmax<d) break;
    d += tmp.x;
    m = tmp.y;
  }

  if(dmax<d)m = -1.0;
  return vec2(d, m);
}

// calcAO
float calcAO(in vec3 pos, in vec3 nor){
  float occ = 0.0;
  float sca = 1.0;
  for(int i=0;i<5;i++){
    float hr = 0.01 + 0.12*float(i)/4.0;
    vec3 aopos = nor*hr + pos;
    float dd = map(aopos).x;
    occ += -(dd-hr)*sca;
    sca *= 0.95;
  }
  return clamp(1.0-3.0*occ, 0., 1.);
}
// calcSoftshadow
float calcSoftshadow( in vec3 ro, in vec3 rd, in float dmin, in float dmax ){
	float res = 1.0;
    float t = dmin;
    for( int i=0; i<16; i++ )
    {
		float h = map( ro + rd*t ).x;
        res = min( res, 8.0*h/t );
        t += clamp( h, 0.02, 0.10 );
        if( res<0.01 || t>dmax ) break;
    }
    return clamp( res, 0.0, 1.0 );
}

// render
vec3 render(in vec3 ro, in vec3 rd, out vec3 pos, out float depth){
  vec2 res = castRay(ro, rd);
  float d=res.x, m=res.y;

  pos = ro + rd*d;
  depth = length(pos-ro);
  vec3 nor = calcNormal(pos);
  vec3 ref = reflect(rd, nor);

  /*
    material
  */
  vec3 col;
  if(res.y == 0.){
    col = vec3(texture2D(samples, vec2(length(pos.xz*0.5), 0.)).r);
  }
  else if(res.y == 1.0){
    col = vec3(.5);
    // col = pos;
  }else if(res.y == 2.0){
    col = vec3(2.0*volume/255.0);
  }

  /*
    light
  */
  vec3 lig = normalize(vec3(0.4, 0.8, 0.6));

  float occ = calcAO(pos, nor);
  float amb = clamp(0.5+0.5*nor.y, 0., 1.);
  float dif = clamp(dot(nor, lig), 0., 1.);
  float bac = clamp(dot(nor, vec3(-lig.x, 0., -lig.z)), 0., 1.) * clamp(1.0-pos.y, 0., 1.);
  float dom = smoothstep(-0.1, 0.1, ref.y);
  float fre = pow(clamp(1.0+dot(nor, rd), 0., 1.), 2.0);
  float spe = pow(clamp(dot(ref,lig), 0., 1.), 16.);

  dif *= calcSoftshadow(pos, lig, 0.05, 2.5);
  dom *= calcSoftshadow(pos, ref, 0.05, 2.5);

  vec3 brdf = vec3(0.);
  brdf += 15.0 * dif * mix(vec3(0.01), vec3(0.0, 0.0, 1.0), getAudio(1.0));
  brdf += 1.0*getAudio(0.) * spe * vec3(1.0) * dif;
  brdf += (1.0*getAudio(0.)+0.2) * amb * mix(vec3(0.01), vec3(1.0, 1.0, 1.0), getAudio(4.0)) * occ;
  brdf += 0.1 * bac * vec3(1.0) * occ;
  brdf += 10.0*getAudio(0.) * dom * vec3(1.0) * occ;
  brdf += 2.5 * fre * mix(vec3(0.01), vec3(1.0, 1.0, 0.0), getAudio(0.0)) * occ;

  col *= brdf;

  // mix scene and background
  col = mix(col, BACKGROUND_COLOR, 1.0-exp(-0.01*d*d*d));

  return clamp(col, 0., 1.);
}

/*
 camera
*/
void camera(inout vec3 ro, inout vec3 rd){
  vec3 ta;

  ro = BASE_POS + vec3(3.0*cos(time*0.1), -0.1, 1.5*sin(time*0.1));
  ta = BASE_POS + 0.1*vec3(sin(time*0.21), sin(time*0.31), sin(time*0.54));

  vec3 cw = normalize(ta-ro);
  vec3 cp = vec3(0., 1., 0.);
  vec3 cu = normalize(cross(cw, cp));
  vec3 cv = normalize(cross(cu, cw));
  vec2 p = (gl_FragCoord.xy*2.0 - resolution)/min(resolution.x, resolution.y);
  rd = normalize( p.x*cu + p.y*cv + 2.5*cw );
  return;
}

void main(){
  vec2 uv = gl_FragCoord.xy/resolution;
  vec2 p = (gl_FragCoord.xy*2.-resolution)/min(resolution.x, resolution.y);

  // set camera
  vec3 ro,rd;
  camera(ro, rd);

  // scene
  if(PASSINDEX==0){
    // render
    vec3 pos;
    float depth;
    vec3 col = render(ro, rd, pos, depth);

    col = pow(col, vec3(0.4545));
    gl_FragColor = vec4(col, depth);
    return;
  }
  // post effects
  else if(PASSINDEX==1){
    vec3 s = texture2D(sceneTex, uv).rgb;
    vec3 b = blur(sceneTex, uv, resolution, vec2(2.0, 0.0)).rgb;

    float depth = texture2D(sceneTex, uv).w;
    float centerDepth = length(BASE_POS-ro);// + 0.5*sin(time*2.0);

    vec3 col = mix(s, b, pow(clamp(1.0*abs(centerDepth - depth), 0., 1.), 8.0));

    gl_FragColor = vec4(col, 1.0);
    // gl_FragColor *= 1.0-FADE_IN;
    // gl_FragColor = vec4(0.);
    // gl_FragColor *= texture2D(osc_msg_audio, uv).r;
    // gl_FragColor *= step(fract(length(p) - time*15.0), 0.6);
  }
}
