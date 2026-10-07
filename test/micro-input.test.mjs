import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CARS,carSpecs,parseCar} from '../public/driving/catalog.js';
import {createState,step} from '../public/driving/physics.js';
import {shapeDigitalInput} from '../public/driving/driver-input.js';
const cars=await Promise.all(CARS.map(async c=>({id:c.id,p:carSpecs(parseCar(await readFile(new URL(`../public/vehicles/cars/${c.id}/${c.id}.car`,import.meta.url),'utf8')))})));
function run(p,duration,input,hz=120){const s=Object.assign(createState(),{speed:80/3.6});for(let i=0;i<duration*hz;i++)step(s,input,p,1/hz);return s;}
test('every car has useful but gentler digital micro taps; precision provides a finer correction',()=>{
 for(const {id,p} of cars)for(const assists of [true,false]){
 const normal=run(p,.1,{steer:1,assists}),tap=run(p,.1,{steer:1,digital:true,assists}),fine=run(p,.1,{steer:1,digital:true,precision:true,assists});
 assert.ok(tap.yaw>0&&tap.yaw<normal.yaw*.85,`${id}: useful gentle tap`);assert.ok(fine.yaw>0&&fine.yaw<tap.yaw*.8,`${id}: precision tap`);
 for(let i=0;i<240;i++)step(tap,{digital:true,assists},p,1/120);assert.ok(Math.abs(tap.yawRate)<.03,`${id}: clean release`);
 }
});
test('long keyboard holds keep full authority; opposite taps restart gently without stale direction',()=>{
 for(const {id,p} of cars){const s=createState();let input;for(let i=0;i<60;i++)input=shapeDigitalInput(s,{steer:1},p,1/120);assert.equal(input.steer,1,id);input=shapeDigitalInput(s,{steer:-1},p,1/120);assert.ok(input.steer<0&&input.steer>-.4,id);shapeDigitalInput(s,{steer:0},p,1/120);assert.equal(s.keyHeld,0);}
});
test('digital control is frame-rate independent and full braking still overrides held throttle',()=>{
 for(const {id,p} of cars){const a=run(p,.3,{steer:1,digital:true},60),b=run(p,.3,{steer:1,digital:true},120);assert.ok(Math.abs(a.yaw-b.yaw)<1e-9,id);const stop=run(p,8,{digital:true,throttle:1,brake:1});assert.equal(stop.speed,0,id);assert.equal(stop.throttle,0,id);}
});
test('digital throttle releases smoothly to exact zero and a brake press cuts power immediately',()=>{
 for(const {id,p} of cars){const s=run(p,1,{throttle:1,digital:true});step(s,{digital:true},p,1/120);assert.ok(s.throttle>0&&s.throttle<1,id);for(let i=0;i<60;i++)step(s,{digital:true},p,1/120);assert.equal(s.throttle,0,id);step(s,{throttle:1,digital:true},p,1/120);step(s,{throttle:1,brake:1,digital:true},p,1/120);assert.equal(s.throttle,0,id);}
});
