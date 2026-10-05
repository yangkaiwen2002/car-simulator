export const CARS = [
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
  const torque=Object.entries(e).filter(([k])=>k.startsWith('torque-curve')).map(([,v])=>v).sort((a,b)=>a[0]-b[0]);
  return {engineLocation:config.engine.position?.[1]<0?'rear':'front',wheels,mass,torque,gears,reverse:Math.abs(t['gear-ratio-r']),finalDrive:(config['differential-center']||config['differential-front']||config['differential-rear'])['final-drive'],radius,width:size[0]/1000,rim:size[2]*.0254,power:e['max-power']/1000,redline:e['rpm-limit'],idle:e['start-rpm']||900,displacement:e.displacement*1000,peakTorque:Math.max(...torque.map(x=>x[1])),wheelbase:config['wheel.fl'].position[1]-config['wheel.rl'].position[1],maxSteer:config['wheel.fl'].steering*Math.PI/180,drag:Object.entries(config).filter(([k])=>k.startsWith('wing')).reduce((a,[,v])=>a+(v['frontal-area']||0)*(v['drag-coefficient']||0),0)||.65,drive:config['differential-center']?'AWD':config['differential-front']?'FWD':'RWD'};
}
