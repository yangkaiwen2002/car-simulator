import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildRoute,createLapTimer,formatLap,CIRCUITS} from '../public/driving/circuit-data.js';
import {createDamage,applyImpact,performance} from '../public/driving/damage.js';
import {createBody,createCollisionWorld} from '../public/driving/collision.js';
const routes=await Promise.all(CIRCUITS.map(async c=>buildRoute(JSON.parse(await readFile(new URL(`../public/circuits/${c.id}.geojson`,import.meta.url),'utf8')))));
function feed(timer,route,from,to,speed=40){const dt=1/120;for(let d=from;d<to;d+=speed*dt){const p=route.at(d);timer.update(p.x,p.z,dt);}}
test('all circuits preserve projected real coordinates and scale',()=>{
 routes.forEach((route,i)=>{assert.ok(Math.abs(route.length-CIRCUITS[i].length)<CIRCUITS[i].length*.025,`${CIRCUITS[i].id}: ${route.length}`);assert.ok(route.segments.every(s=>s.len>0&&s.len<=7.01));const p=route.at(850);assert.ok(route.nearest(p.x,p.z).distance<1e-7);assert.ok(Math.abs(route.nearest(p.x,p.z).progress-850)<.001);});
});
test('a clean full lap records interpolated time and three sectors',()=>{
 for(const route of routes){const results=[],t=createLapTimer(route,6,r=>results.push(r));feed(t,route,-35,route.length+4);assert.equal(results.length,1);assert.equal(results[0].valid,true);assert.ok(Math.abs(results[0].time-route.length/40)<.02);assert.equal(results[0].sectors.length,3);assert.ok(Math.abs(results[0].sectors.reduce((a,b)=>a+b,0)-results[0].time)<1e-6);assert.equal(t.lap,2);}
});
test('cutting outside the track invalidates a lap and never becomes a best',()=>{
 const route=routes[0],t=createLapTimer(route,6);feed(t,route,-35,100);const p=route.at(100);t.update(p.x+p.tz*25,p.z-p.tx*25,1/120);feed(t,route,100,route.length+4);assert.equal(t.last.valid,false);assert.equal(t.last.reason,'驶出赛道过远或过久');assert.equal(t.best,null);
});
test('skipped checkpoints, teleporting and reversing the start line cannot earn a lap',()=>{
 const route=routes[0],t=createLapTimer(route,6);feed(t,route,-35,50);feed(t,route,route.length-30,route.length+4);assert.equal(t.last.valid,false);assert.equal(t.best,null);
 const reverse=createLapTimer(route,6);for(let d=5;d>-10;d-=.2){const p=route.at(d);reverse.update(p.x,p.z,1/120);}assert.equal(reverse.lap,0);assert.equal(reverse.last,null);
});
test('reset starts a new session; paused timer only advances with simulation steps',()=>{
 const route=routes[0],t=createLapTimer(route,6);feed(t,route,-35,40);const time=t.time;assert.equal(t.time,time);const fresh=createLapTimer(route,6);assert.equal(fresh.start,null);assert.equal(fresh.last,null);assert.equal(formatLap(65.432),'1:05.432');assert.equal(formatLap(59.9996),'1:00.000');
});
test('low-energy taps do not disable a car; damage reduces distinct systems',()=>{
 const s={yaw:0,damage:createDamage()},p={mass:1200,engineLocation:'front'};applyImpact(s,p,{deltaV:.3,energy:20,normal:{x:0,z:1}});assert.equal(s.damage.revision,0);
 applyImpact(s,p,{deltaV:14,energy:120000,normal:{x:0,z:1}});assert.ok(s.damage.front>.4);assert.equal(s.damage.exploded,false);const perf=performance(s.damage);assert.ok(perf.power<.8);assert.ok(perf.braking<1);assert.ok(perf.steerResponse<1);
});
test('glancing contact damages the struck side and creates alignment pull',()=>{
 const s={yaw:0,damage:createDamage()};applyImpact(s,{mass:1300},{deltaV:8,energy:50000,normal:{x:1,z:0}});assert.ok(s.damage.left>0);assert.equal(s.damage.front,0);assert.ok(performance(s.damage).steerBias>0);
});
test('extreme impact disables propulsion and triggers a one-way accident effect until repair',()=>{
 const s={yaw:0,damage:createDamage()},p={mass:1200};applyImpact(s,p,{deltaV:32,energy:550000,normal:{x:0,z:1}});assert.equal(s.damage.exploded,true);assert.equal(performance(s.damage).power,0);s.damage=createDamage();assert.equal(performance(s.damage).power,1);assert.equal(s.damage.exploded,false);
});
test('actual solver reports impact energy and speed, with stronger impacts causing more damage',()=>{
 const crashes=[5,18,35].map(speed=>{const w=createCollisionWorld([{x:0,z:0,hx:30,hz:.2}]),b=createBody({x:0,z:2.21,hx:.9,hz:2,mass:1200,vz:-speed}),hit=w.advance(b,1/30);assert.ok(hit.energy>0);assert.ok(hit.deltaV>0);const s={yaw:0,damage:createDamage()};applyImpact(s,{mass:1200,engineLocation:'front'},hit);return s.damage;});assert.ok(crashes[1].front>crashes[0].front);assert.equal(crashes[0].exploded,false);assert.equal(crashes[2].exploded,true);
});

