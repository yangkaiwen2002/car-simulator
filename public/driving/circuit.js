import * as THREE from '../vendor/three.module.min.js';
import {createCollisionWorld} from './collision.js';
import {foliage} from './city.js';
import {buildRoute} from './circuit-data.js';
const BOX=new THREE.BoxGeometry(1,1,1);
export async function createCircuit(info){
 const response=await fetch(`./circuits/${info.id}.geojson`);if(!response.ok)throw new Error('赛道数据加载失败');const route=buildRoute(await response.json());
 const forest=info.id==='nordschleife';
 const scene=new THREE.Scene();scene.background=new THREE.Color('#b0cfdf');scene.fog=new THREE.FogExp2('#bdd2db',.0007);scene.add(new THREE.HemisphereLight('#e3f2ff','#727258',1.6));
 const sun=new THREE.DirectionalLight('#ffe5bc',3);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-85,right:85,top:85,bottom:-85,far:350});sun.shadow.normalBias=.025;scene.add(sun,sun.target);
 const world=createCollisionWorld(),batches=new Map(),dummy=new THREE.Object3D();
 const mat=(color,roughness=.85)=>new THREE.MeshStandardMaterial({color,roughness});
 const grass=mat(info.id==='monza'?'#71814c':'#7b9055'),road=mat('#44494c'),gravel=mat('#afa990'),red=mat('#b94837'),white=mat('#e1e0d7'),metal=mat('#adb4b5'),dark=mat('#36444c'),glass=mat('#5e8495',.3),seat=mat('#536a86');
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(7000,7000),grass);ground.rotation.x=-Math.PI/2;ground.position.set((route.bounds.minX+route.bounds.maxX)/2,Math.min(...route.points.map(p=>p.y))-.05,(route.bounds.minZ+route.bounds.maxZ)/2);ground.receiveShadow=true;scene.add(ground);
 function box(w,h,d,x,y,z,yaw,material){if(forest)y+=route.nearest(x,z).y;if(!batches.has(material))batches.set(material,[]);batches.get(material).push({w,h,d,x,y,z,yaw});}
 // Continuous ribbons share mitered vertices, so even tight chicanes have no road gaps.
 function ribbon(inner,outer,height,material){const positions=[],indices=[];for(let i=0;i<route.points.length;i++){const p=route.points[i],prev=route.segments[(i+route.points.length-1)%route.points.length],next=route.segments[i];let nx=prev.tz+next.tz,nz=-prev.tx-next.tx;const l=Math.hypot(nx,nz)||1;nx/=l;nz/=l;const factor=Math.min(2,1/Math.max(.5,nx*next.tz-nz*next.tx));positions.push(p.x+nx*inner*factor,p.y+height,p.z+nz*inner*factor,p.x+nx*outer*factor,p.y+height,p.z+nz*outer*factor);}
  for(let i=0;i<route.points.length;i++){const a=i*2,b=((i+1)%route.points.length)*2;indices.push(a,b,a+1,b,b+1,a+1);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,material);mesh.material.side=THREE.DoubleSide;mesh.receiveShadow=true;scene.add(mesh);}
 if(forest)ribbon(-130,130,-.06,grass);
 ribbon(forest?-7:-20,forest?7:20,-.01,gravel);ribbon(-info.halfWidth,info.halfWidth,.01,road);for(const side of [-1,1])ribbon(side*(info.halfWidth-.12),side*info.halfWidth,.018,white);
 for(const [i,s] of route.segments.entries()){
  const yaw=Math.atan2(s.tx,s.tz),mx=(s.a.x+s.b.x)/2,mz=(s.a.z+s.b.z)/2;
  for(const side of [-1,1]){
   const curb=info.halfWidth+.42;box(.75,.06,s.len+.05,mx+s.tz*curb*side,.03,mz-s.tx*curb*side,yaw,i%2?white:red);
   const distance=forest?9:26,x=mx+s.tz*distance*side,z=mz-s.tx*distance*side;
   if(route.nearest(x,z).distance>(forest?7.8:18)){box(.35,.85,s.len+.3,x,.425,z,yaw,metal);world.addStatic({x,z,hx:.175,hz:(s.len+.3)/2,yaw,kind:'赛道护栏',friction:.4});if(i%3===0)box(.08,2.6,.08,x,1.3,z,0,metal);}
  }
 }
 const start=route.at(0),toWorld=(side,ahead)=>({x:start.x+start.tz*side+start.tx*ahead,z:start.z-start.tx*side+start.tz*ahead});
 // The community polyline origin defines this mode's timing line, not FIA timing loops.
 for(let x=-info.halfWidth;x<info.halfWidth;x++)for(let z=0;z<2;z++){const p=toWorld(x+.5,z*.6);box(1,.018,.6,p.x,.04,p.z,start.yaw,(x+z)%2?white:dark);}
 for(let i=0;i<10;i++){const p=toWorld(i%2?2.8:-2.8,-12-i*8);box(2,.018,.12,p.x,.035,p.z,start.yaw,white);}
 const gantry=toWorld(0,0);box(Math.max(17,info.halfWidth*2+6),.9,.7,gantry.x,5.8,gantry.z,start.yaw,dark);for(const side of [-1,1]){const p=toWorld(side*Math.max(8.5,info.halfWidth+3),0);box(.25,6,.25,p.x,3,p.z,0,metal);world.addStatic({x:p.x,z:p.z,hx:.15,hz:.15,kind:'计时门架'});}
 for(let i=0;i<(forest?0:12);i++){const p=toWorld(40,-70+i*13);box(12,5,12,p.x,2.5,p.z,start.yaw,white);box(.18,3,10,p.x-start.tz*6,2.4,p.z+start.tx*6,start.yaw,glass);world.addStatic({x:p.x,z:p.z,hx:6,hz:6,yaw:start.yaw,kind:'维修区建筑'});}
 for(let i=0;i<(forest?0:7);i++){const p=toWorld(-45-i*1.2,20);box(1.8,.5+i*.6,90,p.x,(.5+i*.6)/2,p.z,start.yaw,seat);}const roof=toWorld(-49,20);if(!forest)box(14,.3,94,roof.x,7,roof.z,start.yaw,metal);
 // Distance boards before high-curvature sections provide a braking reference.
 const board=(text)=>{const c=document.createElement('canvas');c.width=128;c.height=96;const ctx=c.getContext('2d');ctx.fillStyle='#f1f0e3';ctx.fillRect(0,0,128,96);ctx.fillStyle='#1e2b36';ctx.font='bold 49px sans-serif';ctx.textAlign='center';ctx.fillText(text,64,66);return new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),side:THREE.DoubleSide});};
 const boardMaterials=[board('150'),board('100'),board('50')];let lastBoard=-500;
 for(let i=1;i<route.segments.length;i++){const a=route.segments[i-1],b=route.segments[i],angle=Math.acos(Math.max(-1,Math.min(1,a.tx*b.tx+a.tz*b.tz)));if(angle>.19&&b.start-lastBoard>250){lastBoard=b.start;[150,100,50].forEach((d,k)=>{const p=route.at(b.start-d),x=p.x+p.tz*(info.halfWidth+3),z=p.z-p.tx*(info.halfWidth+3);box(1.5,1.2,.1,x,1.1,z,p.yaw,boardMaterials[k]);});}}
 for(const [material,items] of batches){const mesh=new THREE.InstancedMesh(BOX,material,items.length);items.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.set(p.w,p.h,p.d);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);}
 // Tree belt outside the runoff, sized and positioned in real metres.
 let seed=914;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};const trees=[];for(let i=0;i<(forest?3000:1000);i++){let x=route.bounds.minX-80+rnd()*(route.bounds.maxX-route.bounds.minX+160),z=route.bounds.minZ-80+rnd()*(route.bounds.maxZ-route.bounds.minZ+160);if(forest){const p=route.at(rnd()*route.length),side=(rnd()>.5?1:-1)*(14+rnd()*70);x=p.x+p.tz*side;z=p.z-p.tx*side;}const near=route.nearest(x,z);if(near.distance>(forest?12:45))trees.push({x,z,y:near.y,h:5+rnd()*8});}
 const canopy=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshStandardMaterial({map:foliage(),alphaTest:.45,side:THREE.DoubleSide,roughness:1}),trees.length*6);
 const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.14,.22,1,6),mat('#665d4c'),trees.length);
 trees.forEach((p,i)=>{dummy.position.set(p.x,p.y+p.h*.3,p.z);dummy.rotation.set(0,0,0);dummy.scale.set(1,p.h*.6,1);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
 for(let j=0;j<6;j++){const angle=j*Math.PI/3,ring=Math.floor(j/3);dummy.position.set(p.x+Math.sin(angle)*.55,p.y+p.h*(.62+ring*.1),p.z+Math.cos(angle)*.55);dummy.rotation.set(.07*(j%2),angle,0);dummy.scale.set(p.h*(.6-ring*.07),p.h*(.65-ring*.08),1);dummy.updateMatrix();canopy.setMatrixAt(i*6+j,dummy.matrix);}});canopy.castShadow=trunks.castShadow=true;scene.add(canopy,trunks);
 return {scene,sun,world,route,info,spawn:route.at(-35),follow(x,z){const y=route.nearest(x,z).y;sun.position.set(x-65,y+110,z+50);sun.target.position.set(x,y,z);},addParked(){}};
}
