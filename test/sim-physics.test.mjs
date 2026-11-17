import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {carSpecs,parseCar,CARS} from '../public/driving/catalog.js';
import {createState} from '../public/driving/physics.js';
import {stepSim,tireCurve,temperatureGrip,TIRE} from '../public/driving/sim-physics.js';
import {createRewind} from '../public/driving/rewind.js';
const specs=Object.fromEntries(await Promise.all(CARS.map(async c=>[c.id,carSpecs(parseCar(await readFile(new URL(`../public/vehicles/cars/${c.id}/${c.id}.car`,import.meta.url),'utf8')))])));
const H=1/120,run=(id,seconds,input,s=createState())=>{for(let i=0;i<seconds*120;i++)stepSim(s,typeof input==='function'?input(i/120,s):input,specs[id],H);return s;};
const moving=(v,extra={})=>Object.assign(createState(),{speed:v},extra);
function stop(id,extra={}){const s=run(id,.5,{throttle:.3},moving(100/3.6)),from=s.distance;let locked=0,n=0;while(Math.abs(s.speed)>.1&&n++<2400){stepSim(s,{brake:1,...extra},specs[id],H);if(s.lockup)locked++;}return {distance:s.distance-from,locked:locked/n,yaw:s.yaw};}

test('tire curve peaks at the limit and gives up grip when sliding; temperature has a working window',()=>{
 assert.ok(Math.abs(tireCurve(1)-1)<.01);assert.ok(tireCurve(.5)<tireCurve(1));assert.ok(tireCurve(4)<.9&&tireCurve(4)>.7);
 assert.equal(temperatureGrip(TIRE.road.optimum,TIRE.road),1);assert.ok(temperatureGrip(30,TIRE.road)<.9);assert.ok(temperatureGrip(150,TIRE.road)<.8);
});
test('every car is stable at rest, accelerates, and stops straight from 100 km/h in a plausible distance',()=>{
 for(const id of Object.keys(specs)){
  const rest=run(id,3,{steer:1});assert.ok(Math.abs(rest.speed)<.01&&Math.abs(rest.yawRate)<.01,id+' rest');
  const go=run(id,6,{throttle:1,tc:true});assert.ok(go.speed>12&&Number.isFinite(go.rpm),`${id} accelerates ${go.speed}`);assert.ok(Math.abs(go.yaw)<.05,id+' launches straight');
  const b=stop(id,{abs:true});assert.ok(b.distance>12&&b.distance<45,`${id} stop ${b.distance.toFixed(1)} m`);assert.ok(Math.abs(b.yaw)<.05,id+' stops straight');
 }
});
test('without ABS a full stop locks the wheels and takes longer; ABS keeps them turning',()=>{
 const raw=stop('M4'),abs=stop('M4',{abs:true});assert.ok(raw.locked>.5);assert.ok(abs.locked<.1);assert.ok(raw.distance>abs.distance+2,`${raw.distance} vs ${abs.distance}`);
});
test('cornering grip is near 1 g for a road car and far higher with downforce; outside tires carry the load',()=>{
 const peak=(id,v)=>{const s=moving(v);let g=0;for(let i=0;i<5*120;i++){stepSim(s,{steer:Math.min(1,i/60)*.5,throttle:.12},specs[id],H);if(i>180)g=Math.max(g,Math.abs(s.lateral)/9.81);}return {g,s};};
 const road=peak('M4',22),formula=peak('RB19',40);assert.ok(road.g>.85&&road.g<1.2,`M4 ${road.g}`);assert.ok(formula.g>1.5,`RB19 ${formula.g}`);
 const load=road.s.sim.load;assert.ok(load[1]>load[0]*2&&load[3]>load[2]*2,'left turn loads the right-hand tires');
 assert.ok(Math.abs(Math.atan2(road.s.sideSpeed,road.s.speed))<.2,'steady cornering does not spin');
});
test('full throttle from rest spins the driven wheels; traction control and lifting contain it',()=>{
 const wild=run('EF',1.5,{throttle:1}),tamed=run('EF',1.5,{throttle:1,tc:true});
 assert.ok(wild.wheelspin>.6,`spin ${wild.wheelspin}`);assert.ok(tamed.tractionCut>0||tamed.wheelspin<wild.wheelspin);assert.ok(tamed.speed>wild.speed);
 const early=run('EF',.5,{throttle:1});assert.ok(early.sim.omega[2]*specs.EF.radius>early.speed*1.3,`rear wheels turn faster than the road: ${early.sim.omega[2]*specs.EF.radius} vs ${early.speed}`);
});
test('too much power mid-corner breaks the rear loose in a powerful rear-drive car',()=>{
 const s=run('RB19',4,(t)=>({steer:Math.min(1,t*2)*.5,throttle:.6}),moving(22));
 assert.ok(Math.abs(Math.atan2(s.sideSpeed,Math.max(Math.abs(s.speed),1)))>.5||Math.abs(s.yaw)>2.5,'expected a spin');
});
test('sliding heats the tires; reverse gear and rewind snapshots work with the wheel state',()=>{
 const cold=run('M4',2,{throttle:.3},moving(20)),hot=run('M4',6,(t)=>({steer:1,throttle:1}),moving(20));
 assert.ok(Math.max(...hot.sim.temp)>Math.max(...cold.sim.temp)+8,`${hot.sim.temp} vs ${cold.sim.temp}`);
 const back=createState();back.direction=-1;run('M4',3,{throttle:.5},back);assert.ok(back.speed<-2);
 const rewind=createRewind(),s=run('M4',1,{throttle:1});rewind.record(s,1);const kept=[...s.sim.omega];run('M4',1,{throttle:1},s);rewind.record(s,1);rewind.scrub(s,.1);assert.deepEqual(s.sim.omega,kept);
});
