// Procedural driving sounds: tire squeal, wind rush and short interface cues.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function createSfx(context){
 const length=context.sampleRate*2,buffer=context.createBuffer(1,length,context.sampleRate),data=buffer.getChannelData(0);
 for(let i=0;i<length;i++)data[i]=Math.random()*2-1;
 function loop(type,frequency,q){const source=context.createBufferSource();source.buffer=buffer;source.loop=true;const filter=context.createBiquadFilter();filter.type=type;filter.frequency.value=frequency;filter.Q.value=q;const gain=context.createGain();gain.gain.value=0;source.connect(filter).connect(gain).connect(context.destination);source.start();return {filter,gain};}
 const squeal=loop('bandpass',1150,5),wind=loop('lowpass',520,.4);
 const NOTES={skill:[[660,.07]],bank:[[660,.08],[880,.08],[1320,.16]],star:[[784,.09],[988,.09],[1175,.09],[1568,.22]],lost:[[300,.12],[196,.22]],rewind:[[520,.06],[392,.06],[294,.12]],shift:[[180,.035]]};
 return {
  update({slip=0,speed=0,volume=.2,muted=false,offRoad=false}){
   const now=context.currentTime,level=muted?0:volume;
   squeal.gain.gain.setTargetAtTime(offRoad?0:level*clamp(slip,0,1)*.42,now,.06);squeal.filter.frequency.setTargetAtTime(950+clamp(speed/60,0,1)*500,now,.1);
   wind.gain.gain.setTargetAtTime(level*clamp((speed/75)**2,0,1)*.5+(offRoad?level*clamp(speed/30,0,1)*.3:0),now,.15);wind.filter.frequency.setTargetAtTime(350+speed*9,now,.2);
  },
  cue(name,volume=.2){
   const notes=NOTES[name];if(!notes||volume<=0)return;let time=context.currentTime;
   for(const [frequency,duration] of notes){const osc=context.createOscillator(),gain=context.createGain();osc.type=name==='shift'?'square':'triangle';osc.frequency.value=frequency;gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(volume*.5,time+.008);gain.gain.exponentialRampToValueAtTime(.0008,time+duration+.08);osc.connect(gain).connect(context.destination);osc.start(time);osc.stop(time+duration+.1);time+=duration;}
  },
 };
}
