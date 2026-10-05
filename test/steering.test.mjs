import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../public/vendor/three.module.min.js';
import {CARS,parseCar,carSpecs} from '../public/driving/catalog.js';
import {createState,step} from '../public/driving/physics.js';
import {updateJoeWheels} from '../public/driving/joe.js';
import {updateGltfWheels,GLTF_STEERING_AXES} from '../public/driving/gltf-vehicle.js';
import {splitP1Steering} from '../public/driving/p1-cockpit.js';

// Verify driver-visible movement after the real model mounting transforms.
// A positive local Euler angle alone says nothing about clockwise vs left.
for(const car of CARS)test(`${car.id}: cockpit and front wheels agree with vehicle steering in D and R`,async()=>{
 const config=parseCar(await readFile(new URL(`../public/vehicles/cars/${car.id}/${car.id}.car`,import.meta.url),'utf8'));
 const specs=carSpecs(config);
 for(const direction of [1,-1])for(const input of [1,-1]){
  const state=createState();state.direction=direction;state.speed=direction*4;
  for(let i=0;i<24;i++)step(state,{steer:input*.1,assists:false},specs,1/120);
  assert.ok(state.steer*input>0,'rack follows the requested steering direction');
  assert.ok(state.yaw*input*direction>0,'vehicle yaw reverses only when driving backward');
  const source=new THREE.Group();source.rotation.x=-Math.PI/2;
  const steering=new THREE.Group(),mount=new THREE.Group();source.add(mount);mount.add(steering);
  if(config.steering)mount.rotation.set(...config.steering.rotation.map(v=>v*Math.PI/180));
  const wheels=[true,true,false,false].map(front=>{const pivot=new THREE.Group(),spin=new THREE.Group();source.add(pivot);pivot.add(spin);return {pivot,spin,front,radius:.3};});
  if(car.format==='gltf')updateGltfWheels(wheels,steering,state,1/120,GLTF_STEERING_AXES[car.id]);
  else updateJoeWheels(wheels,steering,config.steering,specs.maxSteer,state,1/120);
  source.updateMatrixWorld(true);
  for(const wheel of wheels){
   const heading=new THREE.Vector3(0,1,0).transformDirection(wheel.pivot.matrixWorld);
   if(wheel.front)assert.ok(heading.x*input<0,'both front tires point toward the turn');
   else assert.equal(heading.x,0,'rear tires remain straight');
  }
  const rimTop=car.format==='gltf'?new THREE.Vector3(0,0,.18):new THREE.Vector3(0,.18,0);
  rimTop.applyMatrix4(steering.matrixWorld);
  assert.ok(rimTop.x*input<0,'top of cockpit wheel must move left for A, right for D, even in reverse');
 }
});

test('P1 separates the original wheel without dropping cabin triangles and keeps it in the default view',async()=>{
 const bytes=await readFile(new URL('../public/vehicles/cars/P1/model.glb',import.meta.url));
 const jsonLength=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.toString('utf8',20,20+jsonLength)),bin=bytes.subarray(28+jsonLength);
 const readAccessor=id=>{
  const a=gltf.accessors[id],v=gltf.bufferViews[a.bufferView],types={5123:Uint16Array,5125:Uint32Array,5126:Float32Array},Type=types[a.componentType];
  const count={SCALAR:1,VEC2:2,VEC3:3}[a.type],values=new Type(a.count*count),view=new DataView(bin.buffer,bin.byteOffset,bin.byteLength),stride=v.byteStride||count*Type.BYTES_PER_ELEMENT;
  for(let i=0;i<a.count;i++)for(let k=0;k<count;k++){const offset=(v.byteOffset||0)+(a.byteOffset||0)+i*stride+k*Type.BYTES_PER_ELEMENT;values[i*count+k]=a.componentType===5126?view.getFloat32(offset,true):a.componentType===5123?view.getUint16(offset,true):view.getUint32(offset,true);}
  return new THREE.BufferAttribute(values,count);
 };
 const primitive=gltf.meshes.flatMap(m=>m.primitives).find(p=>gltf.materials[p.material].name==='interior'),geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',readAccessor(primitive.attributes.POSITION));geometry.setIndex(readAccessor(primitive.indices));
 const parts=splitP1Steering(geometry);
 assert.equal(parts.interior.index.count+parts.steering.index.count,geometry.index.count,'all original triangles are preserved');
 assert.ok(parts.steering.attributes.position.count>500,'wheel, grips and buttons are included');
 assert.ok(parts.steering.boundingBox.max.x-parts.steering.boundingBox.min.x>.15,'both grips are present');
 const bounds=new THREE.Box3(),corner=new THREE.Vector3();
 const visit=(id,parent)=>{const node=gltf.nodes[id],local=new THREE.Matrix4();if(node.matrix)local.fromArray(node.matrix);else local.compose(new THREE.Vector3(...(node.translation||[0,0,0])),new THREE.Quaternion(...(node.rotation||[0,0,0,1])),new THREE.Vector3(...(node.scale||[1,1,1])));const matrix=new THREE.Matrix4().multiplyMatrices(parent,local);if(node.mesh!==undefined)for(const p of gltf.meshes[node.mesh].primitives){const a=gltf.accessors[p.attributes.POSITION];for(const x of [a.min[0],a.max[0]])for(const y of [a.min[1],a.max[1]])for(const z of [a.min[2],a.max[2]])bounds.expandByPoint(corner.set(x,y,z).applyMatrix4(matrix));}for(const child of node.children||[])visit(child,matrix);};
 for(const id of gltf.scenes[gltf.scene].nodes)visit(id,new THREE.Matrix4());
 const car=CARS.find(c=>c.id==='P1'),scale=car.modelLength/(bounds.max.z-bounds.min.z),centerZ=(bounds.min.z+bounds.max.z)/2;
 const toSource=new THREE.Matrix4().set(-scale,0,0,0,0,0,scale,-centerZ*scale,0,scale,0,-bounds.min.y*scale+.018,0,0,0,1);
 const wheel=parts.steering.applyMatrix4(toSource);wheel.computeBoundingBox();const center=wheel.boundingBox.getCenter(new THREE.Vector3());wheel.translate(-center.x,-center.y,-center.z);
 const source=new THREE.Group();source.rotation.x=-Math.PI/2;const steering=new THREE.Mesh(wheel);steering.position.copy(center);source.add(steering);
 const camera=new THREE.PerspectiveCamera(70,16/9,.05,100);camera.position.fromArray(car.eye);camera.lookAt(camera.position.clone().add(new THREE.Vector3(0,Math.sin(-.025),-Math.cos(-.025))));camera.updateMatrixWorld(true);
 for(const angle of [-.3,0,.3]){
  updateGltfWheels([],steering,{steer:angle},0,GLTF_STEERING_AXES.P1);source.updateMatrixWorld(true);
  for(let i=0;i<wheel.attributes.position.count;i++){const point=new THREE.Vector3().fromBufferAttribute(wheel.attributes.position,i).applyMatrix4(steering.matrixWorld).project(camera);assert.ok(Math.abs(point.x)<.85&&Math.abs(point.y)<.95&&point.z<1,'the whole turning wheel is inside the driving viewport');}
 }
});