test('Nordschleife is the full north loop with continuous, finite terrain heights',()=>{
 const r=routes[CIRCUITS.findIndex(c=>c.id==='nordschleife')];assert.ok(r.length>20500&&r.length<21000);assert.ok(Math.max(...r.points.map(p=>p.y))-Math.min(...r.points.map(p=>p.y))>270);
 assert.ok(r.segments.every(s=>Number.isFinite(s.grade)&&Math.abs(s.grade)<.4));const a=r.at(.001),b=r.at(r.length-.001);assert.ok(Math.abs(a.y-b.y)<.01);
});

test('brief run-wide recovers, but sustained excursions and reversing delete the lap',()=>{
 const route=routes[1];
 function excursion(seconds){const t=createLapTimer(route,6);feed(t,route,-35,100);for(let i=0;i<seconds*120;i++){const p=route.at(100+i/120*20),offset=8*Math.min(1,i/12,(seconds*120-1-i)/12);t.update(p.x+p.tz*offset,p.z-p.tx*offset,1/120);}const p=route.at(100+seconds*20);t.update(p.x,p.z,1/120);return t;}
 assert.equal(excursion(.4).valid,true);assert.equal(excursion(1.5).valid,true);assert.equal(excursion(2.5).valid,false);
 const t=createLapTimer(route,6);feed(t,route,-35,100);for(let d=100;d>95;d-=.2){const p=route.at(d);t.update(p.x,p.z,1/120);}assert.equal(t.valid,false);assert.equal(t.reason,'逆向行驶');
});
test('split comparisons and live delta use the previous valid lap, never fabricated scores',async()=>{
 const {timingView,sectorStatus}=await import('../public/driving/circuit-data.js');
 const route=routes[1],t=createLapTimer(route,6);feed(t,route,-35,route.length+4,40);
 assert.equal(t.best.trace.length,61);assert.equal(timingView(t).hold,true);
 assert.equal(timingView(t).sectors.length,3);assert.ok(timingView(t).sectors.every(s=>s.status==='baseline'));
 feed(t,route,4,route.length*.4,42);assert.ok(t.delta<0);assert.equal(timingView(t).sectors[0].status,'purple');
 assert.equal(sectorStatus(25,0,{sectors:[27]},[24]),'green');assert.equal(sectorStatus(28,0,{sectors:[27]},[24]),'yellow');assert.equal(sectorStatus(23,0,{sectors:[27]},[24],false),'invalid');
 const best=t.best; t.invalidate('测试无效圈');feed(t,route,route.length*.4,route.length+4,42);assert.equal(t.best,best);assert.equal(t.last.valid,false);
});
test('crossing time is interpolated consistently at 30 Hz and 120 Hz',()=>{
 const route=routes[1];const run=hz=>{const t=createLapTimer(route,6);for(let d=-35;d<route.length+4;d+=40/hz){const p=route.at(d);t.update(p.x,p.z,1/hz);}return t.last;};
 const a=run(30),b=run(120);assert.ok(a.valid&&b.valid);assert.ok(Math.abs(a.time-b.time)<.002);a.sectors.forEach((s,i)=>assert.ok(Math.abs(s-b.sectors[i])<.002));
});

test('wide Red Bull Ring accepts the whole road through tight apex projection changes',()=>{
 const index=CIRCUITS.findIndex(c=>c.id==='redbullring'),route=routes[index],width=CIRCUITS[index].halfWidth;
 // Follow the exact mitered road ribbon used by the renderer, not a centreline.
 const normals=route.points.map((p,i)=>{const a=route.segments[(i+route.points.length-1)%route.points.length],b=route.segments[i];let x=a.tz+b.tz,z=-a.tx-b.tx;const len=Math.hypot(x,z);x/=len;z/=len;const k=Math.min(2,1/Math.max(.5,x*b.tz-z*b.tx));return {x:x*k,z:z*k};});
 for(const offset of [-7,-4,4,7])for(const speed of [40,110]){
 const timer=createLapTimer(route,width);let previous;
 for(let d=-35;d<route.length+5;d+=.4){const at=route.at(d),i=route.segments.findIndex(s=>s.start+s.len>=at.progress),seg=route.segments[i],u=(at.progress-seg.start)/seg.len,a=normals[i],b=normals[(i+1)%normals.length];const p={x:at.x+offset*(a.x+(b.x-a.x)*u),z:at.z+offset*(a.z+(b.z-a.z)*u)};timer.update(p.x,p.z,previous?Math.hypot(p.x-previous.x,p.z-previous.z)/speed:0);previous=p;}
 assert.ok(timer.last?.valid,`${offset} m / ${speed} m/s: ${timer.last?.reason}`);assert.equal(timer.last.sectors.length,3);assert.equal(timer.last.trace.length,61);assert.ok(Math.abs(timer.last.sectors.reduce((a,b)=>a+b,0)-timer.last.time)<1e-6);
 }
});
