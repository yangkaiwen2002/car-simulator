import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {carSpecs,parseCar,CARS} from '../public/driving/catalog.js';
import {createState,step} from '../public/driving/physics.js';
import {axleForce,tireForces} from '../public/driving/tires.js';
const specs=Object.fromEntries(await Promise.all(CARS.map(async c=>[c.id,carSpecs(parseCar(await readFile(new URL(`../public/vehicles/cars/${c.id}/${c.id}.car`,import.meta.url),'utf8')))])));
function run(id,seconds,input,s=createState(),hz=120){for(let i=0;i<seconds*hz;i++)step(s,typeof input==='function'?input(i/hz,s):input,specs[id],1/hz);return s;}
function stop(id,extra={},damage=false){const s=createState();s.speed=100/3.6;if(damage)s.damage.brakes=1;run(id,12,{brake:1,...extra},s);return s;}

test('100–0 km/h stops in a calibrated dry-road range for all cars; W+S brakes identically',()=>{
 for(const id of Object.keys(specs)){const a=stop(id),b=stop(id,{throttle:1});assert.equal(a.speed,0,id);assert.ok((id==='RB19'?a.distance>17&&a.distance<24:a.distance>24&&a.distance<40),`${id}: ${a.distance.toFixed(2)} m`);assert.ok(Math.abs(a.distance-b.distance)<1e-9,id);assert.equal(b.throttle,0);assert.equal(b.brakeHold,true);}
});
test('partial brake is genuinely progressive; damaged brakes and grass lengthen stopping distance',()=>{
 const dry=stop('EF').distance;assert.ok(stop('EF',{brake:.4}).distance>dry*1.5);assert.ok(stop('EF',{},true).distance>dry*1.5);assert.ok(stop('EF',{offRoad:true}).distance>dry*1.5);
});
test('braking reverse motion and holding both pedals do not make the car change direction',()=>{
 const s=createState();s.direction=-1;s.speed=-12;run('P1',5,{brake:1,throttle:1},s);assert.equal(s.speed,0);const d=s.distance;run('P1',5,{brake:1,throttle:1},s);assert.equal(s.distance,d);
});
test('longitudinal and lateral forces share a combined tire budget',()=>{
 const args={forward:24,right:2,normalLoad:6000,nominalLoad:6000,mass:700,dt:1/120};const turn=axleForce(args),braking=axleForce({...args,brake:7000}),power=axleForce({...args,drive:9000});
 assert.ok(Math.abs(braking.right)<Math.abs(turn.right));assert.ok(Math.abs(power.right)<Math.abs(turn.right));assert.ok(Math.hypot(power.forward,power.right)<=power.limit+1e-7);
});
test('braking shifts load forward, acceleration shifts it rearward; downforce grows with speed',()=>{
 const p=specs.P1,s=createState(),input={grip:1,braking:1};s.speed=20;const a=tireForces(s,input,p,0,1/120);s.loadAcceleration=-9;const b=tireForces(s,input,p,0,1/120);s.loadAcceleration=6;const c=tireForces(s,input,p,0,1/120);
 assert.ok(b.frontLoad>a.frontLoad);assert.ok(c.rearLoad>a.rearLoad);s.speed=60;const fast=tireForces(s,input,p,0,1/120);assert.ok(fast.frontLoad+fast.rearLoad>a.frontLoad+a.rearLoad+2000);
});
test('default assists reduce full-throttle corner-exit wheelspin without changing the tire budget',()=>{
 const initial=()=>Object.assign(createState(),{speed:15});const a=run('EF',3,{throttle:1,steer:.6,assists:true},initial()),b=run('EF',3,{throttle:1,steer:.6,assists:false},initial());
 assert.ok(a.wheelspin<b.wheelspin);assert.ok(Math.abs(a.sideSpeed)<3);assert.ok(a.speed>b.speed+10);assert.ok(a.tractionCut>.05);
});
test('progressive throttle and unwinding steering make an unassisted RWD exit faster',()=>{
 const initial=()=>Object.assign(createState(),{speed:14});
 const full=run('EF',3,t=>({throttle:1,steer:Math.max(0,.5-t*.12),assists:false}),initial());
 const smooth=run('EF',3,t=>({throttle:Math.min(1,.2+t*.24),steer:Math.max(0,.5-t*.12),assists:false}),initial());
 assert.ok(smooth.speed>full.speed+3,`${smooth.speed} vs ${full.speed}`);assert.ok(Math.abs(smooth.rearSlip)<Math.abs(full.rearSlip));
});
test('late braking carries more speed into the corner and runs wider than braking early',()=>{
 function approach(point){const s=Object.assign(createState(),{x:0,z:140,speed:120/3.6});let ticks=0;while(s.z>0&&ticks++<3000)step(s,{brake:s.z<point&&s.speed>15?1:0},specs.EF,1/120);const entry=s.speed;run('EF',1,{steer:.75,assists:true},s);return {s,entry};}
 const early=approach(65),late=approach(15);assert.ok(late.entry>early.entry+10);assert.ok(late.s.z<early.s.z-5);assert.ok(Math.abs(late.s.yaw)<Math.abs(early.s.yaw));
});
test('120 Hz fixed integration keeps combined braking/steering independent of display frame rate',()=>{
 const controls=t=>({throttle:t<2?.65:0,brake:t>=2?.5:0,steer:.5});const a=run('REV',4,controls,createState(),30),b=run('REV',4,controls,createState(),120);assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.2);assert.ok(Math.abs(a.yaw-b.yaw)<.03);
});
test('slopes affect acceleration and coasting in the expected direction',()=>{
 const init=()=>Object.assign(createState(),{speed:20});const up=run('REV',3,{grade:.12},init()),down=run('REV',3,{grade:-.12},init());assert.ok(down.speed>up.speed+5);
});
