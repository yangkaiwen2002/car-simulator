// Original, reduced-order simulation. Vehicle inputs come from FirstDrive/VDrift.
// This is a flat-road bicycle model, not the VDrift rigid-body/suspension solver.
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function torqueAt(curve,rpm){
  if(rpm<=curve[0][0])return curve[0][1];
  for(let i=1;i<curve.length;i++){const a=curve[i-1],b=curve[i];if(rpm<=b[0])return a[1]+(b[1]-a[1])*(rpm-a[0])/(b[0]-a[0]);}
  return curve.at(-1)[1];
}
export function createState(){return {x:4.5,z:142,yaw:0,speed:0,rpm:900,gear:1,direction:1,steer:0,yawRate:0,acceleration:0,lateral:0,distance:0,shift:0,elapsed:0,collision:false};}
export function setDirection(s,d){if(Math.abs(s.speed)>.5)return false;s.direction=d;s.gear=1;s.speed=0;return true;}
export function step(s,input,p,dt,blocked=()=>false){
  dt=clamp(dt,0,1/30);if(!dt)return s;
  s.elapsed+=dt;s.shift=Math.max(0,s.shift-dt);s.collision=false;
  const speed=Math.abs(s.speed), throttle=clamp(input.throttle||0,0,1),brake=clamp(input.brake||0,0,1);
  const grip=(input.handbrake?.5:.92)*9.81;
  const speedFactor=1/(1+(speed/16)**1.6);
  s.steer+=(clamp(input.steer||0,-1,1)*p.maxSteer*speedFactor-s.steer)*(1-Math.exp(-dt*6));
  let ratio=(s.direction<0?p.reverse:p.gears[s.gear-1])*p.finalDrive;
  let rpm=speed/p.radius*ratio*60/(2*Math.PI);
  if(s.direction===1&&!s.shift){
    if(rpm>p.redline*.87&&s.gear<p.gears.length){s.gear++;s.shift=.22;}
    else if(s.gear>1&&rpm<p.redline*.32){s.gear--;s.shift=.15;}
    ratio=p.gears[s.gear-1]*p.finalDrive;
    rpm=speed/p.radius*ratio*60/(2*Math.PI);
  }
  const targetRpm=s.direction===0?p.idle+throttle*(p.redline-p.idle):Math.max(p.idle+throttle*1000,rpm);
  s.rpm+=(clamp(targetRpm,p.idle,p.redline+100)-s.rpm)*(1-Math.exp(-dt*12));
  const driveFraction=p.drive==='AWD'?.92:.58;
  const torqueForce=torqueAt(p.torque,s.rpm)*ratio*.87/p.radius;
  let drive=s.direction*throttle*Math.min(torqueForce,p.mass*grip*driveFraction);
  if(s.shift>0||rpm>p.redline||s.direction===0)drive=0;
  const resistance=.5*1.225*p.drag*speed*speed+p.mass*9.81*.014;
  const engineBrake=!throttle&&s.direction!==0?Math.min(500,speed*38):0;
  const stopping=brake*p.mass*8.6+(input.handbrake?p.mass*4.8:0)+engineBrake+resistance;
  const oldSpeed=s.speed;
  const motionSign=Math.sign(s.speed)||Math.sign(drive);
  let newSpeed=s.speed+(drive-motionSign*stopping)/p.mass*dt;
  if(Math.sign(newSpeed)!==motionSign&&Math.abs(drive)<=stopping)newSpeed=0;
  s.speed=clamp(newSpeed,-14,95);s.acceleration=(s.speed-oldSpeed)/dt;
  const yawTarget=s.speed/p.wheelbase*Math.tan(s.steer);
  const maxYaw=grip/Math.max(speed,1);
  s.yawRate+=(clamp(yawTarget,-maxYaw,maxYaw)-s.yawRate)*(1-Math.exp(-dt*8));
  s.lateral=s.yawRate*s.speed;
  const nextYaw=s.yaw+s.yawRate*dt;
  const nx=s.x-Math.sin(nextYaw)*s.speed*dt,nz=s.z-Math.cos(nextYaw)*s.speed*dt;
  if(blocked(nx,nz,nextYaw)){s.speed=0;s.acceleration=0;s.yawRate=0;s.collision=true;}
  else{s.x=nx;s.z=nz;s.yaw=nextYaw;s.distance+=Math.abs(s.speed)*dt;}
  return s;
}
