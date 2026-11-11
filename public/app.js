import {searchCars,parseMenuPreferences} from './driving/menu-state.js?v=0.11.0';
import {targetsFor,resolveTarget,assessLap,earnedTargets} from './driving/challenge-targets.js?v=0.10.1';
import * as THREE from './vendor/three.module.min.js';
import {CARS,parseCar,carSpecs,carsInCollection} from './driving/catalog.js?v=0.9.0';
import {loadVehicle} from './driving/joe.js';
import {loadGltfVehicle} from './driving/gltf-vehicle.js?v=0.9.0';
import {createCity,createGarage,makeEnvironment,STREETS} from './driving/city.js?v=0.12.0';
import {createCircuit} from './driving/circuit.js?v=0.10.1';
import {CIRCUITS,buildRoute,createLapTimer,formatLap,timingView} from './driving/circuit-data.js?v=0.10.1';
import {createState,step,setDirection,shiftGear,clamp} from './driving/physics.js?v=0.12.0';
import {createChaseCamera,CAMERA_MODES,CAMERA_LABELS} from './driving/chase-camera.js?v=0.12.0';
import {createRewind} from './driving/rewind.js?v=0.12.0';
import {createGamepad} from './driving/gamepad.js?v=0.12.0';
import {createSkillTracker} from './driving/skills.js?v=0.12.0';
import {createCareer} from './driving/progress.js?v=0.12.0';
import {createStuntTracker,STUNTS,MAX_STARS,starsFor} from './driving/stunts.js';
import {addStuntGates,STUNT_COLORS} from './driving/stunt-gates.js?v=0.12.0';
import {createDrivingLine} from './driving/driving-line.js?v=0.12.0';
import {createEffects} from './driving/effects.js?v=0.12.0';
import {createSfx} from './driving/sfx.js?v=0.12.0';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let menuPrefs={};
try{menuPrefs=parseMenuPreferences(localStorage.getItem('myracing-menu'),CARS.map(c=>c.id),['city',...CIRCUITS.map(c=>c.id)]);}catch{}
let menuSection='home',compactHud=menuPrefs.compactHud||false;
function saveMenu(){try{localStorage.setItem('myracing-menu',JSON.stringify({car:selected.id,destination,compactHud}));}catch{}}

let renderer,garage,city,camera,vehicle,selected=CARS.find(c=>c.id===(menuPrefs.car||'MCL39')),specs,mode='garage',cabin=false,paused=false,loading=false,loadId=0;
let state=createState(),lastTime=0,accumulator=0,uiTime=0,orbit=-.8,zoom=1,lookX=0,lookY=0,seat=0,fov=70,cruise=false,quality='medium',assists=true,handling='sport',manual=false,lineMode='full',cameraMode='chase';
let destination=menuPrefs.destination||'redbullring',lapTimer=null,starting=false,inspectDamage=false;const worlds=new Map();
const keys=new Set(),touch=new Set(),controlPointers=new Map(),cache=new Map(),thumbnails=new Map();
const thumbnailQueue=new Set();let thumbnailsRunning=false;
let audioContext,audioSource,audioGain,audioCar,sound=true,volume=.18,toastTimer;
const audioBuffers=new Map();
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
function notify(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,3800);}
function fatal(error){console.error(error);$('#fatal-message').textContent=error.message||String(error);$('#fatal').hidden=false;}
function resetInputs(){keys.clear();touch.clear();controlPointers.clear();$$('[data-control]').forEach(b=>b.classList.remove('pressed'));state.keyHeld=0;state.keyDirection=0;}
function saveSettings(){try{localStorage.setItem('openroad-settings',JSON.stringify({fov,seat,volume,quality,sound,assists,handling,manual,lineMode,cameraMode}));}catch{}}
try{const saved=JSON.parse(localStorage.getItem('openroad-settings')||'{}');fov=clamp(Number(saved.fov)||70,55,95);seat=clamp(Number(saved.seat)||0,-.1,.14);volume=clamp(Number.isFinite(saved.volume)?saved.volume:.18,0,1);quality=['low','medium','high'].includes(saved.quality)?saved.quality:'medium';sound=saved.sound!==false;handling=['casual','sport','sim'].includes(saved.handling)?saved.handling:saved.assists===false?'sim':'sport';assists=handling!=='sim';manual=saved.manual===true;lineMode=['off','brake','full'].includes(saved.lineMode)?saved.lineMode:'full';cameraMode=CAMERA_MODES.includes(saved.cameraMode)?saved.cameraMode:'chase';}catch{}
$('#assists').value=handling;$('#transmission').value=manual?'manual':'auto';$('#line-mode').value=lineMode;$('#camera-mode').value=cameraMode;$('#quality').value=quality;$('#fov').value=fov;$('#fov-value').textContent=fov+'°';$('#seat-height').value=seat*100;$('#seat-value').textContent=seat?Math.round(seat*100)+' cm':'标准';$('#volume').value=volume*100;$('#volume-value').textContent=Math.round(volume*100)+'%';
function updateSoundLabel(){$('#sound-toggle').textContent='声音 '+(sound?'开':'关');$('#sound-toggle').setAttribute('aria-pressed',String(sound));}
updateSoundLabel();
// --- Session systems: camera, rewind, gamepad, skills, stunts, career.
const chase=createChaseCamera(),rewind=createRewind(),gamepad=createGamepad();
let career;try{career=createCareer(localStorage);}catch{career=createCareer(null);}
let sfx=null,line=null,rewinding=false,rewindSpent=0,rewindTotal=1,reverseHold=0,frameDt=0,lookBack=false,padState=null,skillFlash=null,bannerTimer,lastSectors=0,sectorExcursions=0,hintTimer=0,recentKey='';
const skills=createSkillTracker(onSkillEvent),stunts=createStuntTracker(onStuntEvent);
const cueVolume=(scale=1)=>sound?volume*scale:0;
function renderStars(target,count){target.replaceChildren();if(count===null||count===undefined)return;for(let i=0;i<3;i++){const star=document.createElement('span');star.textContent='★';if(i<count)star.className='on';target.append(star);}}
function showBanner({kicker='',title='',detail='',stars=null,tone=''},duration=3400){
 const banner=$('#banner');$('#banner-kicker').textContent=kicker;$('#banner-title').textContent=title;$('#banner-detail').textContent=detail;if(tone)banner.style.setProperty('--tone',tone);else banner.style.removeProperty('--tone');
 renderStars($('#banner-stars'),stars);banner.hidden=true;void banner.offsetWidth;banner.hidden=false;clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>banner.hidden=true,duration);
}
function updateCareerUI(){
 const level=career.level,percent=Math.round(level.ratio*100)+'%';
 $('#menu-level').textContent=level.level;$('#menu-rank').textContent='车手等级 '+level.level;$('#menu-xp').style.setProperty('--xp',percent);$('#menu-stars').textContent=`★ ${career.starCount} / ${MAX_STARS}`;$('#menu-skill').textContent='技巧分 '+Math.round(career.data.skillTotal).toLocaleString();
 $('#hud-level').textContent=level.level;$('#hud-xp').style.setProperty('--xp',percent);$('#hud-stars').textContent='★ '+career.starCount;
}
function gainXp(amount){if(!(amount>0))return;const gained=career.addXp(amount);updateCareerUI();if(gained>0){sfx?.cue('star',cueVolume());setTimeout(()=>{if(mode==='drive')showBanner({kicker:'LEVEL UP · 升级',title:'车手等级 '+career.level.level,detail:'技巧、挑战星级和完成单圈都会获得经验'});},1200);}}
function onSkillEvent(type,event){
 const hud=$('#skill-hud');
 if(type==='skill'){hud.classList.remove('pop');void hud.offsetWidth;hud.classList.add('pop');sfx?.cue('skill',cueVolume(.5));}
 else if(type==='bank'){const xp=Math.round(event.total/3),best=career.bankChain(event.total);skillFlash={kind:'banked',score:event.total,label:(best&&event.total>=3000?'个人最佳连击 · ':'技巧结算 · ')+'+'+xp.toLocaleString()+' XP',until:performance.now()+2300};sfx?.cue('bank',cueVolume());gainXp(xp);}
 else if(type==='lost'){skillFlash={kind:'lost',score:event.score,label:'连击中断',until:performance.now()+1700};sfx?.cue('lost',cueVolume());}
}
const STUNT_KIND={trap:'SPEED TRAP · 测速点',zone:'SPEED ZONE · 区间测速',drift:'DRIFT ZONE · 漂移区'};
const stuntValue=(stunt,value)=>stunt.kind==='drift'?Math.round(value).toLocaleString():value.toFixed(1);
function onStuntEvent(type,event){
 const stunt=event.stunt;
 if(type==='start'){notify(`${stunt.name} 开始 · ${stunt.kind==='drift'?'尽情漂移，驶过终点拱门结算':'保持高速驶过终点拱门'}`);return;}
 if(type==='abandon'){notify(stunt.name+' 已取消 · 离开了挑战路段');return;}
 const {record,newStars,previous}=career.recordStunt(stunt.id,event.value,event.stars),next=stunt.targets[event.stars];
 showBanner({kicker:STUNT_KIND[stunt.kind],title:stuntValue(stunt,event.value)+' '+stunt.unit,detail:`${stunt.name} · ${record?(previous?'新纪录！':'首次成绩'):'最佳 '+stuntValue(stunt,previous)+' '+stunt.unit}${next?` · 下一星 ${next} ${stunt.unit}`:' · 已满星'}`,stars:event.stars,tone:STUNT_COLORS[stunt.kind]},4200);
 sfx?.cue(newStars?'star':'bank',cueVolume());gamepad.rumble(.3,.6,180);
 if(event.stars)skills.award(stunt.kind==='trap'?'测速点':stunt.kind==='zone'?'区间测速':'漂移区',120*event.stars);gainXp(newStars*1500+event.stars*100);
}
function applyCamera(){lookX=lookY=0;chase.reset();$('#camera-label').textContent=CAMERA_LABELS[cameraMode];$('#camera-mode').value=cameraMode;}
function cycleCamera(){if(mode!=='drive'||paused)return;cameraMode=CAMERA_MODES[(CAMERA_MODES.indexOf(cameraMode)+1)%CAMERA_MODES.length];applyCamera();saveSettings();}
function doShift(delta){if(paused||mode!=='drive'||rewinding||state.direction!==1)return;if(shiftGear(state,specs,delta))sfx?.cue('shift',cueVolume(.5));else if(delta<0&&state.gear>1)notify('转速过高，暂时无法降挡');}
updateCareerUI();applyCamera();$('#tach-red').style.strokeDasharray='7.5 100';$('#tach-red').style.strokeDashoffset='-67.5';
function renderCards(filter='modern'){
 const previousScroll=$('#car-list').scrollLeft,cars=searchCars(carsInCollection(filter),$('#car-search').value);$('#collection-count').textContent=String(cars.length).padStart(2,'0');$('#collection-empty').hidden=cars.length>0;$('#car-list').hidden=cars.length===0;$('#car-list').replaceChildren();for(const car of cars){
  const button=document.createElement('button');button.className='car-card'+(selected.id===car.id?' selected':'');button.setAttribute('aria-pressed',String(selected.id===car.id));button.setAttribute('aria-label',`选择 ${car.brand} ${car.name}`);
  button.dataset.car=car.id;const picture=document.createElement('img');picture.className='card-image';picture.alt='';if(thumbnails.has(car.id))picture.src=thumbnails.get(car.id);button.append(picture);
  const entries=[['card-brand',car.brand],['card-index',car.year?String(car.year):'CLASSIC'],['card-name',car.name],['card-arrow','↗'],['card-meta',car.type],['card-tag',car.drive]];
  for(const [className,value] of entries){const span=document.createElement('span');span.className=className;span.textContent=value;button.append(span);}button.onclick=()=>selectCar(car);$('#car-list').append(button);
 }
 $('#car-list').scrollLeft=previousScroll;requestAnimationFrame(()=>{updateCollectionArrows();prepareCollection();});
}

