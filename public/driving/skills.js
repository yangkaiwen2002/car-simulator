// Skill chain: driving flair earns points, linked skills raise a multiplier,
// and the chain is banked after a quiet moment or lost in a crash.
// Pure logic (no DOM) so it can be unit-tested.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const CHAIN_WINDOW=3.6,MAX_MULTIPLIER=6,SKILLS_PER_MULTIPLIER=2;
const TIERS={
 drift:[[0,'漂移'],[450,'精彩漂移'],[1500,'超级漂移'],[4000,'终极漂移']],
 ebrake:[[0,'手刹漂移'],[450,'精彩手刹漂移'],[1500,'超级手刹漂移'],[4000,'终极手刹漂移']],
 speed:[[0,'高速'],[500,'极速'],[1600,'超级极速'],[4000,'终极极速']],
 burnout:[[0,'烧胎'],[350,'精彩烧胎'],[1000,'超级烧胎']],
 wreckage:[[0,'破坏'],[250,'精彩破坏'],[700,'超级破坏']],
};
export function skillName(id,points){const tiers=TIERS[id];if(!tiers)return id;let name=tiers[0][1];for(const [min,label] of tiers)if(points>=min)name=label;return name;}
export function multiplierFor(count){return clamp(1+Math.floor(count/SKILLS_PER_MULTIPLIER),1,MAX_MULTIPLIER);}

export function createSkillTracker(onEvent=()=>{}){
 const chain={score:0,count:0,timer:0,recent:[]};
 // Continuous skills grow while their condition holds, then join the chain.
 const live={drift:null,speed:null,burnout:null,wreckage:null};
 let cooldown=0;
 function finish(key){const skill=live[key];live[key]=null;if(!skill||skill.points<skill.min)return;add(skillName(skill.id,skill.points),Math.round(skill.points));}
 function add(name,points){
  if(points<=0)return;chain.score+=points;chain.count++;chain.timer=CHAIN_WINDOW;chain.recent.unshift({name,points});chain.recent.length=Math.min(chain.recent.length,4);
  onEvent('skill',{name,points,multiplier:multiplierFor(chain.count)});
 }
 function grow(key,id,rate,dt,min,grace){
  const skill=live[key]||(live[key]={id,points:0,min,quiet:0,grace});
  if(id==='ebrake')skill.id='ebrake';skill.points+=rate*dt;skill.quiet=0;chain.timer=CHAIN_WINDOW;
 }
 function rest(key,dt){const skill=live[key];if(!skill)return;skill.quiet+=dt;if(skill.quiet>=skill.grace)finish(key);}
 function reset(){chain.score=0;chain.count=0;chain.timer=0;chain.recent=[];for(const key of Object.keys(live))live[key]=null;}
 function bank(){
  for(const key of Object.keys(live))finish(key);
  if(chain.score<=0){reset();return 0;}
  const multiplier=multiplierFor(chain.count),total=Math.round(chain.score*multiplier);
  onEvent('bank',{total,score:chain.score,multiplier,count:chain.count});reset();return total;
 }
 function crash(){
  const pending=chain.score+Object.values(live).reduce((sum,s)=>sum+(s?.points||0),0);
  if(pending>=50)onEvent('lost',{score:Math.round(pending*multiplierFor(chain.count))});
  reset();cooldown=1.2;
 }
 // t: {speed m/s (signed), slip rad, wheelspin 0..3, handbrake, impact m/s, fastSpeed m/s}
 function update(dt,t){
  if(!(dt>0))return;
  if(t.impact>3.2){crash();return;}
  if(cooldown>0){cooldown-=dt;return;}
  const speed=Math.abs(t.speed),slip=Math.abs(t.slip||0);
  if(t.speed>8&&slip>.2)grow('drift',t.handbrake||live.drift?.id==='ebrake'?'ebrake':'drift',speed*Math.min(slip,.9)*11,dt,60,.45);else rest('drift',dt);
  const fast=t.fastSpeed||50;
  if(speed>fast&&slip<.2)grow('speed','speed',70*(speed/fast)**2,dt,90,.3);else rest('speed',dt);
  if(speed<7&&(t.wheelspin||0)>.3&&!t.handbrake)grow('burnout','burnout',90,dt,70,.35);else rest('burnout',dt);
  rest('wreckage',dt);
  if(chain.score>0&&!Object.values(live).some(Boolean)){chain.timer-=dt;if(chain.timer<=0)bank();}
 }
 return {
  update,bank,crash,reset,
  // Instant skills reported by the game world.
  award(name,points){if(cooldown<=0)add(name,points);},
  smash(points=45){if(cooldown>0)return;const skill=live.wreckage||(live.wreckage={id:'wreckage',points:0,min:1,quiet:0,grace:.9});skill.points+=points;skill.quiet=0;chain.timer=CHAIN_WINDOW;},
  view(){
   const active=Object.values(live).filter(Boolean).sort((a,b)=>b.points-a.points)[0];
   const pending=Object.values(live).reduce((sum,s)=>sum+(s?.points||0),0);
   return {active:active?{name:skillName(active.id,active.points),points:Math.round(active.points)}:null,score:Math.round(chain.score+pending),count:chain.count,multiplier:multiplierFor(chain.count),time:active?1:clamp(chain.timer/CHAIN_WINDOW,0,1),recent:chain.recent,idle:chain.score<=0&&!active};
  },
 };
}
