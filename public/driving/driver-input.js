const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=t=>t*t*(3-2*t);
// Digital keys get a small immediate bite, then reach the unchanged full lock.
// Durations use simulation time, so keyboard repeat and display FPS don't matter.
export function shapeDigitalInput(s,input,p,dt){
 const raw=clamp(input.steer||0,-1,1),sign=Math.sign(raw),old=s.keyDirection||0;
 s.keyHeld=sign===0?0:sign===old?(s.keyHeld||0)+dt:dt;s.keyDirection=sign;
 const speed=Math.abs(s.speed),formula=(p.steeringRate||1)>1;
 const attack=(formula?.26:.29)+clamp(speed/80,0,1)*.08;
 const bite=formula?.17:.23;
 const amount=bite+(1-bite)*smooth(clamp(s.keyHeld/attack,0,1));
 const precision=input.precision?.34:1;
 return {...input,steer:raw*amount*precision};
}