function getCarAssets(car,progress=()=>{}){
 if(!cache.has(car.id))cache.set(car.id,(async()=>{const response=await fetch(`./vehicles/cars/${car.id}/${car.id}.car`);if(!response.ok)throw new Error('车辆参数加载失败，请刷新重试');const config=parseCar(await response.text());const data=carSpecs(config);const model=await (car.format==='gltf'?loadGltfVehicle:loadVehicle)(car,config,data,progress);return {model,data,config};})().catch(e=>{cache.delete(car.id);throw e;}));
 return cache.get(car.id);
}
async function prepareCollection(){
 // Only visible collection cards request full models. The home menu loads one car.
 if(mode!=='garage'||menuSection!=='garage'||document.hidden||!garage)return;
 thumbnailQueue.clear();const bounds=$('#car-list').getBoundingClientRect();
 for(const card of $$('.car-card')){const r=card.getBoundingClientRect();if(r.right>bounds.left&&r.left<bounds.right&&!thumbnails.has(card.dataset.car))thumbnailQueue.add(card.dataset.car);}
 if(thumbnailsRunning||!thumbnailQueue.size)return;thumbnailsRunning=true;
 let thumbRenderer;
 try{
  thumbRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true});thumbRenderer.setSize(360,180);thumbRenderer.outputColorSpace=THREE.SRGBColorSpace;thumbRenderer.toneMapping=THREE.ACESFilmicToneMapping;thumbRenderer.toneMappingExposure=1.05;
  const stage=new THREE.Scene();stage.environment=garage.environment;stage.environmentIntensity=.8;stage.add(new THREE.HemisphereLight('#e6edff','#3b4151',2.2));const light=new THREE.DirectionalLight('#ffffff',3);light.position.set(-4,6,-5);stage.add(light);
  const cam=new THREE.PerspectiveCamera(36,2,.1,30);cam.position.set(-5.4,2.3,-6.7);cam.lookAt(0,.5,0);
  while(thumbnailQueue.size&&mode==='garage'&&menuSection==='garage'&&!document.hidden){
   const id=thumbnailQueue.values().next().value;thumbnailQueue.delete(id);
   try{const car=CARS.find(c=>c.id===id),{model}=await getCarAssets(car);const clone=model.root.clone();clone.position.set(0,0,0);clone.rotation.set(0,0,0);stage.add(clone);thumbRenderer.render(stage,cam);const url=thumbRenderer.domElement.toDataURL('image/png');thumbnails.set(id,url);const img=document.querySelector(`[data-car="${id}"] .card-image`);if(img)img.src=url;stage.remove(clone);
   }catch(e){console.warn('Collection preview unavailable',id,e.message);}
   await new Promise(resolve=>setTimeout(resolve,100));
  }
 }catch(e){console.warn('Collection thumbnails unavailable:',e.message);}
 finally{thumbRenderer?.dispose();thumbRenderer?.forceContextLoss();thumbnailsRunning=false;}
}
function updateCollectionArrows(){const list=$('#car-list');$('#cars-prev').disabled=list.scrollLeft<2;$('#cars-next').disabled=list.scrollLeft+list.clientWidth>=list.scrollWidth-2;}
$('#cars-prev').onclick=()=>$('#car-list').scrollBy({left:-$('#car-list').clientWidth*.8,behavior:reducedMotion?'instant':'smooth'});
$('#cars-next').onclick=()=>$('#car-list').scrollBy({left:$('#car-list').clientWidth*.8,behavior:reducedMotion?'instant':'smooth'});
let previewTimer;
$('#car-list').addEventListener('scroll',()=>{updateCollectionArrows();clearTimeout(previewTimer);previewTimer=setTimeout(prepareCollection,180);},{passive:true});
function setMenuSection(section){
 if(mode==='drive')returnGarage();menuSection=section;$('#garage').dataset.section=section;$('#collection').hidden=section!=='garage';
 for(const [id,name] of [['home-nav','home'],['garage-nav','garage']]){const b=$('#'+id);b.classList.toggle('active',section===name);if(section===name)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
 if(section==='garage'){const chosen=$('.car-card.selected');if(chosen)$('#car-list').scrollLeft=chosen.offsetLeft-$('#car-list').offsetLeft;requestAnimationFrame(()=>{updateCollectionArrows();prepareCollection();});}
}
$('.home-menu').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;const buttons=[...$('.home-menu').querySelectorAll('button:not(:disabled)')],index=buttons.indexOf(e.target);if(index<0)return;e.preventDefault();buttons[(index+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length].focus();});
$('#home-nav').onclick=()=>setMenuSection('home');$('#collection-open').onclick=()=>setMenuSection('garage');
function refreshSearch(){renderCards($('.filter-tabs .selected').dataset.filter);$('#car-list').scrollLeft=0;}
$('#car-search').addEventListener('input',refreshSearch);$('#clear-search').onclick=()=>{$('#car-search').value='';refreshSearch();$('#car-search').focus();};
$('#car-list').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const cards=$$('.car-card'),index=cards.indexOf(e.target);if(index<0)return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?cards.length-1:Math.max(0,Math.min(cards.length-1,index+(e.key==='ArrowRight'?1:-1)));cards[next]?.focus();});


