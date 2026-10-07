export const CARS = [
 {id:'W33',year:2026,brand:'MERCEDES · GALAXY CONCEPT',name:'W33',era:'原创幻想赛车 · 动力 +90%',category:'sports',type:'银河方程式 / 中置后驱',color:'#b9d3de',accent:'#54f7de',description:'银色星河与青绿流光。1396.5 kW 幻想动力、更强下压力和长齿比，带来高速而顺滑的过弯体验。基于社区方程式底盘的原创概念车，非奔驰官方车型。',drive:'RWD',format:'gltf',model:'../RB19/model.glb',formula:true,modelLength:5.6,eye:[0,.8,.04],cabin:'中央单座 · 银河座舱 · 实时方向盘仪表',quality:'原创 W33 涂装 · RB19 衍生底盘 · 幻想调校',audioPath:'./vehicles/cars/EF/engine.wav'},
 {id:'RB19',year:2023,brand:'RED BULL RACING',name:'RB19',era:'高下压力方程式',category:'sports',type:'方程式赛车 / 中置后驱',color:'#152240',accent:'#ffcc19',description:'低坐姿、Halo 与红牛涂装。快速转向，随速度增长的空气下压力，让高速弯成为主场。社区模型与游戏近似调校，非车队官方模拟器。',drive:'RWD',format:'gltf',model:'model.glb',modelLength:5.6,eye:[0,.8,.04],cabin:'中央单座 · Halo · 原车方向盘',quality:'Redgrund 社区 RB19 · 高下压力调校',audioPath:'./vehicles/cars/EF/engine.wav'},
 {id:'M4',year:2021,brand:'BMW',name:'M4 Competition',era:'G82 · 双涡轮直列六缸',category:'sports',type:'现代性能轿跑 / 前置后驱',color:'#b9c934',accent:'#d6ee8c',description:'数字仪表，M 运动方向盘，熟悉而精细的 G82 座舱。带着 510 马力，驶入城市或挑战纽北。',drive:'RWD',format:'gltf',model:'scene.gltf',modelLength:4.794,eye:[-.392,1.10,.08],cabin:'左舵 · G82 数字座舱',quality:'2021 G82 · 独立精细座舱 · 原车方向盘',audioPath:'./vehicles/cars/CS/engine.wav'},
 {id:'P1',brand:'McLAREN',name:'P1 GTR',era:'赛道版 · V8 混合动力',category:'sports',type:'英国超跑 / 中置后驱',color:'#f09024',accent:'#f5b86b',description:'低坐姿，长尾翼。沿纽北的森林疾驰，用细致的刹车和油门寻找下一次突破。',drive:'RWD',format:'gltf',model:'model.glb',modelLength:4.588,eye:[-.365,.80,.10],cabin:'左舵 · 社区赛道座舱',quality:'P1 GTR 独立模型 · 近似动力调校',audioPath:'./vehicles/cars/EF/engine.wav'},
 {id:'REV',year:2023,brand:'LAMBORGHINI',name:'Revuelto',era:'V12 混合动力 · 八速',category:'sports',type:'意式超跑 / 四轮驱动',color:'#b9d544',accent:'#d6ee8c',description:'锋利的轮廓，鲜明的 V12 个性。四轮驱动与更从容的牵引力，让每段出弯都有新的期待。',drive:'AWD',format:'gltf',model:'scene.gltf',modelLength:4.947,eye:[-.445,.98,.02],cabin:'左舵 · 独立内饰与方向盘',quality:'Revuelto 独立模型 · 近似动力调校',audioPath:'./vehicles/cars/EF/engine.wav'},
  {id:'TC6',brand:'TOYOTA',name:'Celica GT-Four',era:'第六代 · ST205',category:'sports',type:'拉力血统 / 双门跑车',color:'#cbd8df',accent:'#c3d9e7',description:'四轮驱动，涡轮扭矩。沿着海岸线，重新认识九十年代的驾驶乐趣。',drive:'AWD',viewOffset:[0,-.02,.12],cabin:'右舵 · 经典座舱',quality:'独立座舱与车身模型'},
  {id:'MI',brand:'MINI',name:'Classic Mini',era:'经典款 · 1.3',category:'daily',type:'城市经典 / 轻量掀背',color:'#b74d36',accent:'#e39b7d',description:'小车身，短轴距。穿过街角，感受轻巧直接的城市驾驶。',drive:'FWD',viewOffset:[0,-.085,.17],cabin:'左舵 · 经典横向仪表台',quality:'独立座舱与车身模型'},
  {id:'3S',brand:'MAZDA',name:'Mazda 3',era:'第一代 · 2.3',category:'daily',type:'日常驾驶 / 运动轿车',color:'#697b92',accent:'#a6bbd4',description:'熟悉的日常，也可以值得期待。用一辆自然吸气轿车探索整座城市。',drive:'FWD',viewOffset:[0,-.075,.22],cabin:'左舵 · 基础座舱',quality:'基础座舱模型'},
  {id:'EF',brand:'FERRARI',name:'Enzo',era:'中置 V12 · 六速',category:'sports',type:'意式超跑 / 中置后驱',color:'#bc251e',accent:'#e39883',description:'低矮的车身，中置 V12。让海港大道，成为你的下一段驾驶记忆。',drive:'RWD',viewOffset:[0,-.015,.16],cabin:'左舵 · V12 超跑座舱',quality:'独立车身与座舱模型',license:'GPL-2.0',audioPath:'./vehicles/cars/EF/engine.wav'},
  {id:'G4',brand:'FORD',name:'GT40',era:'经典 V8 · 四速',category:'sports',type:'耐力赛经典 / 中置后驱',color:'#85bfd2',accent:'#d0a57d',description:'低坐姿，宽后胎，鲜明的赛车涂装。把经典耐力赛车开进城市。',drive:'RWD',viewOffset:[-.27,-.025,.34],cabin:'左舵 · 经典赛车座舱',quality:'独立车身与座舱模型',license:'GPL-2.0',audioPath:'./vehicles/cars/EF/engine.wav'},
  {id:'CS',brand:'PORSCHE',name:'911 Club Sport',era:'3.2 · 水平对置六缸',category:'sports',type:'德系经典 / 后置后驱',color:'#dedcd1',accent:'#d3c49d',description:'熟悉的圆形车灯，独特的后置引擎布局。用更纯粹的方式感受街道。',drive:'RWD',viewOffset:[0,-.045,.12],cabin:'左舵 · 基础一体式座舱',quality:'一体式车身与基础内饰'},
  {id:'TL2',brand:'TOYOTA',name:'Corolla Levin',era:'AE86 · 1.6',category:'sports',type:'日系轻跑 / 前置后驱',color:'#e4e1d5',accent:'#d3cab1',description:'轻量车身与自然吸气引擎。每一次转向，都让城市的小路更有意思。',drive:'RWD',viewOffset:[0,-.035,.14],cabin:'左舵 · 经典日系座舱',quality:'独立车身与座舱模型'},
  {id:'MC',brand:'MINI',name:'Cooper S',era:'1.6 · 六速',category:'daily',type:'城市钢炮 / 前置前驱',color:'#214d46',accent:'#b3c7aa',description:'紧凑的车身，活跃的动力。让通勤的街区，多一点驾驶乐趣。',drive:'FWD',viewOffset:[0,-.025,.12],cabin:'左舵 · 基础一体式座舱',quality:'一体式车身与基础内饰'},
];

