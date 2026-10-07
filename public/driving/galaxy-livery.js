// Original procedural livery on an attributed community chassis. No RB19 logos.
export function galaxyMaterial(material,name){
 material.map=null;material.metalnessMap=null;material.roughnessMap=null;material.normalMap=null;material.emissiveMap=null;
 material.color.set(name==='body'?'#d4e5eb':'#161c24');material.metalness=name==='body'?.7:.15;material.roughness=name==='body'?.32:.78;
 if(name!=='body')return;
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 galaxyPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n galaxyPosition = position;');
  shader.fragmentShader='varying vec3 galaxyPosition;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec3 p=galaxyPosition;
   float lower=1.0-smoothstep(.22,.40,p.z);
   float stripe=1.0-smoothstep(.025,.055,abs(abs(p.x)-(.18+.055*sin(p.y*2.0))));
   float nebula=.5+.5*sin(p.y*3.5+p.x*9.0+p.z*4.0);
   vec3 midnight=mix(vec3(.012,.022,.065),vec3(.055,.026,.13),nebula);
   float star=step(.994,fract(sin(dot(floor(p.xy*180.0),vec2(12.9898,78.233)))*43758.5453));
   vec3 galaxy=midnight+star*.65;
   float flank=smoothstep(.22,.42,abs(p.x));
   diffuseColor.rgb=mix(diffuseColor.rgb,galaxy,max(lower,flank*.92));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.015,.85,.62),stripe*smoothstep(.2,.35,p.z));`);
 };
 material.customProgramCacheKey=()=> 'w33-galaxy-v1';
}
