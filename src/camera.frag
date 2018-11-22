/*
  camera.frag
  requirement:
    ro - camera position (ray origin)
    ta - camera target
*/
ro = BASE_POS - vec3(cos(time*0.05*sin(time*0.03)), -usin(FRAMETIME), 3.0 + sin(time*0.1));
ta = BASE_POS;
