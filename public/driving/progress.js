// Driver career: experience, level, stunt stars and records, kept in localStorage.
export const XP_PER_LEVEL=5000;
export function levelFor(xp){
 // Level n -> n+1 costs n * XP_PER_LEVEL, so early levels arrive quickly.
 let level=1,rest=Math.max(0,Math.floor(xp||0));
 while(rest>=level*XP_PER_LEVEL){rest-=level*XP_PER_LEVEL;level++;}
 return {level,into:rest,needed:level*XP_PER_LEVEL,ratio:rest/(level*XP_PER_LEVEL)};
}
export function parseCareer(raw){
 let saved;try{saved=JSON.parse(raw);}catch{saved=null;}
 const number=v=>Number.isFinite(v)&&v>0?v:0,out={xp:0,skillTotal:0,bestChain:0,stars:{},records:{}};
 if(!saved||typeof saved!=='object')return out;
 out.xp=number(saved.xp);out.skillTotal=number(saved.skillTotal);out.bestChain=number(saved.bestChain);
 for(const [id,value] of Object.entries(saved.stars||{}))if(Number.isInteger(value)&&value>=0&&value<=3)out.stars[id]=value;
 for(const [id,value] of Object.entries(saved.records||{}))if(Number.isFinite(value)&&value>0)out.records[id]=value;
 return out;
}
export function createCareer(storage,key='myracing-career-v1'){
 let data;try{data=parseCareer(storage?.getItem(key));}catch{data=parseCareer(null);}
 const save=()=>{try{storage?.setItem(key,JSON.stringify(data));}catch{}};
 return {
  get data(){return data;},
  get level(){return levelFor(data.xp);},
  get starCount(){return Object.values(data.stars).reduce((a,b)=>a+b,0);},
  // Returns the number of levels gained.
  addXp(amount){const before=levelFor(data.xp).level;data.xp+=Math.max(0,Math.round(amount));save();return levelFor(data.xp).level-before;},
  bankChain(total){data.skillTotal+=total;const best=total>data.bestChain;if(best)data.bestChain=total;save();return best;},
  // Higher is better for every stunt. Returns {record,newStars}.
  recordStunt(id,value,stars){const previous=data.records[id]||0,had=data.stars[id]||0,record=value>previous;if(record)data.records[id]=value;if(stars>had)data.stars[id]=stars;save();return {record,newStars:Math.max(0,stars-had),previous};},
 };
}
