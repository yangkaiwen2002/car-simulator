import * as THREE from '../vendor/three.module.min.js';
import {createCollisionWorld} from './collision.js';
export const STREETS=[-240,-160,-80,0,80,160,240];
const BOX=new THREE.BoxGeometry(1,1,1);
function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function canvasTexture(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
function facade(kind,seed){
 const rnd=random(seed);return canvasTexture(384,128,(c,w,h)=>{
 const colors=['#c0b5a2','#8d999d','#aa8170','#d0c6af','#687e85','#c1bca9'];
 c.fillStyle=colors[kind];c.fillRect(0,0,w,h);
 if(kind===2){c.strokeStyle='#63585135';c.lineWidth=1;for(let y=0;y<h;y+=8){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();for(let x=(y%16?0:12);x<w;x+=24){c.beginPath();c.moveTo(x,y);c.lineTo(x,y+8);c.stroke();}}}
 c.fillStyle='#252f3333';c.fillRect(0,0,w,3);c.fillStyle='#e1d8c650';c.fillRect(0,124,w,4);
 for(let x=14;x<w;x+=64){c.fillStyle='#343c3e';c.fillRect(x-2,23,43,79);const g=c.createLinearGradient(0,25,0,100);g.addColorStop(0,'#8ea7b4');g.addColorStop(.42,'#687f8b');g.addColorStop(.43,'#3d5058');g.addColorStop(1,'#253d46');c.fillStyle=g;c.fillRect(x,25,39,74);
 if(rnd()>.45){c.fillStyle='#bbc0b652';c.fillRect(x+2,27,8,70);}c.fillStyle=kind===4?'#b9c4c4':'#ded6c2';c.fillRect(x+18,25,2,74);c.fillRect(x,58,39,2);c.fillRect(x-3,100,46,4);c.fillStyle='#151c2633';c.fillRect(x-3,104,46,6);}
 });
}
function foliage(){return canvasTexture(256,256,c=>{const rnd=random(765);for(let i=0;i<2100;i++){const x=rnd()*256,y=rnd()*256,dx=(x-128)/112,dy=(y-130)/118;if(dx*dx+dy*dy>1||rnd()<.12)continue;c.fillStyle=['#809449','#60793d','#a3ad60','#486836','#8c9f51'][Math.floor(rnd()*5)];c.beginPath();c.ellipse(x,y,3+rnd()*5,2+rnd()*3,rnd()*3,0,Math.PI*2);c.fill();}});}
export function createCity(){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#a8c9e0');scene.fog=new THREE.FogExp2('#b9d0df',.00155);
 const hemi=new THREE.HemisphereLight('#cce5ff','#696448',1.6);scene.add(hemi);
 const sun=new THREE.DirectionalLight('#ffe3b1',3.4);sun.position.set(-80,120,40);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-85;sun.shadow.camera.right=85;sun.shadow.camera.top=85;sun.shadow.camera.bottom=-85;sun.shadow.camera.far=350;sun.shadow.normalBias=.04;sun.shadow.bias=-.0003;scene.add(sun);scene.add(sun.target);
 const geoGroup=new THREE.Group();scene.add(geoGroup);const obstacles=[];const world=createCollisionWorld();const solid=(x,z,hx,hz,kind)=>world.addStatic({x,z,hx,hz,kind});
 const mat=(color,roughness=.85)=>new THREE.MeshStandardMaterial({color,roughness});
 const roadTex=canvasTexture(256,256,c=>{const rnd=random(92);c.fillStyle='#4c5053';c.fillRect(0,0,256,256);for(let i=0;i<16000;i++){const n=70+rnd()*45;c.fillStyle=`rgba(${n},${n},${n},.25)`;c.fillRect(rnd()*256,rnd()*256,1,1);}});roadTex.wrapS=roadTex.wrapT=THREE.RepeatWrapping;roadTex.repeat.set(120,120);
 const batches=new Map();
 const box=(w,h,d,x,y,z,material)=>{if(!batches.has(material))batches.set(material,[]);batches.get(material).push({w,h,d,x,y,z});};
 box(600,.15,600,-10,-.085,0,new THREE.MeshStandardMaterial({map:roadTex,roughness:1}));
 const curbMat=mat('#a9aaa4'),sidewalkMat=mat('#c7c5b8'),white=mat('#e4e2cd'),yellow=mat('#ded099'),bark=mat('#6c6655'),leaf=mat('#617951'),metal=mat('#5b6364'),grass=mat('#7b9154');
 const markings=[];const placeMark=(x,z,w,d)=>markings.push({x,z,w,d});
 for(const x of STREETS)for(let z=-276;z<=276;z+=8){if(STREETS.some(i=>Math.abs(z-i)<13))continue;placeMark(x-3.6,z,.10,3.3);placeMark(x+3.6,z,.10,3.3);placeMark(z,x-3.6,3.3,.10);placeMark(z,x+3.6,3.3,.10);for(const offset of [-.18,.18]){box(.09,.012,6,x+offset,.012,z,yellow);box(6,.012,.09,z,.012,x+offset,yellow);}}
 for(const x of STREETS)for(const z of STREETS){for(let k=-7;k<=7;k+=2){placeMark(x+k,z-12,1,3);placeMark(x+k,z+12,1,3);placeMark(x-12,z+k,3,1);placeMark(x+12,z+k,3,1);}placeMark(x+4.8,z+16,7,.3);placeMark(x-4.8,z-16,7,.3);}
 const lines=new THREE.InstancedMesh(BOX,white,markings.length);const dummy=new THREE.Object3D();markings.forEach((p,i)=>{dummy.position.set(p.x,.007,p.z);dummy.scale.set(p.w,.01,p.d);dummy.updateMatrix();lines.setMatrixAt(i,dummy.matrix);});lines.receiveShadow=true;geoGroup.add(lines);
 // Tree canopies and trunks are instanced so the city remains responsive on laptops.
 const trees=[];const rnd=random(8013);const facadeMaps=Array.from({length:6},(_,i)=>facade(i,i+3));const facadeMats=new Map();
 function buildingMaterial(kind,floors){const key=kind+'-'+floors;if(!facadeMats.has(key)){const map=facadeMaps[kind].clone();map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(1,floors);map.needsUpdate=true;facadeMats.set(key,new THREE.MeshStandardMaterial({map,roughness:.75}));}return facadeMats.get(key);}
 function tree(x,z,size=1){trees.push({x,z,s:size});solid(x,z,.22*size,.22*size,'树干');}
 function label(text,w=256,bg='#273a3b',fg='#e7e8da'){return new THREE.MeshBasicMaterial({map:canvasTexture(w,64,(c)=>{c.fillStyle=bg;c.fillRect(0,0,w,64);c.fillStyle=fg;c.font='500 22px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,w/2,32);})});}
 const shopNames=['ATELIER','MORNING COFFEE','BAY STUDIO','BOOKS & RECORDS','HOTEL UNION','CORNER MARKET'];const shopMaterials=shopNames.map((name,i)=>label(name,512,i%2?'#294940':'#343c4a'));const shopGlass=mat('#324a50',.15),awning=mat('#69705d'),roof=mat('#858783'),trim=mat('#cfc9b8');
 for(let ix=0;ix<6;ix++)for(let iz=0;iz<6;iz++){
   const cx=STREETS[ix]+40,cz=STREETS[iz]+40;
   box(59,.2,59,cx,.05,cz,curbMat);box(58.3,.04,58.3,cx,.17,cz,sidewalkMat);
   for(let k=-28;k<29;k+=3.5){box(58,.004,.025,cx,.194,cz+k,curbMat);box(.025,.004,58,cx+k,.195,cz,curbMat);}
   const park=(ix===4&&iz===3)||(ix===1&&iz===1);
   if(park){box(42,.09,42,cx,.22,cz,grass);for(let k=0;k<10;k++)tree(cx-18+rnd()*36,cz-18+rnd()*36,1+rnd()*.5);box(36,.08,2,cx,.3,cz,sidewalkMat);continue;}
   for(let dx of [-12,12])for(let dz of [-12,12]){
     const x=cx+dx,z=cz+dz,w=19+rnd()*3,d=19+rnd()*3,kind=(ix+iz+Math.floor(rnd()*3))%6,floors=(iz<2?5:2)+Math.floor(rnd()*(iz<2?7:4)),h=floors*3.35;
     const facadeMaterial=buildingMaterial(kind,floors);
     box(w,h,d,x,h/2+.21,z,facadeMaterial);solid(x,z,w/2,d/2,'建筑墙面');
     box(w+.5,.35,d+.5,x,h+.3,z,trim);box(w-.5,.12,d-.5,x,h+.55,z,roof);box(w+.25,.18,d+.25,x,3.55,z,trim);
     for(const sx of [-1,1])for(const sz of [-1,1])box(.32,h,.32,x+sx*(w/2-.2),h/2+.25,z+sz*(d/2-.2),trim);
     if(kind===4){for(let n=7;n<h;n+=3.35)box(w+.15,.13,d+.15,x,n,z,metal);}else if(kind===2||kind===3){for(let n=6.8;n<h-1;n+=3.35)for(let bx=-1;bx<=1;bx++){box(3,.14,1.1,x+bx*w*.3,n,z-d/2-.35,trim);box(3,.45,.05,x+bx*w*.3,n+.28,z-d/2-.85,metal);}}
     box(2.5,1.3,3,x+3,h+1.1,z+2,metal);
     if(dz<0){
       const shop=shopMaterials[(ix+iz+Math.floor(dx+12))%shopNames.length];box(w-1,.7,.1,x,2.8,z-d/2-.05,shop);
       box(w-2,1.9,.1,x,1.35,z-d/2-.12,shopGlass);
       for(let k=-1;k<=1;k++)box(.1,2,.15,x+k*(w/3),1.35,z-d/2-.18,metal);
       box(w-1,.12,1.2,x,2.6,z-d/2-.5,awning);
     }
   }
   for(let side of [-1,1]){tree(cx+side*26.5,cz-17,1);tree(cx+side*26.5,cz+17,.9);
     for(const tz of [-17,17]){box(2.7,.2,2.7,cx+side*26.5,.26,cz+tz,curbMat);box(2.3,.04,2.3,cx+side*26.5,.38,cz+tz,grass);}
     solid(cx+side*26.5,cz,.275,.275,'垃圾箱');solid(cx+side*26.5,cz+6,.35,1.5,'长椅');box(.55,.8,.55,cx+side*26.5,.58,cz,metal);box(.7,.07,3,cx+side*26.5,.6,cz+6,awning);for(const bz of [5,7])box(.5,.4,.14,cx+side*26.5,.35,cz+bz,metal);}
 }
 // Place waterfront trees before constructing the instanced canopy.
 for(let z=-268;z<280;z+=20)tree(286,z,1.2);
 const trunkGeo=new THREE.CylinderGeometry(.12,.23,1,7),leafGeo=new THREE.PlaneGeometry(1,1);
 const canopy=new THREE.InstancedMesh(leafGeo,new THREE.MeshStandardMaterial({map:foliage(),alphaTest:.45,side:THREE.DoubleSide,roughness:1}),trees.length*9),trunks=new THREE.InstancedMesh(trunkGeo,bark,trees.length);
 trees.forEach((p,i)=>{dummy.rotation.set(0,0,0);dummy.position.set(p.x,2.25*p.s,p.z);dummy.scale.set(p.s,4.5*p.s,p.s);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);for(let j=0;j<9;j++){const ring=Math.floor(j/3),angle=j*Math.PI*2/3;dummy.position.set(p.x+Math.sin(angle)*.7,4.1*p.s+ring*.65,p.z+Math.cos(angle)*.7);dummy.rotation.set(.12*(j%2),angle+ring*.5,0);dummy.scale.set((4.5-ring*.5)*p.s,(4.7-ring*.4)*p.s,1);dummy.updateMatrix();canopy.setMatrixAt(i*9+j,dummy.matrix);}});canopy.castShadow=trunks.castShadow=true;geoGroup.add(canopy,trunks);dummy.rotation.set(0,0,0);
 // Small-scale street furniture gives the cockpit a readable sense of speed.
 const signalGreen=new THREE.MeshBasicMaterial({color:'#92ce9a'}),signalRed=new THREE.MeshBasicMaterial({color:'#bd674f'});
 for(const x of STREETS)for(const z of STREETS){
   for(const side of [-1,1]){
     solid(x+side*11.3,z+side*18,.09,.09,'路灯');solid(x+side*11.6,z+side*11.6,.09,.09,'交通灯杆');
     box(.14,5.9,.14,x+side*11.3,3,z+side*18,metal);box(2.5,.13,.13,x+side*10.2,5.9,z+side*18,metal);box(1,.1,.55,x+side*9.3,5.85,z+side*18,white);
     box(.12,3.2,.12,x+side*11.6,1.6,z+side*11.6,metal);box(.4,.95,.32,x+side*11.6,3.35,z+side*11.6,metal);
     box(.2,.2,.34,x+side*11.6,3.1,z+side*11.6,signalGreen);
     box(.34,.2,.2,x+side*11.6,3.65,z+side*11.6,signalRed);
   }
 }
 // Mark the end of the playable street grid with visible barriers.
 const barrierMat=new THREE.MeshStandardMaterial({map:canvasTexture(256,64,c=>{c.fillStyle='#e6dfc7';c.fillRect(0,0,256,64);c.fillStyle='#ac6854';for(let i=0;i<8;i+=2)c.fillRect(i*32,0,32,64);}),roughness:.8});
 for(const street of STREETS)for(const side of [-1,1]){solid(street,side*283,10,.2,'道路护栏');solid(side*283,street,.2,10,'道路护栏');box(20,.55,.4,street,.4,side*283,barrierMat);box(.4,.55,20,side*283,.4,street,barrierMat);}
 solid(8.6,108,.09,.09,'路牌立柱');
 const boulevard=label('HARBOR DISTRICT  →',512);box(6,1.1,.14,4.6,5.2,108,boulevard);box(.15,5.8,.15,8.6,2.9,108,metal);box(5.9,.1,.1,5.7,5.8,108,metal);
 // Waterfront, sea wall, promenade, and a distant ridge.
 box(900,.1,1500,742,-.16,0,new THREE.MeshStandardMaterial({color:'#548a9e',metalness:.4,roughness:.24}));
 box(10,.25,580,293,.05,0,sidewalkMat);box(.3,.7,580,300,.35,0,curbMat);
 for(let z=-276;z<280;z+=12){box(.12,1,.12,299,.6,z,metal);box(.1,.08,12,299,1.1,z+6,metal);}
 for(let i=0;i<20;i++){const m=new THREE.Mesh(new THREE.ConeGeometry(60+rnd()*90,45+rnd()*95,7),mat('#91a4a4'));m.position.set(-700+i*90,5,-680-rnd()*100);scene.add(m);}
 const ringMat=mat('#acb69c');box(1150,.1,180,0,-.07,420,ringMat);box(1150,.1,180,0,-.07,-420,ringMat);
 // Parking bays and street drains provide scale without adding traffic AI.
 for(const sx of STREETS)for(const z of [-208,-128,-48,32,112,192])for(const side of [-1,1]){box(2.2,.012,.10,sx+side*8.7,.02,z,white);box(.10,.012,6,sx+side*7.55,.02,z+3,white);box(.4,.016,.65,sx+side*10.1,.02,z+8,metal);}
 for(const side of [-1,1]){solid(side*298,0,.2,298,'外围护栏');solid(0,side*298,298,.2,'外围护栏');box(.4,.75,596,side*298,.375,0,curbMat);box(596,.75,.4,0,.375,side*298,curbMat);}
 for(const [material,items] of batches){const mesh=new THREE.InstancedMesh(BOX,material,items.length);items.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,0,0);dummy.scale.set(p.w,p.h,p.d);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.castShadow=true;mesh.receiveShadow=true;geoGroup.add(mesh);}
 const parked=new THREE.Group(),parkedIds=new Set();scene.add(parked);
 return {scene,sun,world,parked,follow(x,z){sun.position.set(x-65,110,z+50);sun.target.position.set(x,0,z);},addParked(vehicle,id){if(parkedIds.has(id))return;const slot=['MI','3S','MC'].indexOf(id);if(slot<0)return;parkedIds.add(id);for(let i=0;i<5;i++){const clone=vehicle.root.clone();const body=clone.getObjectByName('body');body.geometry=body.geometry.clone();body.material=body.material.clone();const x=(i%2?8.7:-8.7)+(i>2?80:0),z=117-slot*12-i*49;clone.position.set(x,0,z);clone.rotation.y=i%2?0:Math.PI;parked.add(clone);const shape=vehicle.collider,angle=clone.rotation.y,c=Math.cos(angle),sn=Math.sin(angle);world.addDynamic({x:x+c*shape.cx+sn*shape.cz,z:z-sn*shape.cx+c*shape.cz,yaw:angle,hx:shape.hx,hz:shape.hz,mass:vehicle.mass,kind:'停放车辆',restitution:.16,friction:.4,onMove:b=>{const cos=Math.cos(b.yaw),sin=Math.sin(b.yaw);clone.position.set(b.x-cos*shape.cx-sin*shape.cz,0,b.z+sin*shape.cx-cos*shape.cz);clone.rotation.y=b.yaw;}});}}};
}

export function createGarage(){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#111722');scene.fog=new THREE.Fog('#111722',16,40);
 scene.add(new THREE.HemisphereLight('#dce9f1','#1c253a',1.5));
 const key=new THREE.DirectionalLight('#e9f3ff',2.4);key.position.set(-3,7,-3);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-6;key.shadow.camera.right=6;key.shadow.camera.top=6;key.shadow.camera.bottom=-6;key.shadow.normalBias=.015;scene.add(key);
 const rim=new THREE.DirectionalLight('#aac6f7',1.6);rim.position.set(4,3,5);scene.add(rim);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#192333',roughness:.58}));floor.rotation.x=-Math.PI/2;floor.position.y=-.012;floor.receiveShadow=true;scene.add(floor);
 const platform=new THREE.Mesh(new THREE.CylinderGeometry(3.5,3.5,.035,100),new THREE.MeshStandardMaterial({color:'#263142',metalness:.4,roughness:.38}));platform.position.y=-.023;platform.receiveShadow=true;scene.add(platform);
 const circle=new THREE.Mesh(new THREE.TorusGeometry(3.55,.008,4,120),new THREE.MeshBasicMaterial({color:'#61748e'}));circle.rotation.x=-Math.PI/2;scene.add(circle);
 return scene;
}

export function makeEnvironment(renderer){
 const env=new THREE.Scene();env.background=new THREE.Color('#a3b2bd');
 for(const [x,y,z,w,h,color] of [[0,8,0,16,16,'#ffffff'],[-7,4,0,5,12,'#ecf4ff'],[8,3,0,4,14,'#e0cab2']]){
   const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);env.add(m);
 }
 const pmrem=new THREE.PMREMGenerator(renderer);const target=pmrem.fromScene(env,.04);pmrem.dispose();env.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});return target.texture;
}
