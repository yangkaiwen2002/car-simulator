import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBody,createCollisionWorld,contact} from '../public/driving/collision.js';
const energy=b=>b.mass*(b.vx*b.vx+b.vz*b.vz)/2+(b.invInertia?b.yawRate*b.yawRate/(2*b.invInertia):0);
const tick=(world,b,seconds,hz=120)=>{let impact;for(let i=0;i<seconds*hz;i++)impact=world.advance(b,1/hz)||impact;return impact;};
function car(extra={}){return createBody({x:0,z:5,hx:.9,hz:2,mass:1300,...extra});}

test('rotated narrow gaps use oriented shapes rather than expanded axis-aligned boxes',()=>{
 const a=car({x:0,z:0,yaw:Math.PI/4});const b=createBody({x:1.95,z:1.95,hx:.12,hz:.12});assert.equal(contact(a,b),null);
 assert.ok(contact(a,createBody({x:1.2,z:1.2,hx:.4,hz:.4})));
});
test('head-on impact stops penetration and rebounds without spurious spin',()=>{
 const world=createCollisionWorld([{x:0,z:0,hx:20,hz:.2,kind:'wall'}]),a=car({vz:-20});const hit=tick(world,a,.4);
 assert.ok(hit?.speed>=19);assert.ok(a.z>2.19);assert.ok(a.vz>0&&a.vz<3);assert.ok(Math.abs(a.yawRate)<.02);assert.ok(energy(a)<1300*400/2);
});
test('high-speed and reverse movement cannot tunnel through a thin pole or barrier',()=>{
 for(const sign of [-1,1]){const world=createCollisionWorld([{x:0,z:0,hx:15,hz:.045}]),a=car({z:-sign*4,vz:sign*95});tick(world,a,.2,30);assert.ok(sign*a.z< -2.04);assert.ok(sign*a.vz<=0);}
 const world=createCollisionWorld([{x:.5,z:0,hx:.07,hz:.07}]),a=car({vz:-95});assert.ok(tick(world,a,.1,30));
});
test('off-center parked-car collision transfers momentum and angular motion',()=>{
 const world=createCollisionWorld(),b=world.addDynamic({x:.85,z:0,hx:.9,hz:2,mass:900,kind:'parked'}),a=car({z:5,vz:-16});const before=energy(a);const hit=tick(world,a,.2);
 assert.ok(hit);assert.ok(b.vz< -2);assert.ok(b.z<0);assert.ok(Math.abs(a.yawRate)+Math.abs(b.yawRate)>.1);assert.ok(energy(a)+energy(b)<before*1.01);
});
test('glancing wall contact preserves tangential movement instead of freezing the car',()=>{
 const world=createCollisionWorld([{x:0,z:0,hx:.2,hz:30}]),a=car({x:2,z:8,vx:-4,vz:-15});tick(world,a,.5);assert.ok(a.x>=1.09);assert.ok(a.z<3);assert.ok(Math.abs(a.vz)>8);
});
test('repeated full-throttle wall pressure remains stable and permits reversing away',()=>{
 const world=createCollisionWorld([{x:0,z:0,hx:30,hz:.2}]),a=car({z:2.2});for(let i=0;i<600;i++){a.vz-=.05;world.advance(a,1/120);}assert.ok(a.z>2.19);assert.ok(Math.abs(a.vz)<1);a.vz=2;tick(world,a,1);assert.ok(a.z>4);
});
test('two-wall corner does not create kinetic energy or non-finite state',()=>{
 const world=createCollisionWorld([{x:0,z:0,hx:20,hz:.2},{x:0,z:0,hx:.2,hz:20}]),a=car({x:4,z:5,vx:-20,vz:-20,yaw:.2});const before=energy(a);tick(world,a,1);
 for(const key of ['x','z','vx','vz','yaw','yawRate'])assert.ok(Number.isFinite(a[key]),key);assert.ok(energy(a)<before*1.01);assert.ok(a.x>0&&a.z>0);
});
test('collision result remains close at 30, 60 and 120 Hz',()=>{
 const runs=[30,60,120].map(hz=>{const world=createCollisionWorld([{x:0,z:0,hx:20,hz:.1}]),a=car({vz:-35});tick(world,a,.6,hz);return a;});
 for(const a of runs){assert.ok(Math.abs(a.vz-runs[2].vz)<.2);assert.ok(Math.abs(a.z-runs[2].z)<.2);}
});
test('different widths and lengths contact at their physical front corners',()=>{
 for(const [hx,hz] of [[.72,1.55],[1.12,2.36]]){const world=createCollisionWorld([{x:0,z:0,hx:30,hz:.1}]),a=car({hx,hz,vz:-10});tick(world,a,.5);assert.ok(a.z>=hz+.095);}
});
test('touching bodies moving apart are not pulled back together',()=>{
 const world=createCollisionWorld([{x:0,z:0,hx:20,hz:.2}]),a=car({z:2.199,vz:4});world.advance(a,1/120);assert.equal(a.vz,4);
});
