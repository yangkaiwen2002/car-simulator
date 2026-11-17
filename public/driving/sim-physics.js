// Simulation handling: a four-wheel model in the spirit of dedicated racing sims.
// Each wheel has its own load, spin speed, slip ratio, slip angle and temperature;
// tire force follows a peaked curve that falls away when sliding; the engine drives
// the wheels through a clutch, gearbox and limited-slip differential; brakes can lock.
// Constants are game calibrations chosen to give plausible behaviour, not measured data.
import {shapeDigitalInput} from './driver-input.js';
import {createBody} from './collision.js';
import {applyImpact,performance} from './damage.js';
import {torqueAt} from './physics.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const G=9.81,AIR=1.225,SUBSTEPS=3,WHEEL_INERTIA=1.4,ENGINE_INERTIA=.16,DRIVELINE=.9;
export const TIRE={
 // Normalised force curve: peaks at combined slip 1, keeps ~76% when fully sliding.
 shape:1.45,stiffness:1.88,
 road:{slipAngle:.14,slipRatio:.11,optimum:85,window:55},
 slick:{slipAngle:.105,slipRatio:.085,optimum:95,window:50},
 loadSensitivity:.14,ambient:28,start:62,
};
export function tireCurve(slip){return Math.sin(TIRE.shape*Math.atan(TIRE.stiffness*slip));}
// Grip multiplier from tread temperature: best in a window, fading when cold or overheated.
export function temperatureGrip(temp,compound){const offset=(temp-compound.optimum)/compound.window;return clamp(1-(offset<0?.16:.22)*offset*offset,.72,1);}
function createSim(p,s){
 // Entering mid-motion (mode switch, test set-up): wheels roll with the road and a sensible gear is engaged.
 const rolling=(s.speed||0)/p.radius;
 if(s.direction===1&&s.speed>3){let gear=1;while(gear<p.gears.length&&s.speed/p.radius*p.gears[gear-1]*p.finalDrive*60/(2*Math.PI)>p.redline*.8)gear++;s.gear=gear;}
 return {omega:[rolling,rolling,rolling,rolling],temp:[TIRE.start,TIRE.start,TIRE.start,TIRE.start],load:[0,0,0,0],slipRatio:[0,0,0,0],slipAngle:[0,0,0,0],usage:[0,0,0,0],lateralG:0,limiter:false,clutch:0,mass:p.mass};
}
// Wheel order: front-left, front-right, rear-left, rear-right. x is metres to the right, y forward.
function layout(p){
 const a=p.frontAxle||p.wheelbase*.5,b=p.rearAxle||p.wheelbase*.5,tf=(p.trackFront||1.55)/2,tr=(p.trackRear||1.55)/2;
 return [{x:-tf,y:a,front:true},{x:tf,y:a,front:true},{x:-tr,y:-b,front:false},{x:tr,y:-b,front:false}];
}
export function stepSim(s,input,p,dt,world=null){
 dt=clamp(dt,0,1/30);if(!dt)return s;
 if(dt>1/120+1e-9){const n=Math.ceil(dt*120);for(let i=0;i<n;i++)stepSim(s,input,p,dt/n,world);return s;}
 if(input.digital)input=shapeDigitalInput(s,input,p,dt);
 const sim=s.sim&&s.sim.mass===p.mass?s.sim:(s.sim=createSim(p,s)),wheels=layout(p),condition=performance(s.damage);
 s.elapsed+=dt;s.shift=Math.max(0,s.shift-dt);s.collision=false;s.impact=null;s.impactPulse=Math.max(0,(s.impactPulse||0)*Math.exp(-dt*8)-dt*.02);
 const speed=Math.abs(s.speed),brake=clamp(input.brake||0,0,1),handbrake=!!input.handbrake;
 s.brakePressure=brake+((s.brakePressure||0)-brake)*Math.exp(-dt/(brake>(s.brakePressure||0)?.04:.025));if(s.brakePressure<.001)s.brakePressure=0;
 const pedal=clamp(input.throttle||0,0,1);s.pedalThrottle=pedal+((s.pedalThrottle||0)-pedal)*Math.exp(-dt/.04);if(s.pedalThrottle<.001)s.pedalThrottle=0;
 // Steering is direct. Lock narrows with speed only so keys and sticks stay usable.
 const intent=clamp(input.steer||0,-1,1),lock=p.maxSteer*Math.max(.07,1/(1+(speed/(p.steeringRate>1?30:21))**1.55));
 const steerTarget=intent*lock*condition.steerResponse+condition.steerBias,steerRate=(Math.abs(steerTarget)<Math.abs(s.steer)?2.6:2.1)*(p.steeringRate||1);
 s.steer+=clamp(steerTarget-s.steer,-steerRate*dt,steerRate*dt);s.steerIntent=intent;
 // Gearbox and clutch.
 const forward=s.direction>=0,ratio=s.direction===0?0:(forward?p.gears[s.gear-1]:-p.reverse)*p.finalDrive;
 const driven=wheels.map(w=>p.drive==='AWD'||(p.drive==='FWD')===w.front),drivenCount=driven.filter(Boolean).length;
 const drivenOmega=sim.omega.reduce((sum,w,i)=>sum+(driven[i]?w:0),0)/drivenCount;
 let wheelRpm=Math.abs(drivenOmega*ratio)*60/(2*Math.PI);
 if(s.direction===1&&!s.shift&&!input.manual){
  const roadRpm=speed/p.radius*Math.abs(ratio)*60/(2*Math.PI);
  if(wheelRpm>p.redline*.93&&s.gear<p.gears.length&&s.pedalThrottle>.2){s.gear++;s.shift=s.shiftDuration=.12;}
  else if(s.gear>1&&roadRpm*p.gears[s.gear-2]/p.gears[s.gear-1]<p.redline*.62&&(s.pedalThrottle<.6||roadRpm<p.redline*.4)){s.gear--;s.shift=s.shiftDuration=.1;}
 }
 const shifting=s.shift>0,engage=p.idle*1.25,locked=!shifting&&ratio!==0&&wheelRpm>=engage;
 const launch=p.idle+s.pedalThrottle*(Math.min(p.redline*.6,p.idle+3600)-p.idle);
 const targetRpm=locked?wheelRpm:shifting&&ratio?Math.max(p.idle,wheelRpm):Math.max(launch,Math.min(wheelRpm,engage));
 s.rpm+=(clamp(targetRpm,p.idle,p.redline+250)-s.rpm)*(1-Math.exp(-dt*(locked?60:9)));
 if(s.rpm>=p.redline)sim.limiter=true;else if(s.rpm<p.redline-180)sim.limiter=false;
 // Traction control (cars that have it) trims torque while the driven tires spin.
 const spin=Math.max(0,...sim.slipRatio.map((k,i)=>driven[i]?k*Math.sign(ratio||1):0));
 s.tractionCut=input.tc&&speed>2?clamp((spin-.13)*7,0,.85):0;
 const throttle=s.pedalThrottle*(1-s.tractionCut);s.throttle=throttle;s.brake=s.brakePressure;
 const peak=p.peakTorque||400,engineBrake=(.07+.07*s.rpm/p.redline)*peak*(1-throttle);
 const engineTorque=ratio===0||shifting?0:(sim.limiter?0:throttle*condition.power*torqueAt(p.torque,s.rpm))-(locked?engineBrake:0);
 const axleTorque=engineTorque*ratio*DRIVELINE;// summed over the driven wheels
 const share=i=>!driven[i]?0:p.drive==='AWD'?(wheels[i].front?.2:.3):.5;
 const coupledInertia=locked?ENGINE_INERTIA*ratio*ratio/drivenCount:0;
 // Loads: static + longitudinal and lateral transfer + downforce.
 const L=p.wheelbase,a=p.frontAxle||L*.5,b=p.rearAxle||L*.5,h=p.cgHeight||.45,weight=p.mass*G,aero=(p.downforce||0)*s.speed*s.speed;
 const staticFront=weight*b/L/2,staticRear=weight*a/L/2,longitudinal=-p.mass*clamp(s.loadAcceleration||0,-45,45)*h/L/2;
 const rollFront=p.drive==='FWD'?.6:p.engineLocation==='rear'?.5:.55,lateralTotal=p.mass*clamp(sim.lateralG,-45,45)*h;
 const sideFront=lateralTotal*rollFront/(p.trackFront||1.55),sideRear=lateralTotal*(1-rollFront)/(p.trackRear||1.55);
 wheels.forEach((w,i)=>{const base=w.front?staticFront+longitudinal+aero*.21:staticRear-longitudinal+aero*.29;sim.load[i]=Math.max(0,base+(w.front?sideFront:sideRear)*(w.x<0?1:-1));});
 const compound=(p.tireGrip||1.08)>1.4?TIRE.slick:TIRE.road,surface=input.offRoad?.55:1,mu0=(p.tireGrip||1.08)*condition.grip*surface;
 const brakeFront=(p.brakeAxles?.front||p.brakeForce*.65||p.mass*15)/2*condition.braking,brakeRear=(p.brakeAxles?.rear||p.brakeForce*.35||p.mass*10)/2*condition.braking;
 const sinS=Math.sin(s.steer),cosS=Math.cos(s.steer),side=s.sideSpeed||0;
 let sumForward=0,sumRight=0,sumMoment=0,frontUse=0,rearUse=0;
 const h2=dt/SUBSTEPS,heat=[0,0,0,0];
 for(let sub=0;sub<SUBSTEPS;sub++){
  const diff=[0,0,0,0];
  // Limited-slip: friction between each driven pair resists a speed difference.
  for(const [l,r] of [[0,1],[2,3]])if(driven[l]){const lockTorque=clamp((sim.omega[l]-sim.omega[r])*260,-1,1)*(60+(p.drive==='FWD'?.18:(p.tireGrip||1)>1.4?.5:.34)*Math.abs(axleTorque)*(share(l)+share(r)));diff[l]=-lockTorque;diff[r]=lockTorque;}
  for(let i=0;i<4;i++){
   const w=wheels[i],radius=(w.front?p.wheels?.fl:p.wheels?.rl)?.radius||p.radius;
   const vf=s.speed+s.yawRate*w.x,vr=side-s.yawRate*w.y,c=w.front?cosS:1,sn=w.front?sinS:0;
   const u=vf*c-vr*sn,v=vf*sn+vr*c,reference=Math.max(Math.abs(u),2.5);
   const sideStatic=w.front?staticFront:staticRear,load=sim.load[i];
   const mu=mu0*clamp(1-TIRE.loadSensitivity*(load/Math.max(sideStatic,1)-1),.7,1.12)*temperatureGrip(sim.temp[i],compound);
   const tanAlpha=v/reference,sy=tanAlpha/Math.tan(compound.slipAngle);
   const force=omega=>{const kappa=(omega*radius-u)/reference,sx=kappa/compound.slipRatio,combined=Math.hypot(sx,sy),grip=combined>1e-6?mu*load*tireCurve(combined)/combined:0;return {kappa,combined,fx:grip*sx,fy:-grip*sy};};
   const now=force(sim.omega[i]);
   // Wheel spin, solved implicitly so it stays stable at low speed.
   const slope=mu*load*TIRE.shape*TIRE.stiffness/compound.slipRatio*radius/reference,inertia=WHEEL_INERTIA+(driven[i]?coupledInertia:0);
   const torque=axleTorque*share(i)+diff[i]-now.fx*radius;
   let omega=sim.omega[i]+h2*torque/(inertia+h2*slope*radius);
   let brakeTorque=(w.front?brakeFront:brakeRear)*s.brakePressure*radius;if(!w.front&&handbrake)brakeTorque=Math.max(brakeTorque,load*mu*radius*1.7+400);
   if(input.abs&&!handbrake&&Math.abs(u)>3&&now.kappa*Math.sign(u)<-compound.slipRatio*1.25)brakeTorque*=.25;
   const brakeStep=h2*brakeTorque/(inertia+h2*slope*radius);
   omega=Math.abs(omega)<=brakeStep?0:omega-Math.sign(omega)*brakeStep;
   sim.omega[i]=omega;const tire=force(omega);
   sim.slipRatio[i]=tire.kappa;sim.slipAngle[i]=Math.atan(tanAlpha);sim.usage[i]=tire.combined;
   const fForward=tire.fx*c+tire.fy*sn,fRight=-tire.fx*sn+tire.fy*c;
   sumForward+=fForward;sumRight+=fRight;sumMoment+=w.x*fForward-w.y*fRight;
   if(w.front)frontUse=Math.max(frontUse,tire.combined);else rearUse=Math.max(rearUse,tire.combined);
   // Sliding power heats the tread; rolling flex adds a little.
   heat[i]+=Math.hypot(tire.fx,tire.fy)*Math.hypot(omega*radius-u,v)*.2+load*Math.abs(u)*.012;
  }
 }
 sumForward/=SUBSTEPS;sumRight/=SUBSTEPS;sumMoment/=SUBSTEPS;
 for(let i=0;i<4;i++)sim.temp[i]=clamp(sim.temp[i]+dt*(heat[i]/SUBSTEPS/5200-(sim.temp[i]-TIRE.ambient)*(.02+speed*.0011)),TIRE.ambient,190);
 // Chassis: drag, rolling resistance, gradient.
 const resistance=.5*AIR*p.drag*speed*speed+weight*(input.offRoad?.1:.012);
 const grade=clamp(input.grade||0,-.4,.4);
 const net=sumForward-Math.sign(s.speed)*Math.min(resistance,p.mass*speed/dt)-weight*grade/Math.sqrt(1+grade*grade);
 const sin=Math.sin(s.yaw),cos=Math.cos(s.yaw),shape=p.collider||{hx:.9,hz:p.wheelbase/2+.7,cx:0,cz:0};
 let vx=cos*side-sin*s.speed,vz=-sin*side-cos*s.speed;
 vx+=(cos*sumRight-sin*net)/p.mass*dt;vz+=(-sin*sumRight-cos*net)/p.mass*dt;
 const inertia=p.yawInertia||p.mass*(4*shape.hx**2+4*shape.hz**2)/12;
 s.yawRate+=sumMoment/inertia*dt;
 s.acceleration=net/p.mass;s.lateral=sumRight/p.mass;
 s.loadAcceleration+=(s.acceleration-s.loadAcceleration)*(1-Math.exp(-dt*11));sim.lateralG+=(s.lateral-sim.lateralG)*(1-Math.exp(-dt*9));
 s.visualAcceleration+=(s.acceleration-s.visualAcceleration)*(1-Math.exp(-dt*7));s.visualLateral+=(s.lateral-s.visualLateral)*(1-Math.exp(-dt*7));
 s.frontGrip=Math.min(1,frontUse);s.rearGrip=Math.min(1,rearUse);s.frontSlip=(sim.slipAngle[0]+sim.slipAngle[1])/2;s.rearSlip=(sim.slipAngle[2]+sim.slipAngle[3])/2;
 s.frontLoad=sim.load[0]+sim.load[1];s.rearLoad=sim.load[2]+sim.load[3];
 s.wheelspin+=(clamp(spin*4,0,3)-s.wheelspin)*(1-Math.exp(-dt*10));
 s.lockup=speed>3&&sim.omega.some((w,i)=>Math.abs(w)<.5&&sim.load[i]>50);s.stabilityActive=false;s.drift=0;s.driftHold=0;
 s.absActive=!!input.abs&&s.brakePressure>.3&&speed>3&&sim.slipRatio.some(k=>k*Math.sign(s.speed||1)<-compound.slipRatio*1.2);
 s.brakeDeceleration=s.brakePressure>.01?Math.max(0,-Math.sign(s.speed)*s.acceleration):0;
 s.brakeHold=(brake>.05||handbrake)&&Math.hypot(vx,vz)<.2;
 if(s.brakeHold){vx=vz=0;s.yawRate=0;s.acceleration=0;s.loadAcceleration=0;sim.lateralG=0;}
 else if(!throttle&&Math.hypot(vx,vz)<.02&&Math.abs(grade)<.01){vx=vz=0;s.yawRate=0;}
 const offset={x:cos*(shape.cx||0)+sin*(shape.cz||0),z:-sin*(shape.cx||0)+cos*(shape.cz||0)};
 const body=createBody({x:s.x+offset.x,z:s.z+offset.z,yaw:s.yaw,vx,vz,yawRate:s.yawRate,mass:p.mass,hx:shape.hx,hz:shape.hz,kind:'驾驶车辆',restitution:.12,friction:.48});body.invInertia=1/inertia;
 const oldX=s.x,oldZ=s.z;
 if(world?.advance){s.impact=world.advance(body,dt);s.collision=!!s.impact;}else{body.x+=body.vx*dt;body.z+=body.vz*dt;body.yaw+=body.yawRate*dt;}
 const sn=Math.sin(body.yaw),cs=Math.cos(body.yaw);
 s.x=body.x-cs*(shape.cx||0)-sn*(shape.cz||0);s.z=body.z+sn*(shape.cx||0)-cs*(shape.cz||0);s.yaw=body.yaw;s.yawRate=body.yawRate;
 s.speed=(-sn*body.vx-cs*body.vz)||0;s.sideSpeed=(cs*body.vx-sn*body.vz)||0;s.distance+=Math.hypot(s.x-oldX,s.z-oldZ);
 if(s.impact){applyImpact(s,p,s.impact);s.impactPulse=Math.min(1,s.impact.speed/14);s.impactSide=s.impact.normal.x*cs-s.impact.normal.z*sn;}
 return s;
}
