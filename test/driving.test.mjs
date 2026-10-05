import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseCar,carSpecs,CARS} from '../public/driving/catalog.js';
import {createState,step,setDirection} from '../public/driving/physics.js';
import {createCollisionWorld} from '../public/driving/collision.js';
import {decodeJoe} from '../public/driving/joe.js';
const configs=await Promise.all(CARS.map(async c=>parseCar(await readFile(new URL(`../public/vehicles/cars/${c.id}/${c.id}.car`,import.meta.url),'utf8'))));
const specs=configs.map(carSpecs);
function simulate(p,seconds,input={throttle:1},state=createState(),hz=120){for(let i=0;i<seconds*hz;i++)step(state,input,p,1/hz);return state;}

test('all ten cars have distinct, finite powertrains and valid model assets',async()=>{
 assert.equal(CARS.length,10);assert.equal(new Set(specs.map(p=>p.mass)).size,10);
 for(let i=0;i<CARS.length;i++){
  const p=specs[i];assert.ok(p.mass>500&&p.mass<2000);assert.ok(p.radius>.2&&p.radius<.4);assert.ok(p.gears.length>=4&&p.gears.length<=8);assert.ok(p.torque.length>5);
  if(CARS[i].format==='gltf'){const bytes=await readFile(new URL(`../public/vehicles/cars/${CARS[i].id}/${CARS[i].model}`,import.meta.url));if(CARS[i].id==='P1'){assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(8),bytes.length);}else{const g=JSON.parse(bytes);assert.equal(g.asset.version,'2.0');for(const ref of [...g.buffers,...g.images])assert.ok((await readFile(new URL(`../public/vehicles/cars/REV/${ref.uri}`,import.meta.url))).length>100);}}
  for(const part of ['body','interior','glass'].filter(part=>configs[i][part]?.mesh)){
   const buffer=await readFile(new URL(`../public/vehicles/cars/${CARS[i].id}/${configs[i][part].mesh}`,import.meta.url));const g=decodeJoe(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength));
   assert.ok(g.attributes.position.count>100);assert.ok(g.boundingBox.max.x-g.boundingBox.min.x>1);assert.ok(g.boundingBox.max.x-g.boundingBox.min.x<3);
   // Assets use mixed winding; decoded faces must agree with their normal vectors.
   const pos=g.attributes.position.array,norm=g.attributes.normal.array;let score=0,count=0;
   for(let j=0;j<pos.length;j+=9){const a=[pos[j+3]-pos[j],pos[j+4]-pos[j+1],pos[j+5]-pos[j+2]],b=[pos[j+6]-pos[j],pos[j+7]-pos[j+1],pos[j+8]-pos[j+2]];const n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];const length=Math.hypot(...n);if(length>1e-9){score+=(n[0]*norm[j]+n[1]*norm[j+1]+n[2]*norm[j+2])/length;count++;}}
   assert.ok(score/count>.5,`${CARS[i].id}/${part} normals`);
  }
 }
});
test('the cars accelerate differently and automatic gears engage',()=>{
 const runs=specs.map(p=>simulate(p,10));for(const s of runs){assert.ok(s.speed>16&&s.speed<70);assert.ok(s.gear>1);assert.ok(s.rpm>900);assert.ok(s.distance>80);}
 assert.ok(runs[CARS.findIndex(c=>c.id==='TC6')].speed>runs[CARS.findIndex(c=>c.id==='MI')].speed+2,'Celica must out-accelerate Mini');
});
test('braking stops without accidentally reversing and R requires a stop',()=>{
 const s=simulate(specs[0],5);assert.equal(setDirection(s,-1),false);simulate(specs[0],10,{brake:1},s);assert.equal(s.speed,0);assert.equal(setDirection(s,-1),true);simulate(specs[0],3,{throttle:1},s);assert.ok(s.speed<0);
});
test('neutral cannot drive and coasting dissipates energy',()=>{
 const s=createState();setDirection(s,0);simulate(specs[0],5,{throttle:1},s);assert.equal(s.speed,0);setDirection(s,1);simulate(specs[0],5,{throttle:1},s);const before=s.speed;simulate(specs[0],5,{},s);assert.ok(s.speed<before);
});
test('left steering turns left, reverse steering changes yaw, and lateral grip stays bounded',()=>{
 const s=createState();simulate(specs[0],2,{throttle:.6,steer:1},s);assert.ok(s.x<4.5);assert.ok(s.yaw>0);assert.ok(Math.abs(s.lateral)<15);
 const reverse=createState();setDirection(reverse,-1);simulate(specs[0],3,{throttle:.6,steer:1},reverse);assert.ok(reverse.yaw<0);
});
test('simulation is stable across 60 and 120 Hz and obstacle stops motion',()=>{
 const a=simulate(specs[0],10,{throttle:1},createState(),60),b=simulate(specs[0],10);assert.ok(Math.abs(a.speed-b.speed)<.6);assert.ok(Math.abs(a.distance-b.distance)<2);
 const s=createState();s.speed=20;const world=createCollisionWorld([{x:s.x,z:s.z-2.1,hx:10,hz:.2}]);step(s,{throttle:1},specs[0],1/120,world);assert.ok(s.speed<2);assert.equal(s.collision,true);
});
test('truncated model files fail clearly',()=>{assert.throws(()=>decodeJoe(new ArrayBuffer(12)),/格式/);});

test('staggered rear tires use each wheel’s own dimensions and driven radius',()=>{
 for(const id of ['EF','G4']){const p=specs[CARS.findIndex(c=>c.id===id)];assert.notEqual(p.wheels.fl.width,p.wheels.rl.width);assert.equal(p.radius,p.wheels.rl.radius);}
});
test('all selected engine sources are playable WAV files',async()=>{
 for(const car of CARS){const path=car.audioPath?.replace('./','')||`vehicles/cars/${car.id}/engine.wav`;const data=await readFile(new URL('../public/'+path,import.meta.url));assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.toString('ascii',8,12),'WAVE');}
});
