const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function createDamage(){return {front:0,rear:0,left:0,right:0,engine:0,steering:0,brakes:0,structure:0,revision:0,disabled:false,exploded:false};}
export function applyImpact(s,p,impact){
 if(!impact||impact.deltaV<.8)return;
 const d=s.damage||=createDamage();
 // Energy lost in the contact is apportioned by mass; low normal-speed scrapes
 // do little damage even if the car is moving quickly along a wall.
 const severity=clamp((impact.energy/p.mass-1)/145,0,.95);if(severity<.001)return;
 const sn=Math.sin(s.yaw),cs=Math.cos(s.yaw),front=impact.normal.x*sn+impact.normal.z*cs,side=impact.normal.x*cs-impact.normal.z*sn;
 const longitudinal=Math.abs(front)>=Math.abs(side),zone=longitudinal?(front>0?'front':'rear'):(side>0?'left':'right');
 d[zone]=clamp(d[zone]+severity,0,1);d.structure=clamp(d.structure+severity*.48,0,1);
 const engineEnd=p.engineLocation==='rear'?'rear':'front';
 d.engine=clamp(d.engine+severity*(zone===engineEnd?.85:.22),0,1);
 d.steering=clamp(d.steering+severity*(zone==='front'?.65:longitudinal?.1:.42),0,1);
 d.brakes=clamp(d.brakes+severity*(longitudinal?.28:.5),0,1);
 d.disabled=d.engine>.86||d.structure>.9||Math.max(d.front,d.rear)>.97;
 // Dramatic fire/explosion is a game effect, not a prediction of real accidents.
 if(impact.energy>p.mass*380&&impact.deltaV>25){d.exploded=true;d.disabled=true;d.engine=1;}
 d.revision++;return {zone,severity};
}
export function performance(d=createDamage()){return {power:d.disabled?0:Math.max(.15,1-d.engine*.7-d.structure*.15),braking:Math.max(.35,1-d.brakes*.55),grip:Math.max(.48,1-d.steering*.3-d.structure*.18),steerBias:(d.left-d.right)*.018,steerResponse:1-d.steering*.48};}
