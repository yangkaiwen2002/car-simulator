import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CARS,parseCar,carSpecs} from '../public/driving/catalog.js';
import {createState,step} from '../public/driving/physics.js';
import {tireForces} from '../public/driving/tires.js';
const cars=await Promise.all(CARS.map(async c=>({id:c.id,p:carSpecs(parseCar(await readFile(new URL(`../public/vehicles/cars/${c.id}/${c.id}.car`,import.meta.url),'utf8')))})));
function drive(p,kph,seconds,controls){
 const s=Object.assign(createState(),{speed:kph/3.6,direction:Math.sign(kph)});let peakSlip=0,minRate=0,afterRelease=0;
 for(let i=0;i<seconds*120;i++){step(s,controls(i/120),p,1/120);peakSlip=Math.max(peakSlip,Math.abs(Math.atan2(s.sideSpeed,Math.max(Math.abs(s.speed),2))));if(i>=120)minRate=Math.min(minRate,s.yawRate);if(i===215)afterRelease=s.yawRate;}
 return {s,peakSlip,minRate,afterRelease};
}

test('road mode settles after a highway steering release without repeated fishtailing',()=>{
 for(const {id,p} of cars)for(const speed of [80,120,200]){
  const r=drive(p,speed,5,t=>({steer:t<1?1:0}));
  assert.ok(r.peakSlip<.16,`${id} ${speed}: excessive sideslip`);
  assert.ok(r.minRate>-.08,`${id}: opposite yaw overshoot`);
  assert.ok(Math.abs(r.afterRelease)<.04,`${id}: yaw must settle after release`);
  assert.ok(Math.abs(r.s.yawRate)<.005&&Math.abs(r.s.steer)<.005,id);
 }
});
test('road mode handles repeated keyboard direction changes and long full-lock corners',()=>{
 for(const {id,p} of cars){
  const slalom=drive(p,100,6,t=>({steer:t<4?(Math.floor(t/.4)%2?-1:1):0,throttle:.5}));
  assert.ok(slalom.peakSlip<.16,`${id}: slalom sideslip`);
  assert.ok(Math.abs(slalom.s.yawRate)<.05,`${id}: settle after slalom`);
  const corner=drive(p,120,8,()=>({steer:1,throttle:.5}));
  assert.ok(corner.peakSlip<.2&&corner.s.speed>0,`${id}: sustained corner spin`);
 }
});
test('road mode can brake hard during a turn without spinning around',()=>{
 for(const {id,p} of cars)for(const speed of [80,120,200]){
  const r=drive(p,speed,10,t=>({steer:t<1?1:0,brake:t>.6?1:0}));
  assert.ok(r.peakSlip<.28,`${id} ${speed}: braking spin`);assert.equal(r.s.speed,0,id);assert.equal(r.s.throttle,0,id);
 }
});
test('reverse steering assist uses reverse feedback and still returns to centre',()=>{
 for(const {id,p} of cars){const r=drive(p,-30,4,t=>({steer:t<1?1:0}));assert.ok(r.s.yaw<0,id);assert.ok(r.peakSlip<.55,id);assert.ok(Math.abs(r.s.yawRate)<.02,id);}
});
test('corner-aware ABS and traction control stay within both axle force budgets',()=>{
 for(const {id,p} of cars)for(const braking of [0,.5,1]){
  const s=Object.assign(createState(),{speed:25,steer:.12,yawRate:.25,sideSpeed:1,brakePressure:braking,loadAcceleration:-braking*8});
  const f=tireForces(s,{assisted:true,grip:1,braking:1},p,braking?0:12000,1/120);
  for(const axle of [f.front,f.rear])assert.ok(Math.hypot(axle.forward,axle.right)<=axle.limit+1e-6,id);
 }
});