function renderPaint(){
 $('#paint-options').replaceChildren();for(const [i,color] of (['RB19','W33','MCL39'].includes(selected.id)?[selected.color]:[selected.color,'#294d45','#902e2b','#d8c29c','#2c3034']).entries()){
  const b=document.createElement('button');b.className='paint'+(i===0?' selected':'');b.style.backgroundColor=color;b.setAttribute('aria-label',['原色','森林绿','酒红','香槟金','石墨黑'][i]);b.title=b.getAttribute('aria-label');b.setAttribute('aria-pressed',String(i===0));b.onclick=()=>{if(!vehicle||loading)return;vehicle.paint.set(color);$$('.paint').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});};$('#paint-options').append(b);
 }
}
async function selectCar(car){
 const token=++loadId;loading=true;selected=car;saveMenu();document.body.classList.add('is-loading');$('#garage-drive').disabled=true;$('#challenge-confirm').disabled=true;$('#start-drive').disabled=true;$('#start-label').textContent='加载车型…';$('#preview-cabin').disabled=true;$('#car-brand').textContent=car.brand;
 $('#car-name').textContent=car.name;$('#car-era').textContent=(car.year?car.year+' · ':'')+car.era;$('#description').textContent=car.description;$('#spec-drive').textContent=car.drive;$('#spec-power').textContent='—';$('#spec-torque').textContent='—';$('#spec-gears').textContent='—';$('#spec-mass').textContent='—';$('#model-status').textContent='正在载入模型';$('#header-status').textContent='正在准备座驾';
 if(vehicle)garage.remove(vehicle.root);vehicle=null;cabin=false;lookX=lookY=0;orbit=-.8;zoom=1;updatePreview();renderCards($('.filter-tabs .selected').dataset.filter);renderPaint();
 try{
  const pending=getCarAssets(car,progress=>{if(token===loadId)$('#model-status').textContent=`模型加载 ${Math.round(progress*100)}%`;});
  const result=await pending;if(token!==loadId)return;
  vehicle=result.model;specs=result.data;vehicle.paint.set(car.color);vehicle.root.position.set(0,0,0);vehicle.root.rotation.set(0,0,0);vehicle.source.rotation.set(-Math.PI/2,0,0);garage.add(vehicle.root);state=createState();state.rpm=specs.idle;vehicle.update(state,0);
  $('#spec-gears').textContent=specs.gears.length;$('#spec-mass').textContent=Math.round(specs.mass).toLocaleString();$('#spec-power').textContent=Math.round(specs.power);$('#spec-torque').textContent=Math.round(specs.peakTorque);$('#start-drive').disabled=false;$('#challenge-confirm').disabled=false;$('#preview-cabin').disabled=false;$('#start-label').textContent=destination==='city'?'自由驾驶':'开始挑战';$('#model-status').textContent=car.quality;$('#header-status').textContent='座驾就绪 · 随时出发';loading=false;document.body.classList.remove('is-loading');$('#garage-drive').disabled=false;
 }catch(error){if(token!==loadId)return;loading=false;document.body.classList.remove('is-loading');$('#garage-drive').disabled=false;$('#model-status').textContent='载入失败 · 点击出发重试';$('#start-label').textContent='点击重试';$('#start-drive').disabled=false;notify(error.message);}
}
function updatePreview(){$('#preview-mode').textContent=cabin?'座舱视角':'外观视角';$('#preview-cabin').textContent=cabin?'返回外观 ↗':'查看内饰 ↗';$('#drag-hint').textContent=cabin?'拖动环顾 · C 视线回正':'拖动旋转 · 滚轮缩放';}
function setDriveInert(value){for(const child of $('#drive-ui').children)if(child.id!=='pause-overlay')child.inert=value;}
function setPaused(value,reason='驾驶已暂停'){
 if(mode!=='drive')return;paused=value;setDriveInert(value);resetInputs();$('#pause-overlay').hidden=!value;$('#pause-reason').textContent=reason;$('#pause-button').textContent=value?'继续 ▷':'暂停 Ⅱ';$('#pause-button').setAttribute('aria-pressed',String(value));$('#drive-tools').hidden=true;$('#drive-menu-toggle').setAttribute('aria-expanded','false');if(value)$('#resume-button').focus();else document.activeElement?.blur();if(value&&audioGain)audioGain.gain.setTargetAtTime(0,audioContext.currentTime,.1);lastTime=0;accumulator=0;
}
async function startAudio(){
 try{
  audioContext||=new AudioContext();await audioContext.resume();sfx||=createSfx(audioContext);
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
function bestKey(){return `openroad-best-v10-${destination}-${selected.id}-${assists?'assisted':'unassisted'}`;}
function resetSession(){
 state=createState();state.rpm=specs.idle;
 rewind.clear();skills.reset();stunts.reset();chase.reset();city.effects?.clear();city.props?.reset();rewinding=false;reverseHold=0;lastSectors=0;sectorExcursions=0;skillFlash=null;$('#rewind-overlay').hidden=true;
 if(line){line.mesh.removeFromParent();line.dispose();line=null;}
 if(city.route){line=createDrivingLine(city.route,specs,city.info.halfWidth);city.scene.add(line.mesh);}
 if(city.route){Object.assign(state,{x:city.spawn.x,z:city.spawn.z,yaw:city.spawn.yaw,groundHeight:city.spawn.y,roadPitch:Math.atan(city.spawn.grade)});lapTimer=createLapTimer(city.route,city.info.halfWidth,result=>{if(result.valid){try{const key=bestKey(),saved=JSON.parse(localStorage.getItem(key)||'null');localStorage.setItem(key,JSON.stringify({...lapTimer.best,sectorBests:lapTimer.sectorBests}));}catch{}const outcome=assessLap(result,currentTarget()),best=lapTimer.best?.time===result.time;showBanner({kicker:best?'NEW BEST LAP · 个人最佳':'LAP COMPLETE · 完成单圈',title:formatLap(result.time),detail:outcome.achieved?'挑战目标达成！':'距挑战目标 +'+outcome.delta.toFixed(3)+' 秒',tone:best?'#cc85ff':''},4400);sfx?.cue(best?'star':'bank',cueVolume());skills.award(best?'个人最佳圈':'完整单圈',best?1500:800);gainXp(best?2500:1200);}else notify(`本圈无效：${result.reason}`);});try{const saved=JSON.parse(localStorage.getItem(bestKey())||'null');if(saved&&Number.isFinite(saved.time)&&saved.time>15){lapTimer.best=saved;if(Array.isArray(saved.sectorBests)&&saved.sectorBests.length===3)lapTimer.sectorBests=saved.sectorBests.map(v=>Number.isFinite(v)&&v>0?v:null);}}catch{}lapTimer.update(state.x,state.z,0);
 }else lapTimer=null;
 vehicle.root.position.set(state.x,state.groundHeight||0,state.z);vehicle.root.rotation.set(state.roadPitch||0,state.yaw,0,'YXZ');vehicle.update(state,0);
 $('#lap-hud').hidden=!lapTimer;$('#stunt-card').hidden=true;$('#skill-hud').hidden=true;$('#banner').hidden=true;$('#cruise-button').hidden=false;$('#route-title').textContent=city.info?`${city.info.name} / 计时挑战`:'海港城 / 自由驾驶';$('#map-title').textContent=city.info?.title||'HARBOR CITY';
}
async function startDriving(){
 if(starting)return;if(!vehicle||loading){if(!loading)selectCar(selected);return;}
 const token=loadId,chosen=destination;starting=true;$('#start-drive').disabled=true;$('#garage-drive').disabled=true;$('#challenge-confirm').disabled=true;$('#start-label').textContent='准备驾驶场景…';
 try{
  if(!worlds.has(chosen)){const world=chosen==='city'?createCity():await createCircuit(CIRCUITS.find(c=>c.id===chosen));world.scene.environment=garage.environment;world.scene.environmentIntensity=.4;world.effects=createEffects(world.scene);if(chosen==='city'){addStuntGates(world.scene);world.stunts=true;}worlds.set(chosen,world);if(chosen==='city')for(const id of ['MI','3S','MC'])getCarAssets(CARS.find(c=>c.id===id)).then(({model})=>world.addParked(model,id)).catch(()=>{});}
  if(token!==loadId||chosen!==destination)return;city=worlds.get(chosen);garage.remove(vehicle.root);city.scene.add(vehicle.root);resetSession();resetInputs();cruise=false;lookX=lookY=0;paused=false;inspectDamage=false;$('#damage-view').textContent='查看车身';mode='drive';cabin=false;document.activeElement?.blur();
  setDriveInert(false);$('#garage').hidden=true;$('#drive-ui').hidden=false;$('#pause-overlay').hidden=true;document.body.classList.add('driving');$('#drive-brand').textContent=selected.brand;$('#drive-name').textContent=selected.name;$('#drive-cabin').textContent=city.info?city.info.name+' · 计时挑战':'海港城 · 自由驾驶';{const intro=$('#drive-intro');intro.classList.remove('show');void intro.offsetWidth;intro.classList.add('show');}$('#key-hints').classList.remove('faded');hintTimer=0;$('#shift-hint').hidden=!manual;applyCamera();updateCareerUI();$('#pause-button').textContent='暂停 Ⅱ';$('#pause-button').setAttribute('aria-pressed','false');updateHudMode();updateCruise();resize();startAudio();notify(lapTimer?'驶过黑白计时线开始计时 · 行车线：蓝色加速，黄色收油，红色刹车':'自由探索海港城 · 彩色拱门是测速点、区间测速和漂移区');
 }catch(error){notify(error.message);}finally{starting=false;$('#start-drive').disabled=loading;$('#garage-drive').disabled=loading;$('#challenge-confirm').disabled=loading||!vehicle;$('#start-label').textContent=destination==='city'?'自由驾驶':'开始挑战';}
}
function returnGarage(){
 if(mode!=='drive')return;skills.bank();if(line){line.mesh.removeFromParent();line.dispose();line=null;}rewinding=false;sfx?.update({muted:true});for(const id of ['#skill-hud','#banner','#stunt-card','#rewind-overlay'])$(id).hidden=true;updateCareerUI();setDriveInert(false);mode='garage';paused=false;cruise=false;resetInputs();audioSource?.stop();audioSource=null;audioCar=null;
 city.scene.remove(vehicle.root);vehicle.root.position.set(0,0,0);vehicle.root.rotation.set(0,0,0);vehicle.source.rotation.set(-Math.PI/2,0,0);garage.add(vehicle.root);state=createState();vehicle.update(state,0);cabin=false;lookX=lookY=0;updatePreview();
 $('#garage').hidden=false;$('#drive-ui').hidden=true;document.body.classList.remove('driving');$('#drive-tools').hidden=true;$('#drive-menu-toggle').setAttribute('aria-expanded','false');setMenuSection('home');resize();$('#home-nav').focus();
}
function updateCruise(){$('#cruise-button').setAttribute('aria-pressed',String(cruise));$('#cruise-button').textContent=cruise?'巡航 35 km/h · 点击取消':'启用 35 km/h 巡航';}
function input(dt=0){
 const pad=padState?.active?padState:null,gentle=keys.has('ShiftLeft')||keys.has('ShiftRight');
 const keyGo=keys.has('KeyW')||keys.has('ArrowUp')||touch.has('throttle')?(gentle?.28:1):0,keyStop=keys.has('KeyS')||keys.has('ArrowDown')||touch.has('brake')?(gentle?.22:1):0;
 let go=Math.max(keyGo,pad?.throttle||0),stop=Math.max(keyStop,pad?.brake||0);
 const handbrake=keys.has('Space')||touch.has('handbrake')||!!pad?.handbrake;
 // Arcade direction: hold the brake at a standstill to reverse; throttle drives forward again.
 const still=Math.hypot(state.speed,state.sideSpeed||0)<.45;
 if(state.direction!==-1){if(state.direction===0)state.direction=1;reverseHold=still&&stop>.3&&go<.1&&!cruise&&!state.damage.disabled?reverseHold+dt:0;if(reverseHold>.3&&setDirection(state,-1))reverseHold=0;}
 else if(still&&go>.3&&stop<.1)setDirection(state,1);
 if(state.direction===-1)[go,stop]=[stop,go];
 if((stop||handbrake)&&cruise){cruise=false;updateCruise();}
 const throttle=stop||handbrake?0:cruise?clamp((35/3.6-state.speed)*.65+.1,0,1):go;
 const keySteer=(keys.has('KeyA')||keys.has('ArrowLeft')||touch.has('left')?1:0)-(keys.has('KeyD')||keys.has('ArrowRight')||touch.has('right')?1:0);
 const analog=!keySteer&&!!pad&&Math.abs(pad.steer)>0;
 return {digital:!analog,precision:gentle,assists,sport:handling==='sport',manual,throttle,brake:cruise?Math.max(stop,clamp((state.speed-35/3.6)*.3,0,.4)):stop,handbrake,steer:analog?pad.steer:keySteer};
}
$('#damage-view').onclick=()=>{inspectDamage=!inspectDamage;$('#damage-view').textContent=inspectDamage?'返回座舱':'查看车身';};
function launchDrive(){if(loading||starting)return;if(!vehicle){selectCar(selected);return;}destination==='city'?startDriving():showChallenges();}
$('#start-drive').onclick=$('#garage-drive').onclick=launchDrive;$('#return-garage').onclick=returnGarage;$('#garage-nav').onclick=()=>setMenuSection('garage');
$('#reset-view').onclick=()=>{orbit=-.8;zoom=1;lookX=lookY=0;notify(cabin?'座舱视线已回正':'展示视角已重置');};
function updateHudMode(){$('#drive-ui').classList.toggle('compact-hud',compactHud);$('#hud-toggle').setAttribute('aria-pressed',String(compactHud));$('#hud-toggle').textContent=compactHud?'完整 HUD':'精简 HUD';}
$('#hud-toggle').onclick=()=>{compactHud=!compactHud;saveMenu();updateHudMode();};
$('#drive-menu-toggle').onclick=()=>{const open=$('#drive-tools').hidden;$('#drive-tools').hidden=!open;$('#drive-menu-toggle').setAttribute('aria-expanded',String(open));};
$('#pause-garage').onclick=returnGarage;

$('#preview-cabin').onclick=()=>{cabin=!cabin;lookX=lookY=0;updatePreview();};
$$('[data-filter]').forEach(b=>b.onclick=()=>{$$('[data-filter]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});renderCards(b.dataset.filter);$('#car-list').scrollLeft=0;updateCollectionArrows();prepareCollection();});
$('#reset-car').onclick=()=>{resetSession();cruise=false;lookX=lookY=0;resetInputs();updateCruise();notify(lapTimer?'车辆已修复，重新驶过计时线开始挑战':'车辆已修复并返回出发点');};
$('#pause-button').onclick=()=>setPaused(!paused);$('#resume-button').onclick=()=>{setPaused(false);startAudio();};
$('#cruise-button').onclick=()=>{if(paused)return;if(state.direction!==1){notify('请先向前行驶');return;}cruise=!cruise;updateCruise();if(cruise)notify('巡航已启用，方向仍由你控制；刹车可取消');};
$('#camera-button').onclick=$('#touch-camera').onclick=cycleCamera;
$('#sound-toggle').onclick=()=>{sound=!sound;updateSoundLabel();saveSettings();if(sound)startAudio();};
const openDialog=id=>{if(mode==='drive')setPaused(true,'关闭窗口后，点击继续驾驶');$(id).showModal();};
$('#guide-open').onclick=()=>openDialog('#guide-dialog');$('#sources-open').onclick=()=>openDialog('#about-dialog');$('#settings-open').onclick=$('#drive-settings').onclick=$('#pause-settings').onclick=()=>openDialog('#settings-dialog');
$$('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
$('#assists').onchange=e=>{handling=e.target.value;assists=handling!=='sim';saveSettings();if(mode==='drive'){resetSession();cruise=false;resetInputs();updateCruise();notify('操控风格已切换，本次行程重新开始');}};
$('#transmission').onchange=e=>{manual=e.target.value==='manual';$('#shift-hint').hidden=!manual;saveSettings();};
$('#line-mode').onchange=e=>{lineMode=e.target.value;saveSettings();};
$('#camera-mode').onchange=e=>{cameraMode=e.target.value;applyCamera();saveSettings();};
$('#quality').onchange=e=>{quality=e.target.value;resize();renderer.shadowMap.enabled=quality!=='low';renderer.shadowMap.needsUpdate=true;saveSettings();};
$('#fov').oninput=e=>{fov=Number(e.target.value);$('#fov-value').textContent=fov+'°';saveSettings();};
$('#seat-height').oninput=e=>{seat=Number(e.target.value)/100;$('#seat-value').textContent=seat?Math.round(seat*100)+' cm':'标准';saveSettings();};
$('#volume').oninput=e=>{volume=Number(e.target.value)/100;$('#volume-value').textContent=Math.round(volume*100)+'%';saveSettings();};
const handled=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyQ','KeyE','KeyC','KeyR','KeyB','KeyP','KeyH','Escape','ShiftLeft','ShiftRight'];
addEventListener('keydown',e=>{
 if($('dialog[open]')||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
 if(paused&&e.code==='Tab'){const buttons=[...$('#pause-overlay').querySelectorAll('button')],first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}return;}
 if(e.target.closest('button,a')&&['Space','Enter'].includes(e.code))return;
 if((mode==='drive'||cabin)&&handled.includes(e.code))e.preventDefault();
 if(e.code==='KeyC'){if(!e.repeat){if(mode==='drive')cycleCamera();else lookX=lookY=0;}return;}
 if(mode!=='drive'){if(e.code==='Escape'){if(cabin){cabin=false;updatePreview();}else setMenuSection('home');}if(e.code==='Enter'&&!e.repeat&&e.target===document.body)launchDrive();return;}
 if(e.code==='KeyH'&&!e.repeat){$('#hud-toggle').click();return;}
 if(e.code==='KeyP'||e.code==='Escape'){if(!e.repeat)setPaused(!paused);return;}
 if(manual&&(e.code==='KeyE'||e.code==='KeyQ')){if(!e.repeat)doShift(e.code==='KeyE'?1:-1);return;}
 if(!paused)keys.add(e.code);
});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{resetInputs();if(mode==='drive')setPaused(true,'窗口已失去焦点，车辆已暂停');});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='drive')setPaused(true,'页面已切换，车辆已暂停');if(!document.hidden)prepareCollection();});
$$('[data-control]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();if(paused)return;b.setPointerCapture(e.pointerId);controlPointers.set(e.pointerId,b.dataset.control);touch.add(b.dataset.control);b.classList.add('pressed');});for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,e=>{controlPointers.delete(e.pointerId);if(![...controlPointers.values()].includes(b.dataset.control)){touch.delete(b.dataset.control);b.classList.remove('pressed');}});});
let drag=null;
$('#viewport').addEventListener('pointerdown',e=>{if(paused||!renderer)return;$('#drive-tools').hidden=true;$('#drive-menu-toggle').setAttribute('aria-expanded','false');drag={x:e.clientX,y:e.clientY,id:e.pointerId};renderer.domElement.setPointerCapture(e.pointerId);});
$('#viewport').addEventListener('pointermove',e=>{if(!drag||paused)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;if((mode==='drive'&&!inspectDamage)||cabin){lookX=clamp(lookX-dx*.004,-1.5,1.5);lookY=clamp(lookY-dy*.003,-.5,.45);}else orbit-=dx*.008;});
for(const name of ['pointerup','pointercancel','lostpointercapture'])$('#viewport').addEventListener(name,()=>drag=null);
$('#viewport').addEventListener('wheel',e=>{if(mode==='garage'&&!cabin){e.preventDefault();zoom=clamp(zoom+e.deltaY*.0006,.65,1.4);}},{passive:false});
function resize(){if(!renderer)return;renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='low'?1:quality==='high'?2:1.5));renderer.setSize(innerWidth,innerHeight);updateCollectionArrows();camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
const localEye=new THREE.Vector3(),target=new THREE.Vector3();
function moveCamera(time){
 if(!vehicle)return;
 if(mode==='drive'&&inspectDamage){camera.clearViewOffset();camera.fov=48;const angle=state.yaw+orbit;camera.position.set(state.x+Math.sin(angle)*7.5,(state.groundHeight||0)+3.2,state.z-Math.cos(angle)*7.5);camera.lookAt(state.x,(state.groundHeight||0)+.65,state.z);}
 else if(mode==='garage'&&!cabin){
  const narrow=innerWidth<761&&innerHeight>540;const angle=orbit+(reducedMotion||drag?0:Math.sin(time*.08)*.045),dist=(narrow?14.5:9.7)*zoom;
  camera.fov=38;camera.position.set(Math.sin(angle)*dist,(narrow?4.5:2.6)*zoom,-Math.cos(angle)*dist);camera.lookAt(0,.62,0);camera.clearViewOffset();
  if(!narrow)camera.setViewOffset(innerWidth,innerHeight,-innerWidth*(menuSection==='home'?.13:.16),innerHeight*.04,innerWidth,innerHeight);
  else camera.setViewOffset(innerWidth,innerHeight,0,innerHeight*.005,innerWidth,innerHeight);
 }else if(mode==='drive'&&cameraMode!=='cockpit'){camera.clearViewOffset();chase.update(camera,{state,specs,mode:cameraMode,dt:frameDt,time,orbitX:lookX,orbitY:lookY,lookBack,fov,calm:reducedMotion});
 }else{
  camera.clearViewOffset();camera.fov=fov+(assists?clamp((Math.abs(state.speed)-15)/30,0,1)*5:0);localEye.copy(vehicle.eye);localEye.y+=seat;
  localEye.applyEuler(vehicle.root.rotation);camera.position.copy(vehicle.root.position).add(localEye);const pulse=state.impactPulse||0;camera.position.y+=Math.sin(time*49)*pulse*.032;camera.position.x+=Math.sin(time*37)*pulse*.018;
  const side=(manual&&mode==='drive'?0:keys.has('KeyQ')?1.05:keys.has('KeyE')?-1.05:0)+(lookBack?2.7:0);
  const gaze=state.yaw+lookX+side,pitch=lookY+(state.roadPitch||0)-.025-clamp(state.visualAcceleration*.0018,-.015,.025);
  target.set(-Math.sin(gaze)*Math.cos(pitch),Math.sin(pitch),-Math.cos(gaze)*Math.cos(pitch));camera.lookAt(camera.position.clone().add(target));
  camera.rotateZ(clamp(-state.visualLateral*.002,-.016,.016)+Math.sin(time*28)*(state.impactPulse||0)*.012);
 }
 camera.updateProjectionMatrix();
}
const map=$('#minimap').getContext('2d');
const MAP_SIZE=440,MAP_CENTER=220,MAP_RADIUS=212;
function drawMap(){
 const speed=Math.abs(state.speed),scale=(city?.route?1.25:1.55)-clamp(speed/70,0,1)*.45,yaw=state.yaw,cos=Math.cos(yaw),sin=Math.sin(yaw),cy=MAP_CENTER+46;
 map.setTransform(1,0,0,1,0,0);map.clearRect(0,0,MAP_SIZE,MAP_SIZE);map.fillStyle='#161b28';map.fillRect(0,0,MAP_SIZE,MAP_SIZE);
 // Heading-up: the world turns around the car.
 map.translate(MAP_CENTER,cy);map.rotate(yaw);map.scale(scale,scale);map.translate(-state.x,-state.z);map.lineJoin=map.lineCap='round';
 if(city?.route){
  const route=city.route,width=Math.max(city.info.halfWidth*2,9);
  map.beginPath();route.points.forEach((p,i)=>i?map.lineTo(p.x,p.z):map.moveTo(p.x,p.z));map.closePath();map.strokeStyle='#0b0e16';map.lineWidth=width+7;map.stroke();map.strokeStyle='#8f9bb0';map.lineWidth=width;map.stroke();
  const start=route.at(0);map.strokeStyle='#fff';map.lineWidth=5;map.beginPath();map.moveTo(start.x+start.tz*width*.7,start.z-start.tx*width*.7);map.lineTo(start.x-start.tz*width*.7,start.z+start.tx*width*.7);map.stroke();
 }else{
  map.fillStyle='#3d6f82';map.fillRect(300,-900,900,1800);map.fillStyle='#48516a';map.fillRect(-294,-294,588,588);
  map.fillStyle='#222938';for(let ix=0;ix<6;ix++)for(let iz=0;iz<6;iz++)map.fillRect(STREETS[ix]+10.5,STREETS[iz]+10.5,59,59);
  map.fillStyle='#2f4a3a';map.fillRect(STREETS[4]+19,STREETS[3]+19,42,42);map.fillRect(STREETS[1]+19,STREETS[1]+19,42,42);
  for(const stunt of STUNTS)if(stunt.path){map.strokeStyle=STUNT_COLORS[stunt.kind]+'88';map.lineWidth=13;map.beginPath();stunt.path.forEach(([x,z],i)=>i?map.lineTo(x,z):map.moveTo(x,z));map.stroke();}
 }
 map.setTransform(1,0,0,1,0,0);
 if(city?.stunts)for(const stunt of STUNTS){
  // Icons stay upright and pin to the rim when out of range.
  const g=stunt.gates[0],dx=(g.x-state.x)*scale,dz=(g.z-state.z)*scale;let x=dx*cos-dz*sin,y=dx*sin+dz*cos;const far=Math.hypot(x,y+46),edge=MAP_RADIUS-18;
  if(far>edge){const k=edge/far;x*=k;y=(y+46)*k-46;}
  const done=(career.data.stars[stunt.id]||0)>=3,r=far>edge?9:13;map.beginPath();map.arc(MAP_CENTER+x,cy+y,r,0,Math.PI*2);map.fillStyle=STUNT_COLORS[stunt.kind];map.fill();map.lineWidth=3;map.strokeStyle=done?'#ffd23f':'#10131d';map.stroke();
  map.fillStyle='#10131d';map.font=`900 ${r+3}px sans-serif`;map.textAlign='center';map.textBaseline='middle';map.fillText(stunt.kind==='trap'?'S':stunt.kind==='zone'?'Z':'D',MAP_CENTER+x,cy+y+1);
 }
 map.translate(MAP_CENTER,cy);map.fillStyle='#fff';map.strokeStyle='#f32483';map.lineWidth=4;map.beginPath();map.moveTo(0,-17);map.lineTo(11,12);map.lineTo(0,6);map.lineTo(-11,12);map.closePath();map.fill();map.stroke();map.setTransform(1,0,0,1,0,0);
 $('#map-north').style.setProperty('--bearing',yaw.toFixed(3)+'rad');
}
function updateStuntCard(){
 const card=$('#stunt-card');if(!city?.stunts){card.hidden=true;return;}
 const run=stunts.run,near=run?null:stunts.nearest(state.x,state.z,120);if(!run&&!near){card.hidden=true;return;}
 const stunt=(run||near).stunt,best=career.data.records[stunt.id];card.hidden=false;card.style.setProperty('--tone',STUNT_COLORS[stunt.kind]);
 $('#stunt-kind').textContent=STUNT_KIND[stunt.kind]+(run?' · 进行中':'');$('#stunt-name').textContent=stunt.name;
 $('#stunt-value').textContent=run?stuntValue(stunt,run.value):best?stuntValue(stunt,best):'—';$('#stunt-unit').textContent=run?stunt.unit:best?stunt.unit+' · 个人最佳':'尚无成绩';
 renderStars($('#stunt-stars'),run?starsFor(stunt,run.value):career.data.stars[stunt.id]||0);
 $('#stunt-meta').textContent=(run?'':`距离 ${Math.round(near.distance)} m · `)+`目标 ★ ${stunt.targets.join(' / ')} ${stunt.unit}`;
}
function updateSkillHUD(){
 const hud=$('#skill-hud'),flash=skillFlash&&performance.now()<skillFlash.until?skillFlash:null,view=skills.view();
 if(view.idle&&!flash){if(!hud.hidden)hud.hidden=true;return;}
 hud.hidden=false;hud.classList.toggle('banked',view.idle&&flash.kind==='banked');hud.classList.toggle('lost',view.idle&&flash.kind==='lost');
 $('#skill-score').textContent=(view.idle?flash.score:view.score).toLocaleString();$('#skill-mult').hidden=view.idle;$('#skill-mult').textContent='×'+view.multiplier;
 $('#skill-name').textContent=view.idle?flash.label:view.active?.name||view.recent[0]?.name||'';$('#skill-timer').style.setProperty('--left',view.idle?0:view.time.toFixed(3));
 const key=view.idle?'':view.recent.map(r=>r.name+r.points).join('|');if(key!==recentKey){recentKey=key;const list=$('#skill-recent');list.replaceChildren();if(!view.idle)for(const item of view.recent){const li=document.createElement('li'),points=document.createElement('b');li.textContent=item.name;points.textContent='+'+item.points.toLocaleString();li.append(points);list.append(li);}}
}
// Per-frame instruments: needle-smooth tach, pedals, map and skill chain.
function updateFastHUD(){
 const ratio=clamp(state.rpm/specs.redline,0,1);$('#tach-fill').style.strokeDasharray=(ratio*75).toFixed(2)+' 100';$('.cluster').classList.toggle('redline',ratio>.94&&state.direction===1&&!rewinding);
 $('#throttle-fill').style.setProperty('--v',Math.round(state.throttle*100)+'%');$('#brake-fill').style.setProperty('--v',Math.round(state.brakePressure*100)+'%');
 $('#drive-ui').style.setProperty('--rush',reducedMotion?'0':clamp((Math.abs(state.speed)-32)/50,0,1).toFixed(2));
 drawMap();updateSkillHUD();
}
function updateHUD(i){
 {const sport=handling==='sport',on=(id,value)=>$(id).classList.toggle('on',!!value);
 $('#handling-state').textContent=state.damage.disabled?'车辆损坏 · 按住 R 倒带或在选项中重置':sport&&state.drift>.6&&Math.abs(state.speed)>8?'漂移中 · 按住方向和油门保持':state.stabilityActive?'稳定辅助介入':state.tractionCut>.08?'牵引控制介入':state.wheelspin>.12?'驱动轮打滑':Math.abs(state.frontSlip)>.12?'前轮接近抓地极限':handling==='casual'?'休闲模式 · 全辅助':sport?'运动模式 · 手刹可漂移':'模拟模式 · 无辅助';
 on('#light-abs',assists&&state.brakePressure>.5&&Math.abs(state.speed)>4&&state.frontGrip>.96);on('#light-tcs',assists&&state.tractionCut>.08);on('#light-stm',state.stabilityActive);on('#light-hb',i.handbrake||state.brakeHold);}
 const damage=state.damage;$('#damage-hud').hidden=damage.revision===0;$('#damage-status').textContent=damage.disabled?'车辆无法继续行驶 · 请修复重置':'车辆受损';$('#damage-detail').textContent=`动力 ${Math.round((damage.disabled?0:Math.max(.15,1-damage.engine*.7-damage.structure*.15))*100)}% · 制动 ${Math.round((1-damage.brakes*.55)*100)}% · 转向 ${Math.round((1-damage.steering*.48)*100)}%`;

 $('#drive-ui').style.setProperty('--impact',String(state.impactPulse||0));$('#speed').textContent=String(Math.round(Math.abs(state.speed)*3.6));$('#rpm').textContent=Math.round(state.rpm/10)*10;$('#gear-number').textContent=state.direction===0?'N':state.direction<0?'R':String(state.gear);$('#brake-state').textContent=state.brakeHold?'制动保持':i.handbrake?'手刹':state.direction<0?'倒车':manual?'手动挡':'自动挡';$('#brake-state').classList.toggle('braking',state.brakeHold||i.handbrake||state.brakePressure>.04);$('#distance').textContent=(state.distance/1000).toFixed(2)+' km';$('#road-name').textContent=city.info?`${city.info.name} · ${(city.info.length/1000).toFixed(3)} km`:Math.abs(state.x)<12?'滨海大道':state.x>200?'港湾环路':'中央街区';updateStuntCard();
 if(lapTimer){
  updateChallengeHUD();
  const v=timingView(lapTimer),signed=n=>(n>0?'+':'')+n.toFixed(3);
  $('#lap-clock').textContent=formatLap(lapTimer.time);$('#timing-lap').textContent=lapTimer.start===null?'OUT LAP':`LAP ${String(lapTimer.lap).padStart(2,'0')}`;
  $('#lap-state').textContent=lapTimer.start===null?'驶过计时线开始':!lapTimer.valid?'圈速删除 · '+lapTimer.reason:lapTimer.trackWarning?'返回赛道 · 2 秒容错':`S${v.active+1} · 计时中`;
  $('#lap-hud').classList.toggle('invalid',!lapTimer.valid);$('#lap-best').textContent=formatLap(lapTimer.best?.time);$('#lap-last').textContent=lapTimer.last?(lapTimer.last.valid?formatLap(lapTimer.last.time):'无效圈'):'—';
  $('#lap-delta').textContent=Number.isFinite(v.delta)?signed(v.delta):'—';$('#lap-delta').className=Number.isFinite(v.delta)?(v.delta<=0?'gain':'loss'):'';
  v.sectors.forEach((sector,i)=>{const cell=$(`[data-sector-cell="${i+1}"]`);cell.className=`sector-cell ${sector.status}`+(i===v.active&&!v.hold&&lapTimer.start!==null?' active':'');$(`[data-sector="${i+1}"]`).textContent=Number.isFinite(sector.value)?sector.value.toFixed(3):i===v.active&&lapTimer.start!==null?(lapTimer.time-lapTimer.sectors.reduce((a,b)=>a+b,0)).toFixed(3):'—';$(`[data-sector-delta="${i+1}"]`).textContent=sector.status==='invalid'?'无效':Number.isFinite(sector.delta)?signed(sector.delta):Number.isFinite(sector.value)?'基准成绩':i===v.active&&lapTimer.start!==null?'进行中':'待计时';});
 }
}
let lastCollision=0;
function animate(timestamp){
 requestAnimationFrame(animate);if(!renderer||document.hidden){lastTime=0;return;}
 const dt=lastTime?Math.min((timestamp-lastTime)/1000,.1):0;lastTime=timestamp;frameDt=dt;
 if(vehicle&&mode==='drive'){
  padState=gamepad.poll(timestamp/1000);
  if(padState&&!$('dialog[open]')){const edge=padState.edges;if(edge.pause){setPaused(!paused);if(!paused)startAudio();}if(!paused){if(edge.camera)cycleCamera();if(manual&&edge.shiftUp)doShift(1);if(manual&&edge.shiftDown)doShift(-1);}}
  const controls=input(paused?0:dt),pad=padState?.active?padState:null;
  lookBack=!paused&&(keys.has('KeyB')||!!pad?.lookBack);
  if(pad&&(pad.lookX||pad.lookY)){lookX=pad.lookX*1.5;lookY=pad.lookY*.4;}else if(!drag&&!inspectDamage){const ease=Math.exp(-dt*3.5);lookX*=ease;lookY*=ease;}
  if(!paused){
   const wantRewind=keys.has('KeyR')||touch.has('rewind')||!!pad?.rewind;
   if(wantRewind&&!rewinding&&rewind.available>.4){rewinding=true;rewindSpent=0;rewindTotal=rewind.available;cruise=false;updateCruise();skills.reset();stunts.reset();sfx?.cue('rewind',cueVolume());$('#rewind-overlay').hidden=false;}
   let hit=0;
   if(rewinding){
    // Scrub back through the snapshot buffer; physics resumes when released.
    const more=rewind.scrub(state,dt*1.7);rewindSpent+=dt*1.7;$('#rewind-bar').style.setProperty('--left',Math.round(clamp(1-rewindSpent/rewindTotal,0,1)*100)+'%');
    if(city.route)state.groundHeight=city.route.nearest(state.x,state.z).y;
    if(!more||(!wantRewind&&rewindSpent>1.1)){rewinding=false;rewind.commit(state);state.keyHeld=0;accumulator=0;reverseHold=0;$('#rewind-overlay').hidden=true;if(lapTimer){lapTimer.invalidate('使用了倒带');lapTimer.previous=null;}}
   }else{
    accumulator+=dt;
    while(accumulator>=1/120){
     controls.offRoad=!!lapTimer?.offRoad;if(city.route){const ground=city.route.nearest(state.x,state.z);controls.grade=ground.grade*(-Math.sin(state.yaw)*ground.tx-Math.cos(state.yaw)*ground.tz);state.groundHeight=ground.y;state.roadPitch=Math.atan(controls.grade);}
     step(state,controls,specs,1/120,city.world);if(lapTimer)lapTimer.update(state.x,state.z,1/120);
     const smashed=city.props?.collide(state,specs)||0;if(smashed){skills.smash(45*smashed);playImpact(2.2);gamepad.rumble(.25,.5,90);}
     rewind.record(state,1/120);accumulator-=1/120;
     if(state.collision){hit=Math.max(hit,state.impact.speed);if(timestamp-lastCollision>180){lastCollision=timestamp;playImpact(state.impact.speed);cruise=false;updateCruise();gamepad.rumble(Math.min(1,state.impact.speed/12),.4,160);if(state.impact.speed>4)notify(`撞击${state.impact.kind} · 按住 R 倒带`);}}
    }
    const slip=Math.atan2(state.sideSpeed||0,Math.max(Math.abs(state.speed),3));
    skills.update(dt,{speed:state.speed,slip,wheelspin:state.wheelspin,handbrake:controls.handbrake,impact:hit,fastSpeed:city.route?58:42});
    if(city.stunts)stunts.update(dt,{x:state.x,z:state.z,speed:state.speed,slip});
    if(lapTimer&&lapTimer.sectors.length!==lastSectors){if(lapTimer.sectors.length>lastSectors&&lapTimer.valid&&lapTimer.excursions===sectorExcursions)skills.award('干净赛段',400);lastSectors=lapTimer.sectors.length;sectorExcursions=lapTimer.sectors.length?lapTimer.excursions:0;}
    if(pad&&Math.abs(state.rearSlip)>.25&&Math.abs(state.speed)>8)gamepad.rumble(0,.18,60);
    if(Math.abs(state.speed)>5){hintTimer+=dt;if(hintTimer>7)$('#key-hints').classList.add('faded');}
   }
   vehicle.root.position.set(state.x,state.groundHeight||0,state.z);vehicle.root.rotation.set(state.roadPitch||0,state.yaw,0,'YXZ');vehicle.update(state,dt);city.follow(state.x,state.z);
   city.props?.update(dt);
  }
  const offRoad=!!lapTimer?.offRoad;
  city.effects?.update(paused?0:dt,{state,vehicle,camera,viewportHeight:renderer.domElement.height,offRoad,handbrake:controls.handbrake,enabled:!paused&&!rewinding});
  if(line)line.update(lapTimer?.progress||0,Math.abs(state.speed),state.direction<0?'off':lineMode);
  uiTime+=dt;if(uiTime>.075){updateHUD(controls);uiTime=0;}
  updateFastHUD();
  const slide=clamp(Math.max((Math.abs(state.rearSlip)-.1)*3.5,(Math.abs(state.frontSlip)-.12)*4,state.wheelspin*.5,controls.handbrake&&Math.abs(state.speed)>4?.8:0),0,1)*(Math.abs(state.speed)>3||state.wheelspin>.2?1:0);
  sfx?.update({slip:slide,speed:Math.abs(state.speed),volume,muted:!sound||paused||rewinding,offRoad});
  if(audioSource&&audioGain){audioSource.playbackRate.setTargetAtTime(clamp(state.rpm/3000,.45,2.5),audioContext.currentTime,.05);audioGain.gain.setTargetAtTime(sound&&!paused&&!rewinding&&!state.damage.disabled?volume*(.3+state.throttle*.5):0,audioContext.currentTime,.08);}
 }
 moveCamera(timestamp/1000);renderer.render(mode==='drive'?city.scene:garage,camera);
}
try{
 renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;renderer.shadowMap.enabled=quality!=='low';renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 $('#viewport').append(renderer.domElement);renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();if(mode==='drive')setPaused(true);fatal(new Error('图形渲染已中断，请关闭其他占用显卡的页面后重新载入。'));});
 garage=createGarage();garage.environment=makeEnvironment(renderer);garage.environmentIntensity=.65;camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.025,5000);resize();addEventListener('resize',resize);const initialFilter=carsInCollection('modern').some(c=>c.id===selected.id)?'modern':'classic';$$('[data-filter]').forEach(b=>{const active=b.dataset.filter===initialFilter;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});renderCards(initialFilter);selectCar(selected);requestAnimationFrame(animate);
}catch(error){fatal(new Error('无法启动三维画面。请使用支持 WebGL 2 的浏览器并开启硬件加速。'+error.message));}

