import * as THREE from '../vendor/three.module.min.js';
import {addInstruments} from './instruments.js';

// JOE v3: indexed triangles followed by separate position, normal and UV arrays.
export function decodeJoe(buffer){
  const v=new DataView(buffer);if(v.byteLength<28||v.getUint32(0,true)!==844121161||v.getUint32(4,true)!==3)throw new Error('不支持的车辆模型格式');
  const faces=v.getUint32(8,true);if(faces>100000)throw new Error('模型过大');
  let off=16+faces*18;
  const nv=v.getUint32(off,true),nt=v.getUint32(off+4,true),nn=v.getUint32(off+8,true);off+=12;
  const verts=off,norms=verts+nv*12,uvs=norms+nn*12;
  if(uvs+nt*8>v.byteLength)throw new Error('车辆文件不完整');
  const position=new Float32Array(faces*9),normal=new Float32Array(faces*9),uv=new Float32Array(faces*6);
  for(let f=0;f<faces;f++)for(let j=0;j<3;j++){
    const i=f*3+(j===0?0:3-j),vi=v.getUint16(16+f*18+j*2,true),ni=v.getUint16(16+f*18+6+j*2,true),ti=v.getUint16(16+f*18+12+j*2,true);
    if(vi>=nv||ni>=nn||ti>=nt)throw new Error('车辆索引无效');
    for(let k=0;k<3;k++){position[i*3+k]=v.getFloat32(verts+vi*12+k*4,true);normal[i*3+k]=v.getFloat32(norms+ni*12+k*4,true);}
    uv[i*2]=v.getFloat32(uvs+ti*8,true);uv[i*2+1]=v.getFloat32(uvs+ti*8+4,true);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(position,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normal,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
const geometries=new Map(),textures=new Map();
async function geometry(url){if(!geometries.has(url))geometries.set(url,fetch(url).then(r=>{if(!r.ok)throw new Error(`模型加载失败 (${r.status})`);return r.arrayBuffer()}).then(decodeJoe).catch(e=>{geometries.delete(url);throw e}));return geometries.get(url);}
async function texture(url){if(!textures.has(url))textures.set(url,new THREE.TextureLoader().loadAsync(url).then(t=>{t.colorSpace=THREE.SRGBColorSpace;t.flipY=false;t.anisotropy=8;return t}).catch(e=>{textures.delete(url);throw e}));return textures.get(url);}
export async function loadVehicle(car,config,specs,onProgress=()=>{}){
  const root=new THREE.Group(),source=new THREE.Group();root.add(source);source.rotation.x=-Math.PI/2;
  const base=`./vehicles/cars/${car.id}/`;
  const asset=name=>`./vehicles/${name.includes('/')||name.startsWith('steering_')?'carparts/':'cars/'+car.id+'/'}${name}`;
  const bodyMaterial=new THREE.MeshStandardMaterial({color:0xffffff,metalness:.48,roughness:.3,side:THREE.DoubleSide});
  const paint=new THREE.Color(car.color);
  bodyMaterial.onBeforeCompile=shader=>{shader.uniforms.paint={value:paint};shader.fragmentShader='uniform vec3 paint;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP\n vec4 texelColor = texture2D(map, vMapUv);\n diffuseColor *= vec4(mix(paint,texelColor.rgb,texelColor.a),1.0);\n #endif`);};
  const interiorMaterial=new THREE.MeshStandardMaterial({roughness:.88,metalness:.05,side:THREE.DoubleSide});
  let count=0;
  await Promise.all(['body','interior','glass'].map(async name=>{
    const part=config[name];if(!part?.mesh)return;
    const [g,t]=await Promise.all([geometry(base+part.mesh),name==='glass'?Promise.resolve(null):texture(base+(Array.isArray(part.texture)?part.texture[0]:part.texture))]);
    let material=name==='body'?bodyMaterial:name==='interior'?interiorMaterial:new THREE.MeshStandardMaterial({color:0xb8d4df,metalness:.22,roughness:.1,transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide});
    if(t)material.map=t;
    const mesh=new THREE.Mesh(g,material);mesh.name=name;mesh.castShadow=name==='body';mesh.receiveShadow=true;source.add(mesh);onProgress(++count/4);
  }));
  const wheels=[];
  await Promise.all(['fl','fr','rl','rr'].map(async (key)=>{
    const cfg=config['wheel.'+key],g=await geometry(asset(cfg.mesh)),t=await texture(asset(Array.isArray(cfg.texture)?cfg.texture[0]:cfg.texture));
    const pivot=new THREE.Group();pivot.position.fromArray(cfg.position);source.add(pivot);
    const spin=new THREE.Group();pivot.add(spin);
    const rim=new THREE.Mesh(g,new THREE.MeshStandardMaterial({map:t,metalness:.68,roughness:.35,side:THREE.DoubleSide}));
    // Source rims are normalized to approximately one metre in diameter.
    rim.scale.set(specs.rim*(key.endsWith('r')?-1:1),specs.rim,specs.rim);spin.add(rim);
    const tire=new THREE.Mesh(new THREE.TorusGeometry((specs.radius+specs.rim/2)/2,(specs.radius-specs.rim/2)/2,10,36),new THREE.MeshStandardMaterial({color:0x111417,roughness:.95}));
    tire.rotation.y=Math.PI/2;tire.scale.z=specs.width/((specs.radius-specs.rim/2)||.1);tire.castShadow=true;spin.add(tire);wheels.push({pivot,spin,front:key.startsWith('f')});
  }));
  const steeringConfig=config.steering;
  const steeringPivot=new THREE.Group();steeringPivot.position.fromArray(steeringConfig.position);if(car.id==='MI')steeringPivot.position.y-=.16;steeringPivot.rotation.set(...steeringConfig.rotation.map(v=>v*Math.PI/180));source.add(steeringPivot);
  const steering=new THREE.Mesh(await geometry(asset(steeringConfig.mesh)),new THREE.MeshStandardMaterial({map:await texture(asset(steeringConfig.texture)),roughness:.7,side:THREE.DoubleSide}));steeringPivot.add(steering);
  const lift=-Math.min(...['fl','fr','rl','rr'].map(k=>config['wheel.'+k].position[2]-specs.radius))+.018;
  source.position.y=lift;
  const cameraConfig=Object.entries(config).find(([k,v])=>k.startsWith('camera')&&v.name==='driver')?.[1];
  const p=cameraConfig?.position||[-.35,0,.5];
  const eye=new THREE.Vector3(p[0],p[2]+lift,-p[1]).add(new THREE.Vector3(...(car.viewOffset||[0,0,0])));
  const updateInstruments=addInstruments(source,car,specs);
  onProgress(1);
  return {root,source,eye,paint,bodyMaterial,wheels,steering,lift,update(state,dt){updateInstruments(state);for(const w of wheels){w.pivot.rotation.z=w.front?state.steer:0;w.spin.rotation.x-=state.speed/specs.radius*dt;}steering.rotation.z=state.steer/specs.maxSteer*steeringConfig['max-angle']*Math.PI/180;}};
}
