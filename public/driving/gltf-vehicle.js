import * as THREE from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {damageVisuals} from './damage-visuals.js';

// Bake community glTF transforms into the same x/right, y/forward, z/up
// metre coordinates as our JOE vehicles. Preserve their actual cabin meshes.
export async function loadGltfVehicle(car,config,specs,onProgress=()=>{}){
 const loaded=await new GLTFLoader().loadAsync(`./vehicles/cars/${car.id}/${car.model}`);
 loaded.scene.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(loaded.scene),size=bounds.getSize(new THREE.Vector3());
 const scale=car.modelLength/size.z,centerZ=(bounds.min.z+bounds.max.z)/2;
 const transform=new THREE.Matrix4().set(-scale,0,0,0, 0,0,scale,-centerZ*scale, 0,scale,0,-bounds.min.y*scale+.018, 0,0,0,1);
 const root=new THREE.Group(),source=new THREE.Group();root.add(source);source.rotation.x=-Math.PI/2;
 const paint=new THREE.Color(car.color),bodyParts=[],wheelParts=[[],[],[],[]],steeringParts=[];
 loaded.scene.traverse(m=>{
  if(!m.isMesh)return;
  let geo=m.geometry.clone();geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(transform,m.matrixWorld));geo.computeBoundingBox();
  const material=m.material.clone(),name=material.name.toLowerCase();material.side=THREE.DoubleSide;
  material.envMapIntensity=.8;
  const painted=name==='main_body'||name==='body';
  if(painted){material.color=paint;material.metalness=.55;material.roughness=.3;}
  if(/windshield|windows|window|windscreen/.test(name)){material.transparent=true;material.opacity=.15;material.depthWrite=false;material.roughness=.08;}
  const isWheel=/^(tires?|rims?|disk|disk_circles|tire_logo|brake_rotor|brake|wheel)/.test(name)&&! /light/.test(name);
  if(isWheel){
   // Some exports combine all four wheels into one mesh: split triangles by
   // axle/side, so rotating them never rotates the entire four-wheel assembly.
   if(geo.index)geo=geo.toNonIndexed();
   const groups=[[],[],[],[]],a=geo.attributes.position;
   for(let i=0;i<a.count;i+=3){const x=(a.getX(i)+a.getX(i+1)+a.getX(i+2))/3,y=(a.getY(i)+a.getY(i+1)+a.getY(i+2))/3;groups[(y>0?0:2)+(x>0?1:0)].push(i,i+1,i+2);}
   groups.forEach((indices,i)=>{if(!indices.length)return;const g=new THREE.BufferGeometry();for(const [key,attr] of Object.entries(geo.attributes)){const values=new Float32Array(indices.length*attr.itemSize);indices.forEach((index,j)=>{for(let k=0;k<attr.itemSize;k++)values[j*attr.itemSize+k]=attr.array[index*attr.itemSize+k];});g.setAttribute(key,new THREE.BufferAttribute(values,attr.itemSize));}g.computeBoundingBox();wheelParts[i].push(new THREE.Mesh(g,material));});
   geo.dispose();return;
  }
  const mesh=new THREE.Mesh(geo,material);mesh.name=m.name;mesh.castShadow=!material.transparent;mesh.receiveShadow=true;
  if(car.id==='REV'&&m.name.startsWith('Steering_wheel_'))steeringParts.push(mesh);
  else source.add(mesh);
  if(painted&&!/mirror/i.test(m.name))bodyParts.push(mesh);
 });
 const wheels=wheelParts.map((parts,i)=>{
  const box=new THREE.Box3();parts.forEach(m=>box.union(m.geometry.boundingBox));const center=box.getCenter(new THREE.Vector3());
  const pivot=new THREE.Group(),spin=new THREE.Group();pivot.position.copy(center);source.add(pivot);pivot.add(spin);
  parts.forEach(m=>{m.geometry.translate(-center.x,-center.y,-center.z);m.castShadow=true;spin.add(m);});
  return {pivot,spin,front:i<2,radius:(box.max.z-box.min.z)/2};
 });
 const steering=new THREE.Group();if(steeringParts.length){const box=new THREE.Box3();steeringParts.forEach(m=>box.union(m.geometry.boundingBox));const center=box.getCenter(new THREE.Vector3());steering.position.copy(center);for(const m of steeringParts){m.geometry.translate(-center.x,-center.y,-center.z);steering.add(m);}source.add(steering);}
 specs.collider={hx:size.x*scale*.47,hz:car.modelLength*.49,cx:0,cz:0};
 const updateDamage=damageVisuals(root,source,bodyParts,specs);
 onProgress(1);
 return {root,source,eye:new THREE.Vector3(...car.eye),paint,bodyMaterial:bodyParts[0].material,wheels,steering,lift:0,collider:specs.collider,mass:specs.mass,update(state,dt){updateDamage(state);for(const w of wheels){w.pivot.rotation.z=w.front?state.steer:0;w.spin.rotation.x-=state.speed/w.radius*dt;}steering.rotation.y=state.steer*9;}};
}