$('#destination-open').onclick=$('#events-nav').onclick=()=>openDialog('#destination-dialog');
function updateDestination(){
 const info=CIRCUITS.find(c=>c.id===destination);$('#destination-title').textContent=info?.title||'HARBOR CITY';$('#destination-subtitle').textContent=info?`${info.name} · ${(info.length/1000).toFixed(3)} km · 计时挑战`:'海港城 · 自由驾驶';$('#start-destination').textContent=info?.name||'海港城 · 自由探索';if(!loading&&!starting)$('#start-label').textContent=info?'开始挑战':'自由驾驶';
 $$('[data-destination]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.destination===destination)));
 const source=document.querySelector(`[data-track-map="${destination}"]`),map=$('#destination-map');map.replaceChildren();if(source){map.setAttribute('viewBox',source.getAttribute('viewBox')||'0 0 120 80');for(const child of source.children)map.append(child.cloneNode(true));}
}
$$('[data-destination]').forEach(button=>button.onclick=()=>{destination=button.dataset.destination;saveMenu();updateDestination();$('#destination-dialog').close();notify(destination==='city'?'已选择海港城 · 点击自由驾驶出发':'场地已选择 · 点击开始挑战设置目标');});

for(const info of CIRCUITS)fetch(`./circuits/${info.id}.geojson`).then(r=>r.json()).then(geo=>{const route=buildRoute(geo),b=route.bounds,svg=document.querySelector(`[data-track-map="${info.id}"]`);svg.setAttribute('viewBox',`${b.minX-45} ${b.minZ-45} ${b.maxX-b.minX+90} ${b.maxZ-b.minZ+90}`);const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',route.points.map((p,i)=>`${i?'L':'M'}${p.x},${p.z}`).join(' ')+'Z');path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','22');path.setAttribute('stroke-linejoin','round');svg.append(path);if(info.id===destination)updateDestination();}).catch(()=>{});

