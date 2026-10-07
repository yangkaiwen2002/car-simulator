import * as THREE from '../vendor/three.module.min.js';
import {MeshoptDecoder} from '../vendor/meshopt_decoder.module.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {mcl39Cockpit} from './mcl39-cockpit.js';
import {galaxyMaterial} from './galaxy-livery.js';
import {formulaDisplay} from './formula-display.js';
import {damageVisuals} from './damage-visuals.js';
import {splitP1Steering} from './p1-cockpit.js';

export const GLTF_STEERING_AXES={MCL39:new THREE.Vector3(0,-1,0),W33:new THREE.Vector3(0,-1,0),RB19:new THREE.Vector3(0,-1,0),M4:new THREE.Vector3(0,-.955,.297).normalize(),P1:new THREE.Vector3(0,-.94,.342).normalize(),REV:new THREE.Vector3(0,-1,0)};

export function updateGltfWheels(wheels,steering,state,dt,axis=GLTF_STEERING_AXES.REV){
 for(const w of wheels){w.pivot.rotation.z=w.front?state.steer:0;w.spin.rotation.x-=state.speed/w.radius*dt;}
 // The baked glTF spindle points forward (+Y), away from the driver.
 // A left rack angle must rotate the rim top toward -X, unlike JOE's +Z spindle.
 steering.setRotationFromAxisAngle(axis,state.steer*9);
}

