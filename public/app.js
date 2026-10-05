import * as THREE from './vendor/three.module.min.js';
import {CARS,parseCar,carSpecs} from './driving/catalog.js';
import {loadVehicle} from './driving/joe.js';
import {createCity,createGarage,makeEnvironment,STREETS} from './driving/city.js';
import {createCircuit} from './driving/circuit.js';
import {CIRCUITS,buildRoute,createLapTimer,formatLap} from './driving/circuit-data.js';
import {createState,step,setDirection,clamp} from './driving/physics.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let renderer,garage,city,camera,vehicle,selected=CARS.find(c=>c.id==='EF'),specs,mode='garage',cabin=false,paused=false,loading=false,loadId=0;
let state=createState(),lastTime=0,accumulator=0,uiTime=0,orbit=-.8,zoom=1,lookX=0,lookY=0,seat=0,fov=70,cruise=false,quality='medium';
let destination='city',lapTimer=null,starting=false,inspectDamage=false;const worlds=new Map();
const keys=new Set(),touch=new Set(),cache=new Map(),thumbnails=new Map();
const collectionOrder=['EF','G4','CS','TC6','TL2','MC','MI','3S'];
let audioContext,audioSource,audioGain,audioCar,sound=true,volume=.18,toastTimer;
const audioBuffers=new Map();
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
function notify(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,3800);}
function fatal(error){console.error(error);$('#fatal-message').textContent=error.message||String(error);$('#fatal').hidden=false;}
function resetInputs(){keys.clear();touch.clear();}
function saveSettings(){try{localStorage.setItem('openroad-settings',JSON.stringify({fov,seat,volume,quality,sound}));}catch{}}
try{const saved=JSON.parse(localStorage.getItem('openroad-settings')||'{}');fov=clamp(Number(saved.fov)||70,55,95);seat=clamp(Number(saved.seat)||0,-.1,.14);volume=clamp(Number.isFinite(saved.volume)?saved.volume:.18,0,1);quality=['low','medium','high'].includes(saved.quality)?saved.quality:'medium';sound=saved.sound!==false;}catch{}
$('#quality').value=quality;$('#fov').value=fov;$('#fov-value').textContent=fov+'°';$('#seat-height').value=seat*100;$('#seat-value').textContent=seat?Math.round(seat*100)+' cm':'标准';$('#volume').value=volume*100;
function updateSoundLabel(){$('#sound-toggle').textContent='声音 '+(sound?'开':'关');$('#sound-toggle').setAttribute('aria-pressed',String(sound));}
updateSoundLabel();
function renderCards(filter='all'){
 const previousScroll=$('#car-list').scrollLeft;$('#collection-count').textContent=String(CARS.length).padStart(2,'0');$('#car-list').replaceChildren();for(const car of collectionOrder.map(id=>CARS.find(c=>c.id===id)).filter(c=>filter==='all'||c.category===filter)){
  const button=document.createElement('button');button.className='car-card'+(selected.id===car.id?' selected':'');button.setAttribute('aria-pressed',String(selected.id===car.id));button.setAttribute('aria-label',`选择 ${car.brand} ${car.name}`);
  button.dataset.car=car.id;const picture=document.createElement('img');picture.className='card-image';picture.alt='';if(thumbnails.has(car.id))picture.src=thumbnails.get(car.id);button.append(picture);
  const entries=[['card-brand',car.brand],['card-index','0'+(collectionOrder.indexOf(car.id)+1)],['card-name',car.name],['card-arrow','↗'],['card-meta',car.type],['card-tag',car.drive]];
  for(const [className,value] of entries){const span=document.createElement('span');span.className=className;span.textContent=value;button.append(span);}button.onclick=()=>selectCar(car);$('#car-list').append(button);
 }
 $('#car-list').scrollLeft=previousScroll;requestAnimationFrame(updateCollectionArrows);
}