// A speed-holding driver lets the test measure turning authority instead of
// mistaking deceleration for a tighter radius. No position or yaw is imposed.
function circle(p,kph,steer=1){
 const s=Object.assign(createState(),{speed:kph/3.6});let integral=0,entryYaw=0;
 for(let i=0;i<720;i++){
  const error=kph/3.6-s.speed;integral=Math.max(0,Math.min(1,integral+error/120*.15));
  step(s,{steer,throttle:Math.max(0,Math.min(1,error*.4+integral))},p,1/120);
  if(i===59)entryYaw=s.yaw;
 }
 return {s,entryYaw};
}
test('road mode can use available cornering grip instead of imposing premature understeer',()=>{
 for(const {id,p} of cars)for(const speed of [30,50,80,120]){
  const {s}=circle(p,speed),available=(p.tireGrip||1.08)*(9.81+(p.downforce||0)*s.speed*s.speed/p.mass),usage=s.speed*s.yawRate/available;
  assert.ok(usage>(speed===120?.76:.8),`${id} ${speed}: steering only uses ${(usage*100).toFixed(1)}% of available grip`);
  assert.ok(usage<1.06,`${id}: no artificial extra cornering force`);
  assert.ok(Math.abs(Math.atan2(s.sideSpeed,s.speed))<.16,`${id}: sustained corner remains controllable`);
 }
});
test('M4 turns in promptly while partial steering stays progressive',()=>{
 const p=cars.find(c=>c.id==='M4').p,full=circle(p,80),half=circle(p,80,.5);
 assert.ok(full.entryYaw>9.8*Math.PI/180,'first half-second responds to the driver');
 assert.ok(full.s.speed/full.s.yawRate<54,'full steering reaches an appropriately tight radius');
 assert.ok(half.s.yawRate>full.s.yawRate*.35&&half.s.yawRate<full.s.yawRate*.75,'partial steering is not an on/off snap');
});

test('all cars respond to a 100 ms steering press in both directions and driving modes',()=>{
 for(const {id,p} of cars)for(const assists of [true,false])for(const kph of [20,50,80,120])for(const direction of [-1,1]){
  const s=Object.assign(createState(),{speed:kph/3.6});
  for(let i=0;i<12;i++)step(s,{steer:direction,assists},p,1/120);
  // Normalize for each car's axle load and yaw inertia: a short press must
  // produce useful body rotation, not merely animate the steering wheel.
  const load=p.mass*9.81*p.rearAxle/p.wheelbase+(p.downforce||0)*(kph/3.6)**2*.42;
  const maximumYaw=load*p.tireGrip*p.frontAxle/p.yawInertia*.1**2/2;
  assert.ok(s.yaw*direction>maximumYaw*(assists?.5:.38),`${id} ${kph} ${assists}: short press lost in input smoothing`);
  assert.ok(s.steer*direction>0,`${id}: rack points toward input`);
 }
});
test('all cars promptly reverse the rack when A changes to D or D changes to A',()=>{
 for(const {id,p} of cars)for(const assists of [true,false])for(const kph of [20,50,80,120])for(const direction of [-1,1]){
  const s=Object.assign(createState(),{speed:kph/3.6});for(let i=0;i<36;i++)step(s,{steer:direction,assists},p,1/120);
  const deadline=assists?(kph===20?.15:.06):.25;
  for(let i=0;i<Math.ceil(deadline*120);i++)step(s,{steer:-direction,assists},p,1/120);
  assert.ok(s.steer*direction<0,`${id} ${kph} ${assists}: stale opposite steering after input changed`);
 }
});
test('holding throttle and steering remains controllable across the whole collection',()=>{
 for(const {id,p} of cars)for(const speed of [20,80,160]){
  const r=drive(p,speed,10,t=>({throttle:1,steer:t<8?1:0}));
  assert.ok(r.peakSlip<.35&&r.s.speed>0,`${id} ${speed}: full-power corner must not spin`);
  assert.ok(Math.abs(r.s.yawRate)<.03,`${id}: stable release after a full-power corner`);
 }
});