export function parseCar(text){
  const out={};let current={};
  for(const raw of text.split(/\r?\n/)){
    const line=raw.split('#')[0].trim();if(!line)continue;
    if(line.startsWith('[')){current=out[line.slice(1,-1)]={};continue;}
    const i=line.indexOf('=');if(i<0)continue;
    const key=line.slice(0,i).trim(),value=line.slice(i+1).trim();
    current[key]=value.includes(',')?value.split(',').map(v=>isNaN(Number(v.trim()))?v.trim():Number(v.trim())):(!isNaN(Number(value))?Number(value):value);
  }
  return out;
}
export function tireDimensions(size){
 const [mm,aspect,inches]=size;return {radius:inches*.0254/2+mm/1000*aspect/100,width:mm/1000,rim:inches*.0254};
}
export function carSpecs(config){
  const e=config.engine,t=config.transmission,size=config['wheel.fl.tire'].size;
  const wheels=Object.fromEntries(['fl','fr','rl','rr'].map(key=>[key,tireDimensions(config['wheel.'+key+'.tire'].size)]));
  const driven=config['differential-rear']&&!config['differential-center']?wheels.rl:wheels.fl;
  const radius=driven.radius;
  const gears=Array.from({length:t.gears},(_,i)=>t['gear-ratio-'+(i+1)]);
  const tank=config['fuel-tank'];
  const mass=Object.values(config).reduce((s,v)=>s+(v.mass||0),0)+(tank.volume||0)*(tank['fuel-density']||.75);
  const brakeAxles={front:0,rear:0};
  for(const key of ['fl','fr','rl','rr']){const b=config['wheel.'+key+'.brake'];if(b)brakeAxles[key[0]==='f'?'front':'rear']+=b.friction*b['max-pressure']*b.area*b.radius*b.bias/wheels[key].radius;}
  const brakeForce=brakeAxles.front+brakeAxles.rear;
  const massPoints=Object.values(config).filter(v=>v.mass&&Array.isArray(v.position)).map(v=>({mass:v.mass,position:v.position}));
  massPoints.push({mass:(tank.volume||0)*(tank['fuel-density']||.75),position:tank.position||[0,0,0]});
  const weightedMass=massPoints.reduce((sum,p)=>sum+p.mass,0),cg=[0,1,2].map(axis=>massPoints.reduce((sum,p)=>sum+p.mass*p.position[axis],0)/weightedMass);
  const lift=-Math.min(...['fl','fr','rl','rr'].map(key=>config['wheel.'+key].position[2]-wheels[key].radius))+.018;
  const frontAxle=config['wheel.fl'].position[1]-cg[1],rearAxle=cg[1]-config['wheel.rl'].position[1];
  const cgHeight=Math.max(.2,Math.min(.85,cg[2]+lift));
  const yawInertia=config.chassis?.['yaw-inertia']||massPoints.reduce((sum,p)=>sum+p.mass*((p.position[0]-cg[0])**2+(p.position[1]-cg[1])**2),0);
  const torque=Object.entries(e).filter(([k])=>k.startsWith('torque-curve')).map(([,v])=>v).sort((a,b)=>a[0]-b[0]);
  return {steeringRate:config.chassis?.['steering-rate']||1,tireGrip:config.chassis?.['tire-grip']||1.08,downforce:config.chassis?.downforce||0,brakeForce,brakeAxles,frontAxle,rearAxle,cgHeight,yawInertia,engineLocation:config.engine.position?.[1]<0?'rear':'front',wheels,mass,torque,gears,reverse:Math.abs(t['gear-ratio-r']),finalDrive:(config['differential-center']||config['differential-front']||config['differential-rear'])['final-drive'],radius,width:size[0]/1000,rim:size[2]*.0254,power:e['max-power']/1000,redline:e['rpm-limit'],idle:e['start-rpm']||900,displacement:e.displacement*1000,peakTorque:Math.max(...torque.map(x=>x[1])),wheelbase:config['wheel.fl'].position[1]-config['wheel.rl'].position[1],maxSteer:config['wheel.fl'].steering*Math.PI/180,drag:Object.entries(config).filter(([k])=>k.startsWith('wing')).reduce((a,[,v])=>a+(v['frontal-area']||0)*(v['drag-coefficient']||0),0)||.65,drive:config['differential-center']?'AWD':config['differential-front']?'FWD':'RWD'};
}

// Year refers to the represented model, never the asset upload date.
export const MODERN_YEAR_MIN=2021;
export function carsInCollection(filter='modern'){
 const ordered=[...CARS].sort((a,b)=>(b.year||0)-(a.year||0));
 return ordered.filter(car=>filter==='all'||(filter==='modern'?car.year>=MODERN_YEAR_MIN:filter==='classic'?!(car.year>=MODERN_YEAR_MIN):car.category===filter));
}