function getCarAssets(car,progress=()=>{}){
 if(!cache.has(car.id))cache.set(car.id,(async()=>{const response=await fetch(`./vehicles/cars/${car.id}/${car.id}.car`);if(!response.ok)throw new Error('车辆参数加载失败，请刷新重试');const config=parseCar(await response.text());const data=carSpecs(config);const model=await loadVehicle(car,config,data,progress);return {model,data,config};})().catch(e=>{cache.delete(car.id);throw e;}));
 return cache.get(car.id);
}
async function prepareCollection(){
 const thumbRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true});thumbRenderer.setSize(360,180);thumbRenderer.outputColorSpace=THREE.SRGBColorSpace;thumbRenderer.toneMapping=THREE.ACESFilmicToneMapping;thumbRenderer.toneMappingExposure=1.05;
 const stage=new THREE.Scene();stage.environment=garage.environment;stage.environmentIntensity=.8;stage.add(new THREE.HemisphereLight('#e6edff','#3b4151',2.2));const light=new THREE.DirectionalLight('#ffffff',3);light.position.set(-4,6,-5);stage.add(light);
 const cam=new THREE.PerspectiveCamera(36,2,.1,30);cam.position.set(-5.4,2.3,-6.7);cam.lookAt(0,.5,0);
 for(const id of collectionOrder){
  try{const car=CARS.find(c=>c.id===id),{model}=await getCarAssets(car);const clone=model.root.clone();clone.position.set(0,0,0);clone.rotation.set(0,0,0);stage.add(clone);thumbRenderer.render(stage,cam);const url=thumbRenderer.domElement.toDataURL('image/png');thumbnails.set(id,url);const img=document.querySelector(`[data-car="${id}"] .card-image`);if(img)img.src=url;stage.remove(clone);
   if(city&&['MI','3S','MC'].includes(id))city.addParked(model,id);
  }catch(e){console.warn('Collection preview unavailable',id,e.message);}
  await new Promise(resolve=>setTimeout(resolve,30));
 }
 thumbRenderer.dispose();thumbRenderer.forceContextLoss();
}
function updateCollectionArrows(){const list=$('#car-list');$('#cars-prev').disabled=list.scrollLeft<2;$('#cars-next').disabled=list.scrollLeft+list.clientWidth>=list.scrollWidth-2;}
$('#cars-prev').onclick=()=>$('#car-list').scrollBy({left:-$('#car-list').clientWidth*.8,behavior:reducedMotion?'instant':'smooth'});
$('#cars-next').onclick=()=>$('#car-list').scrollBy({left:$('#car-list').clientWidth*.8,behavior:reducedMotion?'instant':'smooth'});
$('#car-list').addEventListener('scroll',updateCollectionArrows,{passive:true});

