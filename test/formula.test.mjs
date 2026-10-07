import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {carSpecs,parseCar} from '../public/driving/catalog.js';
import {createState,step} from '../public/driving/physics.js';
import {tireForces} from '../public/driving/tires.js';
const p=carSpecs(parseCar(await readFile(new URL('../public/vehicles/cars/RB19/RB19.car',import.meta.url),'utf8')));
function circle(kph,params=p){const s=Object.assign(createState(),{speed:kph/3.6});let integral=0;for(let i=0;i<720;i++){const e=kph/3.6-s.speed;integral=Math.max(0,Math.min(1,integral+e/120*.15));step(s,{steer:1,throttle:Math.max(0,Math.min(1,e*.4+integral))},params,1/120);}return s;}
test('RB19 downforce adds axle load quadratically and disappears at rest',()=>{
 const load=v=>{const s=Object.assign(createState(),{speed:v});const f=tireForces(s,{grip:1,braking:1,assisted:true},p,0,1/120);return f.frontLoad+f.rearLoad;};
 assert.ok(Math.abs(load(0)-p.mass*9.81)<1e-8);assert.ok(Math.abs((load(60)-load(0))/(load(30)-load(0))-4)<1e-8);
});
test('RB19 high-speed cornering comes from aero, with controllable release',()=>{
 const slow=circle(120),fast=circle(200),bare=circle(200,{...p,downforce:0});
 assert.ok(slow.speed*slow.yawRate/9.81>2);assert.ok(fast.speed*fast.yawRate/9.81>3);
 assert.ok(fast.speed*fast.yawRate>bare.speed*bare.yawRate*1.7);
 for(let i=0;i<240;i++)step(fast,{},p,1/120);assert.ok(Math.abs(fast.yawRate)<.02);
});
test('RB19 compressed asset preserves original attribution and separately riggable parts',async()=>{
 const b=await readFile(new URL('../public/vehicles/cars/RB19/model.glb',import.meta.url));const j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
 assert.match(j.asset.extras.author,/Redgrund/);assert.match(j.asset.extras.license,/CC-BY-4.0/);
 for(const name of ['body','wheel_FL','wheel_FR','wheel_RL','wheel_RR','steering_wheel'])assert.ok(j.nodes.some(n=>n.name===name));
});
const w33=carSpecs(parseCar(await readFile(new URL('../public/vehicles/cars/W33/W33.car',import.meta.url),'utf8')));
test('W33 has precisely 90% more configured power, torque and downforce than RB19',()=>{
 assert.equal(w33.power,p.power*1.9);assert.ok(Math.abs(w33.downforce/p.downforce-1.9)<1e-10);
 w33.torque.forEach((point,i)=>assert.ok(Math.abs(point[1]/p.torque[i][1]-1.9)<1e-10));
});
test('W33 is much faster on the straight and sustains stable high-speed cornering',()=>{
 const top=params=>{const s=createState();for(let i=0;i<10800;i++)step(s,{throttle:1},params,1/120);return s.speed*3.6;};
 const baseline=top(p),galaxy=top(w33);assert.ok(galaxy>baseline*1.3&&galaxy>410&&galaxy<450);
 for(const kph of [120,200,300]){const s=circle(kph,w33),old=circle(kph,p);assert.ok(s.speed*s.yawRate>old.speed*old.yawRate*1.25);assert.ok(Math.abs(Math.atan2(s.sideSpeed,s.speed))<.1);
  for(let i=0;i<360;i++)step(s,{},w33,1/120);assert.ok(Math.abs(s.yawRate)<.03);}
});
