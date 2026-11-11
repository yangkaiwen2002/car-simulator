// Rewind: a rolling buffer of vehicle snapshots that can be scrubbed backwards.
const lerp=(a,b,t)=>a+(b-a)*t;
function lerpAngle(a,b,t){let d=(b-a)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return a+d*t;}
export function snapshot(state){const copy={...state,damage:{...state.damage},impact:null,collision:false};return copy;}
export function createRewind(seconds=14,interval=.1){
 const frames=[],limit=Math.ceil(seconds/interval);let clock=0,cursor=0;
 return {
  get available(){return Math.max(0,(frames.length-1)*interval);},
  clear(){frames.length=0;clock=0;cursor=0;},
  record(state,dt){clock+=dt;if(frames.length&&clock<interval)return;clock=0;frames.push(snapshot(state));if(frames.length>limit)frames.shift();cursor=0;},
  // Move `dt` seconds back in time and write the interpolated pose into state.
  // Returns false once the buffer is exhausted.
  scrub(state,dt){
   if(frames.length<2)return false;
   cursor+=dt/interval;
   while(cursor>=1&&frames.length>2){frames.pop();cursor-=1;}
   if(frames.length<=2&&cursor>=1){cursor=1;}
   const newer=frames.at(-1),older=frames.at(-2),t=Math.min(1,cursor);
   Object.assign(state,snapshot(t<.5?newer:older));
   state.x=lerp(newer.x,older.x,t);state.z=lerp(newer.z,older.z,t);state.yaw=lerpAngle(newer.yaw,older.yaw,t);
   state.speed=lerp(newer.speed,older.speed,t);state.rpm=lerp(newer.rpm,older.rpm,t);state.steer=lerp(newer.steer,older.steer,t);
   if(Number.isFinite(newer.groundHeight)&&Number.isFinite(older.groundHeight))state.groundHeight=lerp(newer.groundHeight,older.groundHeight,t);
   return frames.length>2||cursor<1;
  },
  // Resume driving from the scrubbed position.
  commit(state){if(frames.length>1&&cursor>=.5)frames.pop();cursor=0;clock=0;state.impactPulse=0;state.collision=false;state.impact=null;},
 };
}
