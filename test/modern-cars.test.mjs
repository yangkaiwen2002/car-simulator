import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CARS,carsInCollection,parseCar,carSpecs} from '../public/driving/catalog.js';

test('modern collection uses represented model years and keeps classics accessible',()=>{
 const modern=carsInCollection();assert.deepEqual(modern.map(c=>[c.id,c.year]),[['REV',2023],['M4',2021]]);
 assert.ok(modern.every(c=>c.year>=2021&&c.year<=2026));
 assert.equal(carsInCollection('classic').length+modern.length,CARS.length);
 assert.equal(new Set(carsInCollection('all').map(c=>c.id)).size,CARS.length);
 assert.ok(carsInCollection('classic').some(c=>c.id==='P1'));
});

test('G82 retains source triangles, separate original wheel, four road wheels and calipers',async()=>{
 const base=new URL('../public/vehicles/cars/M4/',import.meta.url),g=JSON.parse(await readFile(new URL('scene.gltf',base))),bin=await readFile(new URL('model.bin',base));
 assert.equal(bin.length,g.buffers[0].byteLength);assert.ok(bin.length<60_000_000);
 assert.equal(g.meshes.reduce((sum,m)=>sum+m.primitives.reduce((sum,p)=>sum+g.accessors[p.indices].count/3,0),0),1492320);
 const wheels=[0,0,0,0],calipers=[0,0,0,0];let steeringTriangles=0;
 for(const node of g.nodes){for(const p of g.meshes[node.mesh].primitives){const a=g.accessors[p.attributes.POSITION],v=g.bufferViews[a.bufferView],pos=new Float32Array(bin.buffer,bin.byteOffset+(v.byteOffset||0)+(a.byteOffset||0),a.count*3);
  if(node.name.startsWith('Steering_')){steeringTriangles+=g.accessors[p.indices].count/3;assert.ok(a.min[0]>.19&&a.max[0]<.59);assert.ok(a.min[1]>.70&&a.max[1]<1.06);assert.ok(a.min[2]>.30&&a.max[2]<.49);}
  if(/^(Wheel|Caliper)_/.test(node.name))for(let i=0;i<pos.length;i+=3){const index=(pos[i+2]>0?0:2)+(pos[i]<0?1:0);(node.name.startsWith('Wheel_')?wheels:calipers)[index]++;}
 }}
 assert.equal(steeringTriangles,15789);assert.ok(wheels.every(n=>n>1000));assert.ok(calipers.every(n=>n>100));
 const p=carSpecs(parseCar(await readFile(new URL('M4.car',base),'utf8')));assert.equal(p.drive,'RWD');assert.equal(p.power,375);assert.equal(p.peakTorque,650);assert.equal(p.gears.length,8);assert.ok(Math.abs(p.wheelbase-2.857)<1e-6);
});
