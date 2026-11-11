import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildRoute} from '../public/driving/circuit-data.js';
import {carSpecs,parseCar} from '../public/driving/catalog.js';
const three=new URL('../public/vendor/three.module.min.js',import.meta.url);
test('driving line slows for corners, brakes ahead of them and lets downforce cars go faster',async()=>{
 await import(three);const {computeLine,lineTone,LINE_TOP_SPEED}=await import('../public/driving/driving-line.js');
 const route=buildRoute(JSON.parse(await readFile(new URL('../public/circuits/monza.geojson',import.meta.url),'utf8')));
 const specs=async id=>carSpecs(parseCar(await readFile(new URL(`../public/vehicles/cars/${id}/${id}.car`,import.meta.url),'utf8')));
 const road=computeLine(route,await specs('M4'),6),formula=computeLine(route,await specs('RB19'),6);
 const min=Math.min(...road.speed),max=Math.max(...road.speed);assert.ok(min>8&&min<30,`slowest corner ${min}`);assert.ok(max>100&&max<=LINE_TOP_SPEED,`straight ${max}`);
 // No point demands more deceleration than roughly 1.5 g to reach the next one.
 for(let i=0;i<road.speed.length;i++){const next=road.speed[(i+1)%road.speed.length],len=route.segments[i].len;assert.ok((road.speed[i]**2-next**2)/(2*len)<15,`decel at ${i}`);}
 assert.ok(formula.speed.reduce((a,b)=>a+b)/formula.speed.length>road.speed.reduce((a,b)=>a+b)/road.speed.length);
 assert.ok(Math.max(...road.offset.map(Math.abs))<=6-1.7+1e-6);
 assert.equal(lineTone(50,40),'brake');assert.equal(lineTone(39,40),'ease');assert.equal(lineTone(20,40),'go');
});
