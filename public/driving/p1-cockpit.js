import * as THREE from '../vendor/three.module.min.js';

// This source GLB batches the P1's original wheel, buttons and grips into its
// interior material. Select whole connected parts, never cut the dashboard.
export function splitP1Steering(geometry){
 const position=geometry.attributes.position,index=geometry.index;
 const parents=Array.from({length:position.count},(_,i)=>i),welded=new Map();
 const find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
 const join=(a,b)=>{parents[find(a)]=find(b);};
 for(let i=0;i<position.count;i++){
  const key=[position.getX(i),position.getY(i),position.getZ(i)].map(x=>Math.round(x*1e5)).join(',');
  if(welded.has(key))join(i,welded.get(key));else welded.set(key,i);
 }
 const indices=index?Array.from(index.array):Array.from({length:position.count},(_,i)=>i);
 for(let i=0;i<indices.length;i+=3){join(indices[i],indices[i+1]);join(indices[i],indices[i+2]);}
 const bounds=new Map(),point=new THREE.Vector3();
 for(let i=0;i<position.count;i++){const id=find(i);if(!bounds.has(id))bounds.set(id,new THREE.Box3());bounds.get(id).expandByPoint(point.fromBufferAttribute(position,i));}
 const wheelParts=new Set([...bounds].filter(([,b])=>b.min.x>.16&&b.max.x<.34&&b.min.y>.335&&b.max.y<.45&&b.min.z>.46&&b.max.z<.52).map(([id])=>id));
 const wheel=[],interior=[];
 for(let i=0;i<indices.length;i+=3)(wheelParts.has(find(indices[i]))?wheel:interior).push(...indices.slice(i,i+3));
 if(wheel.length<300)throw new Error('P1 原始方向盘模型未能分离');
 const subset=triangles=>{
  const selected=[...new Set(triangles)],remap=new Map(selected.map((id,i)=>[id,i])),out=new THREE.BufferGeometry();
  for(const [name,attr] of Object.entries(geometry.attributes)){
   const values=new attr.array.constructor(selected.length*attr.itemSize);
   selected.forEach((id,i)=>{for(let k=0;k<attr.itemSize;k++)values[i*attr.itemSize+k]=attr.array[id*attr.itemSize+k];});
   out.setAttribute(name,new THREE.BufferAttribute(values,attr.itemSize,attr.normalized));
  }
  out.setIndex(triangles.map(i=>remap.get(i)));out.computeBoundingBox();return out;
 };
 return {interior:subset(interior),steering:subset(wheel)};
}
