/*
  light.frag
  requirement:
    coefficient of:
      dif
      spe
      amb
      bac
      dom
      fre
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
brdf += 0.0 * dif * vec3(1.0);
brdf += getAudio(2.0) * spe * vec3(1.0) * dif;
brdf += 0.1 * amb * vec3(1.0) * occ;
brdf += 0.0 * bac * vec3(1.0) * occ;
brdf += (0.01+texture2D(osc_msg_audio, vec2(0.0)).r*0.2) * dom * vec3(1.0) * occ;
brdf += 0.0 * fre * vec3(1.0) * occ;
