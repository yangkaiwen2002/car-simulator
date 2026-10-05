// Dynamic planar vehicle: axle tire forces drive translation and yaw inertia.
// Contact impulses are solved by collision.js; drivetrain data comes from .car.
import {createBody} from './collision.js';
import {createDamage,applyImpact,performance} from './damage.js';
import {tireForces} from './tires.js';
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function torqueAt(curve,rpm){
 if(rpm<=curve[0][0])return curve[0][1];
 for(let i=1;i<curve.length;i++){const a=curve[i-1],b=curve[i];if(rpm<=b[0])return a[1]+(b[1]-a[1])*(rpm-a[0])/(b[0]-a[0]);}
 return curve.at(-1)[1];
}
export function createState(){return {x:4.5,z:142,yaw:0,speed:0,rpm:900,gear:1,direction:1,steer:0,steerIntent:0,yawRate:0,acceleration:0,loadAcceleration:0,lateral:0,distance:0,shift:0,shiftDuration:0,visualAcceleration:0,visualLateral:0,elapsed:0,collision:false,sideSpeed:0,impact:null,impactPulse:0,impactSide:0,brakePressure:0,brakeHold:false,brakeDeceleration:0,throttle:0,brake:0,frontGrip:0,rearGrip:0,frontSlip:0,rearSlip:0,wheelspin:0,pedalThrottle:0,tractionCut:0,stabilityActive:false,damage:createDamage()};}
export function setDirection(s,d){if(Math.hypot(s.speed,s.sideSpeed||0)>.5)return false;s.direction=d;s.gear=1;s.speed=0;s.sideSpeed=0;return true;}
export function step(s,input,p,dt,world=null){
 dt=clamp(dt,0,1/30);if(!dt)return s;
 // Integrate stiff tire forces at 120 Hz even when a caller supplies larger steps.
 if(dt>1/120+1e-9){const n=Math.ceil(dt*120);for(let i=0;i<n;i++)step(s,input,p,dt/n,world);return s;}
 s.elapsed+=dt;s.shift=Math.max(0,s.shift-dt);s.collision=false;s.impact=null;s.impactPulse=Math.max(0,(s.impactPulse||0)*Math.exp(-dt*8)-dt*.02);
 const speed=Math.abs(s.speed),brake=clamp(input.brake||0,0,1),handbrake=!!input.handbrake;
 const response=brake>(s.brakePressure||0)?.045:.025;
 s.brakePressure=brake+((s.brakePressure||0)-brake)*Math.exp(-dt/response);if(s.brakePressure<.001)s.brakePressure=0;
 // Braking wins over the throttle immediately, not after pressure builds up.
 const assisted=input.assists!==false;
 const requestedThrottle=brake>.01||s.brakePressure>.04||handbrake?0:clamp(input.throttle||0,0,1);
 s.pedalThrottle=requestedThrottle===0?0:requestedThrottle+((s.pedalThrottle||0)-requestedThrottle)*Math.exp(-dt/(assisted?.13:.035));
 const slip=Math.atan2(s.sideSpeed||0,Math.max(speed,4));
 s.stabilityActive=assisted&&!handbrake&&speed>5&&Math.abs(slip)>.10;
 const throttle=s.pedalThrottle*(s.stabilityActive?clamp(1-(Math.abs(slip)-.10)*3.2,.2,1):1);
 s.throttle=throttle;s.brake=s.brakePressure;
 const condition=performance(s.damage),speedFactor=1/(1+(speed/22)**1.5),intent=clamp(input.steer||0,-1,1);
 // Road mode smooths the player's input separately from the rack. A yaw-rate
 // damping term prevents slip correction from making the car fishtail on release.
 const returning=Math.abs(intent)<Math.abs(s.steerIntent||0),reversing=intent*(s.steerIntent||0)<0;
 s.steerIntent=intent+((s.steerIntent||0)-intent)*Math.exp(-dt/(returning||reversing?.075:.12));
 const staticFront=p.mass*9.81*(p.rearAxle||p.wheelbase*.5)/p.wheelbase,staticRear=p.mass*9.81-staticFront;
 const axleBalance=clamp(Math.min((s.frontLoad||staticFront)/staticFront,(s.rearLoad||staticRear)/staticRear),.5,1);
 const gripAccel=(p.tireGrip||1.08)*condition.grip*(input.offRoad?.5:1)*(9.81+(p.downforce||0)*speed*speed/p.mass)*.85*axleBalance;
 const steerLimit=assisted?Math.min(p.maxSteer,Math.atan(p.wheelbase*gripAccel/(speed*speed+20))+.012):p.maxSteer*speedFactor;
 const driverSteer=(assisted?s.steerIntent:intent)*steerLimit;
 const targetYaw=clamp(s.speed/p.wheelbase*Math.tan(driverSteer),-gripAccel/Math.max(speed,4),gripAccel/Math.max(speed,4));
 const recovery=clamp((Math.abs(slip)-.06)/.12,0,1),correctionLimit=Math.max(.08,steerLimit*.65,Math.min(.45,Math.abs(slip)*1.5));
 const travelSign=s.speed<0?-1:1;
 const countersteer=assisted&&!handbrake?clamp((speed-3)/4,0,1)*clamp(travelSign*(-slip*(.1+recovery*.8)+(targetYaw-s.yawRate)*.3),-correctionLimit,correctionLimit):0;
 const steerTarget=clamp(driverSteer+countersteer,-p.maxSteer,p.maxSteer)*condition.steerResponse+condition.steerBias;
 const rate=(assisted?(returning||reversing?3.8:2.8):(Math.abs(steerTarget)<Math.abs(s.steer)?1.9:1.15))/(1+speed/28);
 s.steer+=clamp((steerTarget-s.steer)*(1-Math.exp(-dt*(assisted?18:9))),-rate*dt,rate*dt);
 let ratio=(s.direction<0?p.reverse:p.gears[s.gear-1])*p.finalDrive;
 let rpm=speed/p.radius*ratio*60/(2*Math.PI);
 if(s.direction===1&&!s.shift){if(rpm>p.redline*.87&&s.gear<p.gears.length){s.gear++;s.shift=s.shiftDuration=.22;}else if(s.gear>1&&rpm<p.redline*.32){s.gear--;s.shift=s.shiftDuration=.15;}ratio=p.gears[s.gear-1]*p.finalDrive;rpm=speed/p.radius*ratio*60/(2*Math.PI);}
 const wheelspinRpm=(s.wheelspin||0)*throttle*1600;
 const targetRpm=s.direction===0?p.idle+throttle*(p.redline-p.idle):Math.max(p.idle+throttle*1000,rpm+wheelspinRpm);
 s.rpm+=(clamp(targetRpm,p.idle,p.redline+100)-s.rpm)*(1-Math.exp(-dt*12));
 let drive=s.direction*throttle*condition.power*torqueAt(p.torque,s.rpm)*ratio*.87/p.radius;
 if(s.shift>0)drive*=assisted?.2+.8*Math.cos(Math.PI*(1-s.shift/s.shiftDuration))**2:0;
 if(rpm>p.redline||s.direction===0)drive=0;
 const forces=tireForces(s,{grip:condition.grip,braking:condition.braking,handbrake,offRoad:input.offRoad,assisted},p,drive,dt);
 const resistance=.5*1.225*p.drag*speed*speed+p.mass*9.81*(input.offRoad?.12:.014)+(!throttle&&s.direction!==0?Math.min(500,speed*38):0);
 const resistanceForce=Math.sign(s.speed)*Math.min(resistance,p.mass*speed/dt);
 const grade=clamp(input.grade||0,-.4,.4);
 const longitudinal=forces.forward-resistanceForce-p.mass*9.81*grade/Math.sqrt(1+grade*grade);
 const sin=Math.sin(s.yaw),cos=Math.cos(s.yaw),shape=p.collider||{hx:.9,hz:p.wheelbase/2+.7,cx:0,cz:0};
 let vx=cos*(s.sideSpeed||0)-sin*s.speed,vz=-sin*(s.sideSpeed||0)-cos*s.speed;
 vx+=(cos*forces.right-sin*longitudinal)/p.mass*dt;vz+=(-sin*forces.right-cos*longitudinal)/p.mass*dt;
 const inertia=p.yawInertia||p.mass*(4*shape.hx**2+4*shape.hz**2)/12;
 s.yawRate+=forces.moment/inertia*dt;
 s.acceleration=longitudinal/p.mass;s.loadAcceleration+=(s.acceleration-s.loadAcceleration)*(1-Math.exp(-dt*14));s.lateral=forces.right/p.mass;
 s.visualAcceleration+=(s.acceleration-s.visualAcceleration)*(1-Math.exp(-dt*7));s.visualLateral+=(s.lateral-s.visualLateral)*(1-Math.exp(-dt*7));
 s.frontGrip=forces.front.usage;s.rearGrip=forces.rear.usage;s.frontSlip=forces.front.slipAngle;s.rearSlip=forces.rear.slipAngle;
 s.tractionCut=forces.tractionCut;s.frontLoad=forces.frontLoad;s.rearLoad=forces.rearLoad;
 s.wheelspin+=((p.drive==='FWD'?forces.front.spin:p.drive==='RWD'?forces.rear.spin:Math.max(forces.front.spin,forces.rear.spin))-s.wheelspin)*(1-Math.exp(-dt*10));
 s.brakeDeceleration=brake||s.brakePressure>.01?Math.max(0,-Math.sign(s.speed)*s.acceleration):0;
 s.brakeHold=(brake>.05||handbrake||(assisted&&requestedThrottle===0&&speed<.18))&&Math.hypot(vx,vz)<.16;
 // Static brake hold suppresses low-speed solver chatter without deleting a
 // meaningful collision velocity. Released controls never force an abrupt stop.
 if(s.brakeHold){vx=vz=0;s.yawRate=0;s.acceleration=0;s.loadAcceleration=0;}
 else if(!throttle&&Math.hypot(vx,vz)<.015){vx=vz=0;s.yawRate=0;}
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
