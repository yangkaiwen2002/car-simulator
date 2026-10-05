export const CARS = [
  {id:'TC6',brand:'TOYOTA',name:'Celica GT-Four',era:'第六代 · ST205',category:'sports',type:'拉力血统 / 双门跑车',color:'#cbd8df',accent:'#c3d9e7',description:'四轮驱动，涡轮扭矩。沿着海岸线，重新认识九十年代的驾驶乐趣。',drive:'AWD',viewOffset:[0,-.02,.12],cabin:'右舵 · 经典座舱',quality:'独立座舱与车身模型'},
  {id:'MI',brand:'MINI',name:'Classic Mini',era:'经典款 · 1.3',category:'daily',type:'城市经典 / 轻量掀背',color:'#b74d36',accent:'#e39b7d',description:'小车身，短轴距。穿过街角，感受轻巧直接的城市驾驶。',drive:'FWD',viewOffset:[0,-.085,.17],cabin:'左舵 · 经典横向仪表台',quality:'独立座舱与车身模型'},
  {id:'3S',brand:'MAZDA',name:'Mazda 3',era:'第一代 · 2.3',category:'daily',type:'日常驾驶 / 运动轿车',color:'#697b92',accent:'#a6bbd4',description:'熟悉的日常，也可以值得期待。用一辆自然吸气轿车探索整座城市。',drive:'FWD',viewOffset:[0,-.075,.22],cabin:'左舵 · 基础座舱',quality:'基础座舱模型'},
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
export function carSpecs(config){
  const e=config.engine,t=config.transmission,size=config['wheel.fl.tire'].size;
  const radius=size[2]*.0254/2+size[0]/1000*size[1]/100;
  const gears=Array.from({length:t.gears},(_,i)=>t['gear-ratio-'+(i+1)]);
  const tank=config['fuel-tank'];
  const mass=Object.values(config).reduce((s,v)=>s+(v.mass||0),0)+(tank.volume||0)*(tank['fuel-density']||.75);
  const torque=Object.entries(e).filter(([k])=>k.startsWith('torque-curve')).map(([,v])=>v).sort((a,b)=>a[0]-b[0]);
  return {mass,torque,gears,reverse:Math.abs(t['gear-ratio-r']),finalDrive:(config['differential-center']||config['differential-front']||config['differential-rear'])['final-drive'],radius,width:size[0]/1000,rim:size[2]*.0254,power:e['max-power']/1000,redline:e['rpm-limit'],idle:e['start-rpm']||900,displacement:e.displacement*1000,peakTorque:Math.max(...torque.map(x=>x[1])),wheelbase:config['wheel.fl'].position[1]-config['wheel.rl'].position[1],maxSteer:config['wheel.fl'].steering*Math.PI/180,drag:Object.entries(config).filter(([k])=>k.startsWith('wing')).reduce((a,[,v])=>a+(v['frontal-area']||0)*(v['drag-coefficient']||0),0)||.65,drive:config['differential-center']?'AWD':config['differential-front']?'FWD':'RWD'};
}