// Bake community glTF transforms into the same x/right, y/forward, z/up
// metre coordinates as our JOE vehicles. Preserve their actual cabin meshes.
export async function loadGltfVehicle(car,config,specs,onProgress=()=>{}){
 const loaded=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`./vehicles/cars/${car.id}/${car.model}`);
 loaded.scene.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(loaded.scene),size=bounds.getSize(new THREE.Vector3());
 const scale=car.modelLength/size.z,centerZ=(bounds.min.z+bounds.max.z)/2;
 const transform=new THREE.Matrix4().set(-scale,0,0,0, 0,0,scale,-centerZ*scale, 0,scale,0,-bounds.min.y*scale+.018, 0,0,0,1);
 const root=new THREE.Group(),source=new THREE.Group();root.add(source);source.rotation.x=-Math.PI/2;
 const paint=new THREE.Color(car.color),bodyParts=[],wheelParts=[[],[],[],[]],steeringParts=[];
 loaded.scene.traverse(m=>{
  if(!m.isMesh)return;
  const matrix=new THREE.Matrix4().multiplyMatrices(transform,m.matrixWorld);
  let geo=m.geometry.clone();
  // Quantized model coordinates must become floats before baking metre transforms.
  if((car.id==='RB19'||car.id==='W33'))for(const key of ['position','normal']){const a=geo.getAttribute(key);if(a){const values=[];for(let i=0;i<a.count;i++)values.push(a.getX(i),a.getY(i),a.getZ(i));geo.setAttribute(key,new THREE.Float32BufferAttribute(values,3));}}
  const material=m.material.clone(),name=material.name.toLowerCase();material.side=THREE.DoubleSide;
  if(car.id==='P1'&&name==='interior'){
   const parts=splitP1Steering(geo);geo.dispose();geo=parts.interior;
   parts.steering.applyMatrix4(matrix);parts.steering.computeBoundingBox();
   // The uncalibrated metallic default obscures the original wheel's details.
   material.metalness=.08;material.roughness=.82;material.metalnessMap=null;material.roughnessMap=null;
   const wheel=new THREE.Mesh(parts.steering,material);wheel.name='P1_original_steering';wheel.castShadow=true;steeringParts.push(wheel);
  }
  geo.applyMatrix4(matrix);geo.computeBoundingBox();
  material.envMapIntensity=.8;
  if(car.id==='W33')galaxyMaterial(material,m.name);
  const painted=car.id!=='MCL39'&&(name==='main_body'||name==='body'||(car.id==='M4'&&name==='material.001'));
  if(car.id==='M4'){
   if(m.name.startsWith('Mirror_')){material.emissive.set(0);material.emissiveIntensity=0;material.color.set('#66747c');material.metalness=.8;material.roughness=.32;material.envMapIntensity=.18;}
   if(m.name.startsWith('Wheel_')&&name==='material.002'){material.color.set('#72767c');material.metalness=.8;material.roughness=.3;}
   if(name==='material.010'){material.color.set('#25292d');material.metalness=.18;material.roughness=.68;}
   if(name==='material.008'){material.color.set('#25282c');material.metalness=.06;material.roughness=.78;}
   if(name==='material.031'){material.emissiveMap=material.map;material.emissive.set('#ffffff');material.emissiveIntensity=.18;}
  }
  if(painted){material.color=paint;material.metalness=.55;material.roughness=.3;}
  if(/windshield|windows|window|windscreen/.test(name)||(car.id==='M4'&&m.name.includes('Glass_mesh_windows'))){material.transparent=true;material.opacity=.15;material.depthWrite=false;material.roughness=.08;}
  const fixedCaliper=car.id==='M4'&&m.name.startsWith('Caliper_');
  const isWheel=(car.id==='MCL39'&&/^(front_tire|rear_tire|wheel_|front_wheel_cover|rear_wheel_cover)/.test(name))||((car.id==='RB19'||car.id==='W33')&&m.name.startsWith('wheel_'))||(car.id==='M4'&&(m.name.startsWith('Wheel_')||fixedCaliper))||/^(tires?|rims?|disk|disk_circles|tire_logo|brake_rotor|brake|wheel)/.test(name)&&! /light/.test(name);
  if(isWheel){
   // Some exports combine all four wheels into one mesh: split triangles by
   // axle/side, so rotating them never rotates the entire four-wheel assembly.
   const groups=[[],[],[],[]],a=geo.attributes.position,indices=geo.index?.array||Array.from({length:a.count},(_,i)=>i);
   for(let i=0;i<indices.length;i+=3){const ids=[indices[i],indices[i+1],indices[i+2]],x=ids.reduce((v,id)=>v+a.getX(id),0)/3,y=ids.reduce((v,id)=>v+a.getY(id),0)/3;groups[(y>0?0:2)+(x>0?1:0)].push(...ids);}
   groups.forEach((indices,i)=>{if(!indices.length)return;const selected=[...new Set(indices)],remap=new Map(selected.map((id,j)=>[id,j])),g=new THREE.BufferGeometry();for(const [key,attr] of Object.entries(geo.attributes)){const values=new attr.array.constructor(selected.length*attr.itemSize);selected.forEach((index,j)=>{for(let k=0;k<attr.itemSize;k++)values[j*attr.itemSize+k]=attr.array[index*attr.itemSize+k];});g.setAttribute(key,new THREE.BufferAttribute(values,attr.itemSize,attr.normalized));}g.setIndex(indices.map(id=>remap.get(id)));g.computeBoundingBox();const mesh=new THREE.Mesh(g,material);mesh.userData.fixedCaliper=fixedCaliper;wheelParts[i].push(mesh);});
   geo.dispose();return;
  }
  const mesh=new THREE.Mesh(geo,material);mesh.name=m.name;mesh.castShadow=!material.transparent;mesh.receiveShadow=true;
  if(((car.id==='RB19'||car.id==='W33')&&m.name==='steering_wheel')||(car.id==='REV'&&m.name.startsWith('Steering_wheel_'))||(car.id==='M4'&&m.name.startsWith('Steering_')))steeringParts.push(mesh);
  else source.add(mesh);
  if((car.id==='MCL39'&&/^(main_body|front_wing|rear_wing)/.test(name))||(painted&&!/mirror/i.test(m.name))||((car.id==='RB19'||car.id==='W33')&&m.name==='body'))bodyParts.push(mesh);
 });
 const wheels=wheelParts.map((parts,i)=>{
  const box=new THREE.Box3();parts.forEach(m=>box.union(m.geometry.boundingBox));const center=box.getCenter(new THREE.Vector3());
  const pivot=new THREE.Group(),spin=new THREE.Group();pivot.position.copy(center);source.add(pivot);pivot.add(spin);
  parts.forEach(m=>{m.geometry.translate(-center.x,-center.y,-center.z);m.castShadow=true;(m.userData.fixedCaliper?pivot:spin).add(m);});
  return {pivot,spin,front:i<2,radius:(box.max.z-box.min.z)/2};
 });
 const steering=new THREE.Group();if(steeringParts.length){const box=new THREE.Box3();steeringParts.forEach(m=>box.union(m.geometry.boundingBox));const center=box.getCenter(new THREE.Vector3());steering.position.copy(center);for(const m of steeringParts){m.geometry.translate(-center.x,-center.y,-center.z);steering.add(m);}source.add(steering);}
 if(car.id==='MCL39')mcl39Cockpit(source,steering);
 specs.collider={hx:size.x*scale*.47,hz:car.modelLength*.49,cx:0,cz:0};
 const updateDisplay=car.id==='MCL39'?formulaDisplay(steering,2.5):(car.id==='RB19'||car.id==='W33')?formulaDisplay(steering,scale):()=>{};
 const updateDamage=damageVisuals(root,source,bodyParts,specs);
 onProgress(1);
 return {root,source,eye:new THREE.Vector3(...car.eye),paint,bodyMaterial:bodyParts[0].material,wheels,steering,lift:0,collider:specs.collider,mass:specs.mass,update(state,dt){updateDamage(state);updateDisplay(state);updateGltfWheels(wheels,steering,state,dt,GLTF_STEERING_AXES[car.id]);}};
}
