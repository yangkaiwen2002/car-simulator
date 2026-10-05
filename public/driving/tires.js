// Dynamic two-axle tire model. Forces are in the car frame: forward and right.
// Nonlinear lateral stiffness + load sensitivity + a combined-force ellipse.
// All constants below are game calibrations, not manufacturer tire measurements.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function axleForce({forward,right,steer=0,normalLoad,nominalLoad,drive=0,brake=0,mu=1.08,locked=false,mass,dt}){
 const c=Math.cos(steer),s=Math.sin(steer),u=forward*c-right*s,v=forward*s+right*c;
 const slipAngle=Math.atan2(v,Math.max(Math.abs(u),4));
 // A loaded tire does not gain force in direct proportion to added load.
 const sensitivity=clamp(1-.08*(normalLoad/Math.max(nominalLoad,1)-1),.8,1.1);
 const limit=Math.max(1,normalLoad*mu*sensitivity*(locked?.78:1));
 const lateral=-limit*Math.tanh(slipAngle*(locked?4:8));
 const brakeForce=Math.min(brake,limit,mass*Math.abs(u)/dt);
 const longitudinal=drive-Math.sign(u)*brakeForce;
 const demand=Math.hypot(longitudinal,lateral),scale=Math.min(1,limit/Math.max(demand,1));
 const fx=longitudinal*scale,fy=lateral*scale;
 return {limit,lateral,forward:fx*c+fy*s,right:-fx*s+fy*c,slipAngle,usage:Math.min(1,demand/limit),saturation:demand/limit,spin:Math.abs(drive)>0?clamp((Math.abs(drive)-Math.abs(fx))/limit,0,3):0};
}
export function tireForces(s,input,p,driveForce,dt){
 const mass=p.mass,L=p.wheelbase,a=p.frontAxle||L*.5,b=p.rearAxle||L*.5;
 const staticFront=mass*9.81*b/L,aero=(p.downforce||0)*s.speed*s.speed;
 const transfer=-mass*clamp(s.loadAcceleration||0,-13,13)*(p.cgHeight||.45)/L;
 const frontLoad=clamp(staticFront+transfer,mass*9.81*.12,mass*9.81*.88)+aero*.42,rearLoad=mass*9.81+aero-frontLoad;
 const mu=(p.tireGrip||1.08)*input.grip*(input.offRoad?.5:1);
 const frontShare=p.drive==='FWD'?1:p.drive==='RWD'?0:.5;
 const frontBrake=Math.min(p.brakeAxles?.front||p.brakeForce*.65||mass*15,frontLoad*mu)*s.brakePressure*input.braking;
 const rearBrake=Math.min(p.brakeAxles?.rear||p.brakeForce*.35||mass*10,rearLoad*mu)*s.brakePressure*input.braking;
 let tractionCut=0;
 function tire(args){
  if(input.assisted&&args.drive){
   const free=axleForce({...args,drive:0,brake:0});
   const available=Math.sqrt(Math.max(0,(free.limit*.97)**2-free.lateral**2));
   const controlled=clamp(args.drive,-available,available);
   tractionCut=Math.max(tractionCut,1-Math.abs(controlled/args.drive));
   args={...args,drive:controlled};
  }
  return axleForce(args);
 }
 const front=tire({forward:s.speed,right:(s.sideSpeed||0)-s.yawRate*a,steer:s.steer,normalLoad:frontLoad,nominalLoad:staticFront,drive:driveForce*frontShare,brake:frontBrake,mu,mass:mass*.5,dt});
 const rear=tire({forward:s.speed,right:(s.sideSpeed||0)+s.yawRate*b,normalLoad:rearLoad,nominalLoad:mass*9.81-staticFront,drive:driveForce*(1-frontShare),brake:input.handbrake?Math.max(rearBrake,rearLoad*mu*1.6):rearBrake,mu,locked:input.handbrake,mass:mass*.5,dt});
 const moment=-a*front.right+b*rear.right;
 return {front,rear,forward:front.forward+rear.forward,right:front.right+rear.right,moment,frontLoad,rearLoad,tractionCut};
}