const targetChoices={};
function currentTarget(){return resolveTarget(destination,targetChoices[destination]);}
function savedBest(){if(mode==='drive'&&lapTimer)return lapTimer.best?.time;try{return JSON.parse(localStorage.getItem(bestKey())||'null')?.time;}catch{return null;}}
function showChallenges(){
 const info=CIRCUITS.find(c=>c.id===destination);if(!info)return;
 try{targetChoices[destination]||=localStorage.getItem('openroad-target-v1-'+destination);}catch{}
 const active=currentTarget(),best=savedBest(),earned=earnedTargets(destination,best);
 $('#challenge-title').textContent=info.name+' · 挑战目标';
 $('#challenge-context').textContent=`${selected.name} · ${assists?'辅助开启':'自由操控'} · 个人最佳 ${formatLap(best)}。仅有效整圈可达成；成绩按车型、赛道与辅助模式独立保存。`+(destination==='nordschleife'?' 北环标杆为非 F1 原型赛车纪录，贝洛夫采用历史布局，均仅供参考。':destination==='redbullring'?' 16 米宽版、平面路线，适合先熟悉刹车点。':'');
 const container=$('#challenge-options');container.replaceChildren();
 for(const target of targetsFor(destination)){
  const row=document.createElement('div');row.className='challenge-option'+(target.kind==='driver'?' driver-target':'');
  const button=document.createElement('button');button.type='button';button.setAttribute('aria-pressed',String(active.id===target.id));
  const label=document.createElement('strong');label.textContent=target.name;
  const time=document.createElement('b');time.textContent=formatLap(target.time);
  const caption=document.createElement('small');caption.textContent=target.session;
  const status=document.createElement('span');status.textContent=earned.includes(target.id)?'✓ 已达成':target.kind==='driver'?'车手标杆':'游戏目标';status.className=earned.includes(target.id)?'earned':'';
  button.append(label,time,caption,status);button.onclick=()=>{targetChoices[destination]=target.id;try{localStorage.setItem('openroad-target-v1-'+destination,target.id);}catch{}container.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));updateChallengeHUD();};row.append(button);
  if(target.source){const source=document.createElement('a');source.href=target.source;source.target='_blank';source.rel='noreferrer';source.textContent='核对官方来源 ↗';row.append(source);}container.append(row);
 }
 $('#challenge-confirm').disabled=loading||!vehicle||starting;$('#challenge-confirm').textContent=mode==='drive'?'继续挑战 ↗':'带着目标出发 ↗';openDialog('#challenge-dialog');
}
function updateChallengeHUD(){
 const target=currentTarget();if(!target)return;
 $('#challenge-name').textContent=target.name;$('#challenge-time').textContent=formatLap(target.time);
 $('#challenge-state').textContent=!lapTimer||lapTimer.start===null?'点击切换目标 ↗':!lapTimer.valid?'本圈无效 · 不计入挑战':lapTimer.time<=target.time?`目标剩余 ${formatLap(target.time-lapTimer.time)}`:`已超目标 +${(lapTimer.time-target.time).toFixed(3)}s`;
 const result=assessLap(lapTimer?.last,target);$('#challenge-result').textContent=lapTimer?.last?!result.valid?'上一圈无效 · 未结算':`${result.achieved?'目标达成 ✓':'未达成'} · 上圈 ${result.delta>0?'+':''}${result.delta.toFixed(3)}s`:'有效完圈后结算';
 $('#challenge-open').classList.toggle('achieved',result.achieved);
}
$('#challenge-open').onclick=showChallenges;
$('#challenge-confirm').onclick=()=>{if(loading)return;$('#challenge-dialog').close();if(mode==='drive'){setPaused(false);startAudio();}else startDriving();};
// ?debug exposes read-only handles for automated checks.
if(new URLSearchParams(location.search).has('debug'))window.__game={get state(){return state;},get specs(){return specs;},get mode(){return mode;},get lapTimer(){return lapTimer;},get city(){return city;},skills,stunts,career,rewind,get line(){return line;},selectCar:id=>selectCar(CARS.find(c=>c.id===id))};
// Remember menu choices without changing the existing records/settings storage.
updateDestination();updateHudMode();
try{targetChoices[destination]=localStorage.getItem('openroad-target-v1-'+destination);}catch{}
