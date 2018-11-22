/*
  material.frag
  To write:
    col - color
      define by res.y
*/

vec3 col;
if(res.y<0.){
  col = vec3(0.0);
}else if(res.y == 0.){
  col = vec3(1.0);
}
else if(res.y == 1.0){
  col = vec3(1.0);
}
else if(res.y == 2.0){
  col = vec3(1.0);
}
