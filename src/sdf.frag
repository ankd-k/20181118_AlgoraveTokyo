/*
  sdf
  requirement:
    signed distance function
      plane
      sphere
      box
      torus
      cylinder
      hexprism
      triprism
      capsule
      tetrahedron
    operation
      union
      substitution
      intersection
      smooth union
      repetation
      twist
*/
float sdPlane   (in vec3 p, in float y){return (p.y - y);}
float sdSphere  (in vec3 p, in float r){return abs(length(p)-r);}
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
