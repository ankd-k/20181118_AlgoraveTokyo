/*
  map.frag
  To write:
    vec2 res
      x : distance
      y : material index
*/

vec2 map(in vec3 p){
  float d = 0.; vec3 q;
  // ground
  q = p;
  vec2 res = vec2(sdPlane(q, 0.4*texture2D(samples, vec2(floor(length(q.xz*0.2)*5.0)/5.0, 0.)).r), 0.);
  // vec2 res = vec2(sdPlane(q, 0.), texture2D(samples, vec2(length(q.xz), 0.)).r);

  // main object
  q = p - BASE_POS - vec3(0., 0.2+0.2*sin(time), 0.);
  d = sdSphere(q, 0.2);
  res = opU(res, vec2(d, 1.0));

  // sub object

  return res;
}
