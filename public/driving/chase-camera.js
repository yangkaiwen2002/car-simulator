// Exterior cameras: a sprung chase view that leans into slides, plus a bumper view.
import * as THREE from '../vendor/three.module.min.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const CAMERA_MODES=['chase','far','bumper','cockpit'];
export const CAMERA_LABELS={chase:'追尾视角',far:'远景追尾',bumper:'车头视角',cockpit:'座舱视角'};
export function wrapAngle(a){a%=Math.PI*2;return a>Math.PI?a-Math.PI*2:a<-Math.PI?a+Math.PI*2:a;}
// Where the chase camera wants to sit, as a heading: mostly behind the car,
// partly behind its direction of travel so a slide shows the car's flank.
export function chaseHeading(state,reversing=false){
 const speed=Math.hypot(state.speed,state.sideSpeed||0);
 if(reversing)return state.yaw+Math.PI;
 if(speed<3||state.speed<0)return state.yaw;
 const slip=Math.atan2(state.sideSpeed||0,Math.max(state.speed,1));
 return state.yaw-clamp(slip,-.7,.7)*.5*clamp((speed-3)/8,0,1);
}
export function createChaseCamera(){
 const position=new THREE.Vector3(),focus=new THREE.Vector3(),wanted=new THREE.Vector3();
 let heading=0,ready=false,reverseTime=0,height=0;
 return {
  reset(){ready=false;reverseTime=0;},
  update(camera,{state,specs,mode,dt,time,orbitX=0,orbitY=0,lookBack=false,fov=70,calm=false}){
   const ground=state.groundHeight||0,speed=Math.hypot(state.speed,state.sideSpeed||0),ratio=clamp(speed/85,0,1);
   const half=specs?.collider?.hz||2.3,pulse=state.impactPulse||0;
   if(mode==='bumper'){
    const yaw=state.yaw+orbitX+(lookBack?Math.PI:0),pitch=(state.roadPitch||0)+orbitY*.6-.02;
    const forward=lookBack?-half*.2:half+.12;
    position.set(state.x-Math.sin(state.yaw)*forward,ground+.62+Math.sin(state.roadPitch||0)*forward,state.z-Math.cos(state.yaw)*forward);
    camera.position.copy(position);camera.position.y+=Math.sin(time*47)*pulse*.03+(calm?0:Math.sin(time*31)*ratio*ratio*.006);
    focus.set(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)).add(camera.position);
    camera.fov=fov+ratio*12;camera.lookAt(focus);camera.rotateZ(clamp(-(state.visualLateral||0)*.0016,-.02,.02));ready=false;return;
   }
   reverseTime=state.speed<-1.5&&state.direction<0?reverseTime+dt:0;
   const target=chaseHeading(state,reverseTime>.7);
   if(!ready){heading=target;height=ground;}
   heading+=wrapAngle(target-heading)*(1-Math.exp(-dt*(3.2+ratio*3.5)));
   height+=(ground-height)*(1-Math.exp(-dt*9));
   const far=mode==='far',view=heading+orbitX+(lookBack?Math.PI:0);
   // Pull back with speed and under acceleration; squeeze in under braking.
   const distance=(far?half*1.5+5.6:half*1.25+3.3)+ratio*(far?2:1.3)+clamp((state.visualAcceleration||0)*.045,-.45,.4);
   const rise=(far?3:1.75)+half*.12+orbitY*-4+ratio*.15;
   const slope=Math.sin(state.roadPitch||0)*Math.cos(wrapAngle(view-state.yaw));
   wanted.set(state.x+Math.sin(view)*distance,height+Math.max(.5,rise-slope*distance),state.z+Math.cos(view)*distance);
   position.copy(wanted);ready=true;
   camera.position.copy(position);
   if(!calm){camera.position.x+=Math.sin(time*37)*pulse*.05+Math.sin(time*23.7)*ratio*ratio*.012;camera.position.y+=Math.sin(time*49)*pulse*.06+Math.sin(time*29.3)*ratio*ratio*.012;}
   const lead=far?1.2:1.8;
   focus.set(state.x-Math.sin(view)*lead,ground+(far?1:1.05)+half*.05+slope*lead,state.z-Math.cos(view)*lead);
   camera.fov=(far?fov-6:fov-4)+ratio*(calm?6:17);camera.lookAt(focus);
   camera.rotateZ(clamp(-(state.visualLateral||0)*.0011,-.022,.022)+Math.sin(time*28)*pulse*.01);
  },
 };
}