function renderPaint(){
 $('#paint-options').replaceChildren();for(const [i,color] of [selected.color,'#294d45','#902e2b','#d8c29c','#2c3034'].entries()){
  const b=document.createElement('button');b.className='paint'+(i===0?' selected':'');b.style.backgroundColor=color;b.setAttribute('aria-label',['原色','森林绿','酒红','香槟金','石墨黑'][i]);b.title=b.getAttribute('aria-label');b.onclick=()=>{if(!vehicle||loading)return;vehicle.paint.set(color);$$('.paint').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');};$('#paint-options').append(b);
 }
}
async function selectCar(car){
 const token=++loadId;loading=true;selected=car;$('#start-drive').disabled=true;$('#start-label').textContent='加载车型…';$('#preview-cabin').disabled=true;$('#car-brand').textContent=car.brand;
 $('#car-name').textContent=car.name;$('#car-era').textContent=car.era;$('#description').textContent=car.description;$('#spec-drive').textContent=car.drive;$('#spec-power').textContent='—';$('#spec-torque').textContent='—';$('#model-status').textContent='正在载入模型';$('#header-status').textContent='正在准备座驾';
 if(vehicle)garage.remove(vehicle.root);vehicle=null;cabin=false;lookX=lookY=0;orbit=-.8;zoom=1;updatePreview();renderCards($('.filter-tabs .selected').dataset.filter);renderPaint();
 try{
  const pending=getCarAssets(car,progress=>{if(token===loadId)$('#model-status').textContent=`模型加载 ${Math.round(progress*100)}%`;});
  const result=await pending;if(token!==loadId)return;
  vehicle=result.model;specs=result.data;vehicle.paint.set(car.color);vehicle.root.position.set(0,0,0);vehicle.root.rotation.set(0,0,0);vehicle.source.rotation.set(-Math.PI/2,0,0);garage.add(vehicle.root);state=createState();state.rpm=specs.idle;vehicle.update(state,0);
  $('#spec-gears').textContent=specs.gears.length;$('#spec-mass').textContent=Math.round(specs.mass).toLocaleString();$('#spec-power').textContent=Math.round(specs.power);$('#spec-torque').textContent=Math.round(specs.peakTorque);$('#start-drive').disabled=false;$('#preview-cabin').disabled=false;$('#start-label').textContent=destination==='city'?'开始驾驶':'开始挑战';$('#model-status').textContent=car.quality;$('#header-status').textContent='FREE DRIVE · 随时出发';loading=false;
 }catch(error){if(token!==loadId)return;loading=false;$('#model-status').textContent='载入失败';$('#start-label').textContent='点击重试';$('#start-drive').disabled=false;notify(error.message);}
}
function updatePreview(){$('#preview-mode').textContent=cabin?'座舱视角':'外观视角';$('#preview-cabin').textContent=cabin?'返回外观 ↗':'查看内饰 ↗';$('#drag-hint').textContent=cabin?'拖动环顾 · C 视线回正':'拖动旋转 · 滚轮缩放';}
function setPaused(value,reason='驾驶已暂停'){
 if(mode!=='drive')return;paused=value;resetInputs();$('#pause-overlay').hidden=!value;$('#pause-reason').textContent=reason;$('#pause-button').textContent=value?'继续':'暂停';if(value&&audioGain)audioGain.gain.setTargetAtTime(0,audioContext.currentTime,.1);lastTime=0;accumulator=0;
}
async function startAudio(){
 try{
  audioContext||=new AudioContext();await audioContext.resume();
  const car=selected.id,engineUrl=selected.audioPath||`./vehicles/cars/${car}/engine.wav`;if(audioCar===car&&audioSource)return;
  audioSource?.stop();audioSource=null;audioCar=car;
  if(!audioBuffers.has(car)){const r=await fetch(engineUrl);if(!r.ok)throw new Error('音频缺失');audioBuffers.set(car,await audioContext.decodeAudioData(await r.arrayBuffer()));}
  if(mode!=='drive'||car!==selected.id)return;
  audioSource=audioContext.createBufferSource();audioSource.buffer=audioBuffers.get(car);audioSource.loop=true;audioGain=audioContext.createGain();audioGain.gain.value=0;audioSource.connect(audioGain).connect(audioContext.destination);audioSource.start();
 }catch(error){console.warn('Engine audio unavailable:',error);notify('声音未能开启，仍可继续驾驶');}
}
function playImpact(speed){
 if(!sound||!audioContext||audioContext.state!=='running'||speed<.7)return;
 const duration=.12+Math.min(speed/80,.15),buffer=audioContext.createBuffer(1,Math.ceil(audioContext.sampleRate*duration),audioContext.sampleRate),channel=buffer.getChannelData(0);for(let i=0;i<channel.length;i++)channel[i]=(Math.random()*2-1)*Math.exp(-i/channel.length*5);
 const source=audioContext.createBufferSource();source.buffer=buffer;const filter=audioContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=250+Math.min(speed*25,650);const gain=audioContext.createGain();gain.gain.value=volume*Math.min(speed/6,1.5);source.connect(filter).connect(gain).connect(audioContext.destination);source.start();source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
}
function bestKey(){return `openroad-best-v3-${destination}-${selected.id}`;}
function resetSession(){
 state=createState();state.rpm=specs.idle;
 if(city.route){Object.assign(state,{x:city.spawn.x,z:city.spawn.z,yaw:city.spawn.yaw});lapTimer=createLapTimer(city.route,city.info.halfWidth,result=>{if(result.valid){try{const key=bestKey(),saved=JSON.parse(localStorage.getItem(key)||'null');if(!saved||result.time<saved.time)localStorage.setItem(key,JSON.stringify(result));}catch{}notify(`完成第 ${lapTimer.lap} 圈 · ${formatLap(result.time)}`);}else notify(`本圈无效：${result.reason}`);});try{const saved=JSON.parse(localStorage.getItem(bestKey())||'null');if(saved&&Number.isFinite(saved.time)&&saved.time>15)lapTimer.best=saved;}catch{}lapTimer.update(state.x,state.z,0);
 }else lapTimer=null;
 vehicle.root.position.set(state.x,0,state.z);vehicle.root.rotation.y=state.yaw;vehicle.update(state,0);
 $('#lap-hud').hidden=!lapTimer;$('#cruise-button').hidden=false;$('#route-title').textContent=city.info?`${city.info.name} / 计时挑战`:'海港城 / 自由驾驶';$('#map-title').textContent=city.info?.title||'HARBOR CITY';
}
async function startDriving(){
 if(starting)return;if(!vehicle||loading){if(!loading)selectCar(selected);return;}
 const token=loadId,chosen=destination;starting=true;$('#start-drive').disabled=true;$('#start-label').textContent='准备驾驶场景…';
 try{
  if(!worlds.has(chosen)){const world=chosen==='city'?createCity():await createCircuit(CIRCUITS.find(c=>c.id===chosen));world.scene.environment=garage.environment;world.scene.environmentIntensity=.4;worlds.set(chosen,world);if(chosen==='city')for(const id of ['MI','3S','MC'])getCarAssets(CARS.find(c=>c.id===id)).then(({model})=>world.addParked(model,id)).catch(()=>{});}
  if(token!==loadId||chosen!==destination)return;city=worlds.get(chosen);garage.remove(vehicle.root);city.scene.add(vehicle.root);resetSession();resetInputs();cruise=false;lookX=lookY=0;paused=false;inspectDamage=false;$('#damage-view').textContent='查看车身';mode='drive';cabin=false;
  $('#garage').hidden=true;$('#drive-ui').hidden=false;$('#pause-overlay').hidden=true;document.body.classList.add('driving');$('#drive-brand').textContent=selected.brand;$('#drive-name').textContent=selected.name;$('#drive-cabin').textContent=selected.cabin+' · 第一人称';$('#pause-button').textContent='暂停';updateCruise();updateDirection();resize();startAudio();notify(lapTimer?'向前驶过黑白计时线，开始计时；白线外行驶会使本圈无效':'W / ↑ 加速，S / ↓ 刹车；A D / ← → 转向');
 }catch(error){notify(error.message);}finally{starting=false;$('#start-drive').disabled=loading;$('#start-label').textContent=destination==='city'?'开始驾驶':'开始挑战';}
}
function returnGarage(){
 if(mode!=='drive')return;mode='garage';paused=false;cruise=false;resetInputs();audioSource?.stop();audioSource=null;audioCar=null;
 city.scene.remove(vehicle.root);vehicle.root.position.set(0,0,0);vehicle.root.rotation.set(0,0,0);vehicle.source.rotation.set(-Math.PI/2,0,0);garage.add(vehicle.root);state=createState();vehicle.update(state,0);cabin=false;lookX=lookY=0;updatePreview();
 $('#garage').hidden=false;$('#drive-ui').hidden=true;document.body.classList.remove('driving');resize();
}
function updateDirection(){$$('[data-direction]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.direction)===state.direction));}
function direction(value){if(mode!=='drive')return;if(!setDirection(state,value)){notify('请先停稳，再切换挡位');return;}cruise=false;updateDirection();updateCruise();}
function updateCruise(){$('#cruise-button').setAttribute('aria-pressed',String(cruise));$('#cruise-button').innerHTML=cruise?'巡航 35 km/h · 点击取消 <span>×</span>':'启用 35 km/h 巡航 <span>→</span>';}
function input(){
 const brake=keys.has('KeyS')||keys.has('ArrowDown')||touch.has('brake')?1:0;
 const handbrake=keys.has('Space');
 if((brake||handbrake)&&cruise){cruise=false;updateCruise();}
 const rawThrottle=keys.has('KeyW')||keys.has('ArrowUp')||touch.has('throttle')?1:0;
 const throttle=cruise?clamp((35/3.6-state.speed)*.65+.1,0,1):rawThrottle;
 return {throttle,brake:cruise?Math.max(brake,clamp((state.speed-35/3.6)*.3,0,.4)):brake,handbrake,steer:(keys.has('KeyA')||keys.has('ArrowLeft')||touch.has('left')?1:0)-(keys.has('KeyD')||keys.has('ArrowRight')||touch.has('right')?1:0)};
}
$('#damage-view').onclick=()=>{inspectDamage=!inspectDamage;$('#damage-view').textContent=inspectDamage?'返回座舱':'查看车身';};
$('#start-drive').onclick=startDriving;$('#return-garage').onclick=returnGarage;$('#garage-nav').onclick=returnGarage;
$('#preview-cabin').onclick=()=>{cabin=!cabin;lookX=lookY=0;updatePreview();};
$$('[data-filter]').forEach(b=>b.onclick=()=>{$$('[data-filter]').forEach(x=>x.classList.toggle('selected',x===b));renderCards(b.dataset.filter);$('#car-list').scrollLeft=0;updateCollectionArrows();});
$('#reset-car').onclick=()=>{resetSession();cruise=false;lookX=lookY=0;resetInputs();updateDirection();updateCruise();notify(lapTimer?'车辆已修复，重新驶过计时线开始挑战':'车辆已修复并返回出发点');};
$('#pause-button').onclick=()=>setPaused(!paused);$('#resume-button').onclick=()=>{setPaused(false);startAudio();};
$('#cruise-button').onclick=()=>{if(paused)return;if(state.direction!==1){notify('请先切换到 D 挡');return;}cruise=!cruise;updateCruise();if(cruise)notify('巡航已启用，方向仍由你控制；刹车可取消');};
$$('[data-direction]').forEach(b=>b.onclick=()=>direction(Number(b.dataset.direction)));
$('#sound-toggle').onclick=()=>{sound=!sound;updateSoundLabel();saveSettings();if(sound)startAudio();};
const openDialog=id=>{if(mode==='drive')setPaused(true,'关闭窗口后，点击继续驾驶');$(id).showModal();};
$('#guide-open').onclick=()=>openDialog('#guide-dialog');$('#about-open').onclick=$('#sources-open').onclick=()=>openDialog('#about-dialog');$('#settings-open').onclick=()=>openDialog('#settings-dialog');
$$('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
$('#quality').onchange=e=>{quality=e.target.value;resize();renderer.shadowMap.enabled=quality!=='low';renderer.shadowMap.needsUpdate=true;saveSettings();};
$('#fov').oninput=e=>{fov=Number(e.target.value);$('#fov-value').textContent=fov+'°';saveSettings();};
$('#seat-height').oninput=e=>{seat=Number(e.target.value)/100;$('#seat-value').textContent=seat?Math.round(seat*100)+' cm':'标准';saveSettings();};
$('#volume').oninput=e=>{volume=Number(e.target.value)/100;saveSettings();};
const handled=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyQ','KeyE','KeyC','KeyR','KeyP','Escape'];
addEventListener('keydown',e=>{
 if($('dialog[open]')||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
 if((mode==='drive'||cabin)&&handled.includes(e.code))e.preventDefault();
 if(e.code==='KeyC'){lookX=lookY=0;return;}
 if(mode!=='drive'){if(e.code==='Enter'&&!e.repeat&&e.target===document.body)startDriving();return;}
 if(e.code==='KeyP'||e.code==='Escape'){if(!e.repeat)setPaused(!paused);return;}
 if(e.code==='KeyR'){if(!e.repeat)direction(state.direction<0?1:-1);return;}
 if(!paused)keys.add(e.code);
});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{resetInputs();if(mode==='drive')setPaused(true,'窗口已失去焦点，车辆已暂停');});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='drive')setPaused(true,'页面已切换，车辆已暂停');});
$$('[data-control]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();if(paused)return;b.setPointerCapture(e.pointerId);touch.add(b.dataset.control);});for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,()=>touch.delete(b.dataset.control));});
let drag=null;
$('#viewport').addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,id:e.pointerId};renderer.domElement.setPointerCapture(e.pointerId);});
$('#viewport').addEventListener('pointermove',e=>{if(!drag||paused)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;if((mode==='drive'&&!inspectDamage)||cabin){lookX=clamp(lookX-dx*.004,-1.5,1.5);lookY=clamp(lookY-dy*.003,-.5,.45);}else orbit-=dx*.008;});
for(const name of ['pointerup','pointercancel'])$('#viewport').addEventListener(name,()=>drag=null);
$('#viewport').addEventListener('wheel',e=>{if(mode==='garage'&&!cabin){e.preventDefault();zoom=clamp(zoom+e.deltaY*.0006,.65,1.4);}},{passive:false});
function resize(){if(!renderer)return;renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='low'?1:quality==='high'?2:1.5));renderer.setSize(innerWidth,innerHeight);updateCollectionArrows();camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
const localEye=new THREE.Vector3(),target=new THREE.Vector3();
function moveCamera(time){
 if(!vehicle)return;
 if(mode==='drive'&&inspectDamage){camera.clearViewOffset();camera.fov=48;const angle=state.yaw+orbit;camera.position.set(state.x+Math.sin(angle)*7.5,3.2,state.z-Math.cos(angle)*7.5);camera.lookAt(state.x,.65,state.z);}
 else if(mode==='garage'&&!cabin){
  const angle=orbit+(reducedMotion||drag?0:Math.sin(time*.08)*.045),dist=(innerWidth<761?15.5:8.8)*zoom;
  camera.fov=38;camera.position.set(Math.sin(angle)*dist,(innerWidth<761?4.2:2.8)*zoom,-Math.cos(angle)*dist);camera.lookAt(0,.62,0);camera.clearViewOffset();
  if(innerWidth>760)camera.setViewOffset(innerWidth,innerHeight,-innerWidth*.16,innerHeight*.10,innerWidth,innerHeight);
  else camera.setViewOffset(innerWidth,innerHeight,0,innerHeight*.095,innerWidth,innerHeight);
 }else{
  camera.clearViewOffset();camera.fov=fov;localEye.copy(vehicle.eye);localEye.y+=seat;
  localEye.applyAxisAngle(THREE.Object3D.DEFAULT_UP,state.yaw);camera.position.copy(vehicle.root.position).add(localEye);const pulse=state.impactPulse||0;camera.position.y+=Math.sin(time*49)*pulse*.032;camera.position.x+=Math.sin(time*37)*pulse*.018;
  const side=keys.has('KeyQ')?1.05:keys.has('KeyE')?-1.05:0;
  const gaze=state.yaw+lookX+side,pitch=lookY-.025-clamp(state.acceleration*.0018,-.015,.025);
  target.set(-Math.sin(gaze)*Math.cos(pitch),Math.sin(pitch),-Math.cos(gaze)*Math.cos(pitch));camera.lookAt(camera.position.clone().add(target));
  camera.rotateZ(clamp(-state.lateral*.002,-.016,.016)+Math.sin(time*28)*(state.impactPulse||0)*.012);
 }
 camera.updateProjectionMatrix();
}
const map=$('#minimap').getContext('2d');
function drawMap(){
 if(city?.route){const route=city.route,b=route.bounds,w=260,h=190,pad=15,scale=Math.min((w-pad*2)/(b.maxX-b.minX),(h-pad*2)/(b.maxZ-b.minZ)),ox=(w-(b.maxX-b.minX)*scale)/2-b.minX*scale,oz=(h-(b.maxZ-b.minZ)*scale)/2-b.minZ*scale;map.clearRect(0,0,w,h);map.strokeStyle='#77899e';map.lineWidth=3;map.beginPath();route.points.forEach((p,i)=>i?map.lineTo(p.x*scale+ox,p.z*scale+oz):map.moveTo(p.x*scale+ox,p.z*scale+oz));map.closePath();map.stroke();const line=route.at(0);map.fillStyle='#fff';map.fillRect(line.x*scale+ox-3,line.z*scale+oz-3,6,6);map.fillStyle='#dcf87d';map.beginPath();map.arc(state.x*scale+ox,state.z*scale+oz,4,0,Math.PI*2);map.fill();return;}

 const w=260,h=190,scale=.38;map.clearRect(0,0,w,h);map.fillStyle='#141c28';map.fillRect(0,0,w,h);map.save();map.translate(w/2,h/2);map.scale(scale,scale);map.translate(-state.x,-state.z);
 map.fillStyle='#2a3443';for(let ix=0;ix<6;ix++)for(let iz=0;iz<6;iz++)map.fillRect(STREETS[ix]+13,STREETS[iz]+13,54,54);
 map.strokeStyle='#6d7a8d';map.lineWidth=2;for(const v of STREETS){map.beginPath();map.moveTo(v,-285);map.lineTo(v,285);map.moveTo(-285,v);map.lineTo(285,v);map.stroke();}
 map.fillStyle='#436265';map.fillRect(302,-700,700,1400);map.strokeStyle='#e0fd78';map.lineWidth=4;map.beginPath();map.moveTo(0,160);map.lineTo(0,-160);map.lineTo(160,-160);map.stroke();
 map.restore();map.save();map.translate(w/2,h/2);map.rotate(-state.yaw);map.fillStyle='#e0fd78';map.beginPath();map.moveTo(0,-9);map.lineTo(6,7);map.lineTo(0,4);map.lineTo(-6,7);map.closePath();map.fill();map.restore();
}
function updateHUD(i){
 const damage=state.damage;$('#damage-hud').hidden=damage.revision===0;$('#damage-status').textContent=damage.disabled?'车辆无法继续行驶 · 请修复重置':'车辆受损';$('#damage-detail').textContent=`动力 ${Math.round((damage.disabled?0:Math.max(.15,1-damage.engine*.7-damage.structure*.15))*100)}% · 制动 ${Math.round((1-damage.brakes*.55)*100)}% · 转向 ${Math.round((1-damage.steering*.48)*100)}%`;

 $('#drive-ui').style.setProperty('--impact',String(state.impactPulse||0));$('#speed').textContent=String(Math.round(Math.abs(state.speed)*3.6)).padStart(3,'0');$('#rpm').textContent=Math.round(state.rpm/10)*10;$('#gear-number').textContent=state.direction===0?'空挡':state.direction<0?'倒挡':state.gear+' 挡';$('#rpm-fill').style.width=Math.min(100,state.rpm/specs.redline*100)+'%';$('#throttle-fill').style.width=i.throttle*100+'%';$('#brake-fill').style.width=i.brake*100+'%';$('#distance').textContent=(state.distance/1000).toFixed(2)+' km';$('#road-name').textContent=city.info?`${city.info.name} · ${(city.info.length/1000).toFixed(3)} km`:Math.abs(state.x)<12?'滨海大道':state.x>200?'港湾环路':'中央街区';drawMap();
 if(lapTimer){$('#lap-clock').textContent=formatLap(lapTimer.time);$('#lap-state').textContent=lapTimer.start===null?'驶过计时线开始':!lapTimer.valid?'本圈无效 · '+lapTimer.reason:lapTimer.wrongWay?'注意行驶方向':`LAP ${String(lapTimer.lap).padStart(2,'0')} · 计时中`;$('#lap-hud').classList.toggle('invalid',!lapTimer.valid);$('#lap-best').textContent=formatLap(lapTimer.best?.time);$('#lap-last').textContent=lapTimer.last?(lapTimer.last.valid?formatLap(lapTimer.last.time):'无效圈'):'—';$$('[data-sector]').forEach((el,i)=>el.textContent=Number.isFinite(lapTimer.sectors[i])?lapTimer.sectors[i].toFixed(3):'—');}
}
let lastCollision=0;
function animate(timestamp){
 requestAnimationFrame(animate);if(!renderer)return;
 const dt=lastTime?Math.min((timestamp-lastTime)/1000,.1):0;lastTime=timestamp;
 if(vehicle&&mode==='drive'){
  const controls=input();state.throttle=controls.throttle;state.brake=controls.brake;
  if(!paused){accumulator+=dt;while(accumulator>=1/120){controls.offRoad=!!lapTimer?.offRoad;step(state,controls,specs,1/120,city.world);if(lapTimer)lapTimer.update(state.x,state.z,1/120);accumulator-=1/120;if(state.collision&&timestamp-lastCollision>180){lastCollision=timestamp;playImpact(state.impact.speed);cruise=false;updateCruise();notify(`${state.impact.speed>4?'撞击':'擦碰'}${state.impact.kind} · 停稳后可挂 R 挡后退`);}}vehicle.root.position.set(state.x,0,state.z);vehicle.root.rotation.y=state.yaw;vehicle.update(state,dt);city.follow(state.x,state.z);}
  uiTime+=dt;if(uiTime>.075){updateHUD(controls);uiTime=0;}
  if(audioSource&&audioGain){audioSource.playbackRate.setTargetAtTime(clamp(state.rpm/3000,.45,2.5),audioContext.currentTime,.05);audioGain.gain.setTargetAtTime(sound&&!paused&&!state.damage.disabled?volume*(.3+controls.throttle*.5):0,audioContext.currentTime,.08);}
 }
 moveCamera(timestamp/1000);renderer.render(mode==='drive'?city.scene:garage,camera);
}
try{
 renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;renderer.shadowMap.enabled=quality!=='low';renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 $('#viewport').append(renderer.domElement);renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();if(mode==='drive')setPaused(true);fatal(new Error('图形渲染已中断，请关闭其他占用显卡的页面后重新载入。'));});
 garage=createGarage();garage.environment=makeEnvironment(renderer);garage.environmentIntensity=.65;camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.025,5000);resize();addEventListener('resize',resize);renderCards();selectCar(selected).then(prepareCollection);requestAnimationFrame(animate);
}catch(error){fatal(new Error('无法启动三维画面。请使用支持 WebGL 2 的浏览器并开启硬件加速。'+error.message));}

$('#destination-open').onclick=()=>openDialog('#destination-dialog');
$$('[data-destination]').forEach(button=>button.onclick=()=>{destination=button.dataset.destination;const info=CIRCUITS.find(c=>c.id===destination);$('#destination-title').textContent=info?.title||'HARBOR CITY';$('#destination-subtitle').textContent=info?`${info.name} · ${(info.length/1000).toFixed(3)} km · 计时挑战`:'海港城 · 自由驾驶';$('#start-label').textContent=info?'开始挑战':'开始驾驶';$$('[data-destination]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));$('#destination-dialog').close();});
for(const info of CIRCUITS)fetch(`./circuits/${info.id}.geojson`).then(r=>r.json()).then(geo=>{const route=buildRoute(geo),b=route.bounds,svg=document.querySelector(`[data-track-map="${info.id}"]`);svg.setAttribute('viewBox',`${b.minX-45} ${b.minZ-45} ${b.maxX-b.minX+90} ${b.maxZ-b.minZ+90}`);const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',route.points.map((p,i)=>`${i?'L':'M'}${p.x},${p.z}`).join(' ')+'Z');path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','22');path.setAttribute('stroke-linejoin','round');svg.append(path);}).catch(()=>{});
