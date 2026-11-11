import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {carSpecs,parseCar} from '../public/driving/catalog.js';
import {createState,step,shiftGear} from '../public/driving/physics.js';
import {createSkillTracker,multiplierFor,skillName,CHAIN_WINDOW} from '../public/driving/skills.js';
import {createCareer,levelFor,parseCareer} from '../public/driving/progress.js';
import {STUNTS,MAX_STARS,starsFor,crossing,createStuntTracker} from '../public/driving/stunts.js';
import {createRewind} from '../public/driving/rewind.js';
import {shapeAxis,createGamepad} from '../public/driving/gamepad.js';
const load=async id=>carSpecs(parseCar(await readFile(new URL(`../public/vehicles/cars/${id}/${id}.car`,import.meta.url),'utf8')));
const M4=await load('M4');
const slipOf=s=>Math.abs(Math.atan2(s.sideSpeed,Math.max(Math.abs(s.speed),1)));
function drive(phases,base,v0=25){const s=Object.assign(createState(),{speed:v0}),log=[];for(const [seconds,input] of phases){for(let i=0;i<seconds*120;i++)step(s,{digital:true,...base,...input},M4,1/120);log.push(slipOf(s));}return {s,log};}

test('sport mode holds a handbrake drift while steering and throttle are held, then recovers',()=>{
 const phases=[[.6,{steer:1,handbrake:true}],[3,{steer:1,throttle:1}],[2,{steer:0,throttle:.5}]];
 const sport=drive(phases,{assists:true,sport:true}),casual=drive(phases,{assists:true});
 assert.ok(sport.log[1]>.3&&sport.log[1]<.75,`held angle ${sport.log[1]}`);assert.ok(sport.log[2]<.06,'straightens after release');
 assert.ok(casual.log[1]<.12,'full assists stay gripped');
});
test('sport mode corners like full assists when the handbrake is not used',()=>{
 const sport=drive([[4,{steer:1,throttle:1}]],{assists:true,sport:true}).s,casual=drive([[4,{steer:1,throttle:1}]],{assists:true}).s;
 assert.ok(slipOf(sport)<.15);assert.ok(Math.abs(sport.speed-casual.speed)<4);
});
test('manual gearbox holds the gear, shifts on request and refuses an over-rev downshift',()=>{
 const s=createState();for(let i=0;i<120*8;i++)step(s,{throttle:1,manual:true},M4,1/120);assert.equal(s.gear,1);
 assert.equal(shiftGear(s,M4,1),true);assert.equal(s.gear,2);assert.equal(shiftGear(s,M4,1),false,'mid-shift');
 const fast=Object.assign(createState(),{speed:70,gear:6});assert.equal(shiftGear(fast,M4,-5),false);assert.equal(fast.gear,6);
 const reverse=Object.assign(createState(),{direction:-1});assert.equal(shiftGear(reverse,M4,1),false);
});
test('skills chain, raise the multiplier, bank after a quiet window and are lost in a crash',()=>{
 const events=[],tracker=createSkillTracker((type,e)=>events.push([type,e]));
 const run=(seconds,t)=>{for(let i=0;i<seconds*60;i++)tracker.update(1/60,{speed:0,slip:0,wheelspin:0,impact:0,...t});};
 run(2,{speed:20,slip:.5});assert.equal(tracker.view().active.name,'漂移');run(.6,{speed:20});
 assert.equal(events[0][0],'skill');const first=events[0][1].points;assert.ok(first>150);
 run(1.5,{speed:60});run(.5,{speed:20});assert.equal(tracker.view().count,2);assert.equal(tracker.view().multiplier,2);
 run(CHAIN_WINDOW+.2,{speed:20});const bank=events.find(e=>e[0]==='bank')[1];assert.equal(bank.multiplier,2);assert.equal(bank.total,Math.round(bank.score*2));assert.equal(tracker.view().idle,true);
 run(2,{speed:20,slip:.5});tracker.update(1/60,{speed:20,slip:.5,impact:6});assert.equal(events.at(-1)[0],'lost');assert.equal(tracker.view().idle,true);
 assert.equal(multiplierFor(100),6);assert.equal(skillName('drift',2000),'超级漂移');
});
test('career levels, stars and records persist and reject corrupt data',()=>{
 const store=new Map(),storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
 const career=createCareer(storage);assert.equal(career.level.level,1);assert.equal(career.addXp(5000),1);assert.equal(career.level.level,2);
 assert.deepEqual(career.recordStunt('trap',150,2),{record:true,newStars:2,previous:0});assert.equal(career.recordStunt('trap',120,1).newStars,0);assert.equal(career.recordStunt('trap',200,3).newStars,1);
 const again=createCareer(storage);assert.equal(again.starCount,3);assert.equal(again.data.records.trap,200);
 assert.deepEqual(parseCareer('{bad'),{xp:0,skillTotal:0,bestChain:0,stars:{},records:{}});assert.deepEqual(parseCareer('{"xp":-5,"stars":{"a":9}}').stars,{});
 assert.equal(levelFor(5000+10000).level,3);
});
test('stunts: traps read speed at the gate, zones time gate to gate in either direction',()=>{
 assert.equal(MAX_STARS,STUNTS.length*3);for(const stunt of STUNTS){assert.equal(stunt.targets.length,3);assert.ok(stunt.targets[0]<stunt.targets[1]&&stunt.targets[1]<stunt.targets[2]);}
 const trap=STUNTS.find(s=>s.id==='trap-boulevard');assert.equal(starsFor(trap,trap.targets[1]),2);
 assert.equal(crossing(trap.gates[0],0,-110,0,-130),1);assert.equal(crossing(trap.gates[0],0,-130,0,-110),-1);assert.equal(crossing(trap.gates[0],40,-110,40,-130),0);
 const events=[],tracker=createStuntTracker((type,e)=>events.push([type,e]));
 for(let z=-100;z>-140;z-=.5)tracker.update(1/120,{x:0,z,speed:60,slip:0});
 assert.equal(events.length,1);assert.equal(events[0][1].stunt.id,'trap-boulevard');assert.ok(Math.abs(events[0][1].value-216)<1e-6);assert.equal(events[0][1].stars,3);
 events.length=0;tracker.reset();const zone=STUNTS.find(s=>s.id==='zone-north');
 for(let x=215;x>-215;x-=.5)tracker.update(.01,{x,z:-240,speed:50,slip:0});// 50 m/s, driven against the path direction
 assert.deepEqual(events.map(e=>e[0]),['start','result']);assert.ok(Math.abs(events[1][1].value-180)<1,String(events[1][1].value));
 events.length=0;tracker.reset();for(let x=-215;x<0;x+=.5)tracker.update(.01,{x,z:-240,speed:50,slip:0});for(let z=-240;z<-200;z+=.5)tracker.update(.01,{x:0,z,speed:50,slip:0});assert.equal(events.at(-1)[0],'abandon');
});
test('rewind scrubs back along the recorded path and resumes from there',()=>{
 const rewind=createRewind(10,.1),s=createState();s.z=0;
 for(let i=0;i<600;i++){s.z-=.1;s.speed=12;rewind.record(s,1/120);}
 assert.ok(rewind.available>4);const end=s.z;let more=true;for(let i=0;i<60&&more;i++)more=rewind.scrub(s,1/30);
 assert.ok(s.z>end+15&&s.z<end+30,`moved back ${s.z-end}`);rewind.commit(s);assert.equal(s.collision,false);
 for(let i=0;i<2000&&rewind.scrub(s,.1);i++);assert.ok(s.z<=0);
});
test('gamepad axes have a deadzone and buttons report edges',()=>{
 assert.equal(shapeAxis(.05),0);assert.ok(Math.abs(shapeAxis(1)-1)<1e-9);assert.ok(shapeAxis(-.5)<0&&shapeAxis(-.5)>-.5);
 const button=(pressed,value=pressed?1:0)=>({pressed,value}),pad={connected:true,mapping:'standard',axes:[-1,0,0,0],buttons:Array.from({length:16},()=>button(false))};
 const gamepad=createGamepad(()=>[pad]);pad.buttons[7]=button(true,.6);pad.buttons[5]=button(true);
 let input=gamepad.poll(1);assert.equal(input.steer,1);assert.equal(input.throttle,.6);assert.equal(input.edges.camera,true);assert.equal(input.active,true);
 input=gamepad.poll(1.1);assert.equal(input.edges.camera,false);assert.equal(createGamepad(()=>[]).poll(0),null);
});
