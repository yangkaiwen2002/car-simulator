import * as THREE from '../vendor/three.module.min.js';
export const STREETS=[-240,-160,-80,0,80,160,240];
const BOX=new THREE.BoxGeometry(1,1,1);
function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function canvasTexture(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
function facade(kind,seed){
 const rnd=random(seed);return canvasTexture(256,512,(c,w,h)=>{
   c.fillStyle=kind===0?'#c8c1b1':kind===1?'#a3b1b5':'#a18c7d';c.fillRect(0,0,w,h);
   for(let y=0;y<h;y+=48){c.fillStyle='rgba(50,48,40,.22)';c.fillRect(0,y,w,2);for(let x=10;x<w;x+=41){
     c.fillStyle=rnd()>.84?'#c7b784':['#536570','#455a66','#65767e'][Math.floor(rnd()*3)];c.fillRect(x,y+9,27,30);
     c.fillStyle='rgba(210,229,229,.22)';c.fillRect(x+2,y+11,24,12);c.fillStyle='#777974';c.fillRect(x+12,y+9,2,30);c.fillStyle='#d0c8b6';c.fillRect(x-1,y+39,29,3);
   }}
 });
}
export function createCity(){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#b8cbd0');scene.fog=new THREE.FogExp2('#bfcccf',.0028);
 const hemi=new THREE.HemisphereLight('#d8eeff','#8c826b',2.15);scene.add(hemi);
 const sun=new THREE.DirectionalLight('#fff2dc',3.25);sun.position.set(-80,120,40);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-85;sun.shadow.camera.right=85;sun.shadow.camera.top=85;sun.shadow.camera.bottom=-85;sun.shadow.camera.far=350;sun.shadow.normalBias=.04;sun.shadow.bias=-.0003;scene.add(sun);scene.add(sun.target);
 const geoGroup=new THREE.Group();scene.add(geoGroup);const obstacles=[];
 const mat=(color,roughness=.85)=>new THREE.MeshStandardMaterial({color,roughness});
 const roadTex=canvasTexture(256,256,c=>{const rnd=random(92);c.fillStyle='#52565a';c.fillRect(0,0,256,256);for(let i=0;i<16000;i++){const n=70+rnd()*45;c.fillStyle=`rgba(${n},${n},${n},.25)`;c.fillRect(rnd()*256,rnd()*256,1,1);}});roadTex.wrapS=roadTex.wrapT=THREE.RepeatWrapping;roadTex.repeat.set(200,200);
 const box=(w,h,d,x,y,z,material,parent=geoGroup)=>{const o=new THREE.Mesh(BOX,material);o.scale.set(w,h,d);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
 const ground=box(1500,.15,1500,0,-.18,0,new THREE.MeshStandardMaterial({map:roadTex,roughness:1}));ground.castShadow=false;
 const curbMat=mat('#b6b7af'),sidewalkMat=mat('#cecec2'),white=mat('#e4e2cd'),yellow=mat('#ded099'),bark=mat('#6c6655'),leaf=mat('#617951'),metal=mat('#5b6364'),grass=mat('#7e8e63');
 const markings=[];const placeMark=(x,z,w,d)=>markings.push({x,z,w,d});
 for(const x of STREETS)for(let z=-276;z<=276;z+=8){if(STREETS.some(i=>Math.abs(z-i)<13))continue;placeMark(x,z,.12,4);placeMark(z,x,4,.12);}
 for(const x of STREETS)for(const z of STREETS){for(let k=-7;k<=7;k+=2){placeMark(x+k,z-12,1,3);placeMark(x+k,z+12,1,3);placeMark(x-12,z+k,3,1);placeMark(x+12,z+k,3,1);}placeMark(x+4.8,z+16,7,.3);placeMark(x-4.8,z-16,7,.3);}
 const lines=new THREE.InstancedMesh(BOX,white,markings.length);const dummy=new THREE.Object3D();markings.forEach((p,i)=>{dummy.position.set(p.x,.007,p.z);dummy.scale.set(p.w,.01,p.d);dummy.updateMatrix();lines.setMatrixAt(i,dummy.matrix);});lines.receiveShadow=true;geoGroup.add(lines);
 // Tree canopies and trunks are instanced so the city remains responsive on laptops.
 const trees=[];const rnd=random(8013);const facadeMats=Array.from({length:6},(_,i)=>new THREE.MeshStandardMaterial({map:facade(i%3,i+3),roughness:.78}));
 function tree(x,z,size=1){trees.push({x,z,s:size});}
 function label(text,w=256,bg='#273a3b',fg='#e7e8da'){return new THREE.MeshBasicMaterial({map:canvasTexture(w,64,(c)=>{c.fillStyle=bg;c.fillRect(0,0,w,64);c.fillStyle=fg;c.font='500 22px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,w/2,32);})});}
 const shopNames=['ATELIER','MORNING COFFEE','BAY STUDIO','BOOKS & RECORDS','HOTEL UNION','CORNER MARKET'];
 for(let ix=0;ix<6;ix++)for(let iz=0;iz<6;iz++){
   const cx=STREETS[ix]+40,cz=STREETS[iz]+40;
   box(57,.24,57,cx,.02,cz,curbMat);box(55,.06,55,cx,.17,cz,sidewalkMat);
   const park=(ix===4&&iz===3)||(ix===1&&iz===1);
   if(park){box(42,.09,42,cx,.22,cz,grass);for(let k=0;k<10;k++)tree(cx-18+rnd()*36,cz-18+rnd()*36,1+rnd()*.5);box(36,.08,2,cx,.3,cz,sidewalkMat);continue;}
   for(let dx of [-12,12])for(let dz of [-12,12]){
     const x=cx+dx,z=cz+dz,w=19+rnd()*3,d=19+rnd()*3,h=10+Math.floor(rnd()*6)*4;
     const facadeMaterial=facadeMats[Math.floor(rnd()*facadeMats.length)];
     box(w,h,d,x,h/2+.21,z,facadeMaterial);obstacles.push({x,z,hx:w/2+.4,hz:d/2+.4});
     box(w+.5,.35,d+.5,x,h+.3,z,curbMat);box(w,.18,d,x,3.5,z,curbMat);
     box(2.5,1.3,3,x+3,h+1.1,z+2,metal);
     if(dz<0){
       const shop=label(shopNames[(ix+iz+Math.floor(dx+12))%shopNames.length]);box(w-1,.7,.1,x,2.8,z-d/2-.05,shop);
       box(w-2,1.9,.1,x,1.35,z-d/2-.12,mat('#506368',.25));
       for(let k=-1;k<=1;k++)box(.1,2,.15,x+k*(w/3),1.35,z-d/2-.18,metal);
       box(w-1,.12,1.2,x,2.6,z-d/2-.5,mat(ix%2?'#7f9182':'#b29377'));
     }
   }
   for(let side of [-1,1]){tree(cx+side*26,cz-18,.82);tree(cx+side*26,cz+18,.82);}
 }
 const canopyGeo=new THREE.IcosahedronGeometry(1,2),trunkGeo=new THREE.CylinderGeometry(.14,.22,1,7);
 const canopy=new THREE.InstancedMesh(canopyGeo,leaf,trees.length*2),trunks=new THREE.InstancedMesh(trunkGeo,bark,trees.length);
 trees.forEach((p,i)=>{dummy.position.set(p.x,2.1*p.s,p.z);dummy.scale.set(p.s,4.2*p.s,p.s);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);for(let j=0;j<2;j++){dummy.position.set(p.x+j*.65,4.4*p.s+j,p.z);dummy.scale.set(2.1*p.s,2.6*p.s,2.2*p.s);dummy.updateMatrix();canopy.setMatrixAt(i*2+j,dummy.matrix);}});canopy.castShadow=trunks.castShadow=true;geoGroup.add(canopy,trunks);
 // Small-scale street furniture gives the cockpit a readable sense of speed.
 const signalGreen=new THREE.MeshBasicMaterial({color:'#92ce9a'}),signalRed=new THREE.MeshBasicMaterial({color:'#bd674f'});
 for(const x of STREETS)for(const z of STREETS){
   for(const side of [-1,1]){
     box(.14,5.9,.14,x+side*11.3,3,z+side*18,metal);box(2.5,.13,.13,x+side*10.2,5.9,z+side*18,metal);box(1,.1,.55,x+side*9.3,5.85,z+side*18,white);
     box(.12,3.2,.12,x+side*11.6,1.6,z+side*11.6,metal);box(.4,.95,.32,x+side*11.6,3.35,z+side*11.6,metal);
     box(.2,.2,.34,x+side*11.6,3.1,z+side*11.6,signalGreen);
     box(.34,.2,.2,x+side*11.6,3.65,z+side*11.6,signalRed);
   }
 }
 // Mark the end of the playable street grid with visible barriers.
 const barrierMat=new THREE.MeshStandardMaterial({map:canvasTexture(256,64,c=>{c.fillStyle='#e6dfc7';c.fillRect(0,0,256,64);c.fillStyle='#ac6854';for(let i=0;i<8;i+=2)c.fillRect(i*32,0,32,64);}),roughness:.8});
 for(const street of STREETS)for(const side of [-1,1]){box(20,.55,.4,street,.4,side*283,barrierMat);box(.4,.55,20,side*283,.4,street,barrierMat);}
 const boulevard=label('HARBOR DISTRICT  →',512);box(6,1.1,.14,4.6,5.2,108,boulevard);box(.15,5.8,.15,8.6,2.9,108,metal);box(5.9,.1,.1,5.7,5.8,108,metal);
 // Waterfront, sea wall, promenade, and a distant ridge.
 box(900,.1,1500,760,-.28,0,new THREE.MeshStandardMaterial({color:'#748f96',metalness:.4,roughness:.24}));
 box(8,.25,580,292,.05,0,sidewalkMat);box(.3,.7,580,300,.35,0,curbMat);
 for(let z=-276;z<280;z+=12){box(.12,1,.12,299,.6,z,metal);box(.1,.08,12,299,1.1,z+6,metal);tree(286,z,1.1);}
 for(let i=0;i<20;i++){const m=new THREE.Mesh(new THREE.ConeGeometry(60+rnd()*90,45+rnd()*95,7),mat('#91a4a4'));m.position.set(-700+i*90,5,-680-rnd()*100);scene.add(m);}
 const ringMat=mat('#acb69c');box(1150,.1,180,0,-.07,420,ringMat);box(1150,.1,180,0,-.07,-420,ringMat);
 const parked=new THREE.Group();scene.add(parked);
 return {scene,sun,obstacles,parked,blocked(x,z,yaw=0){
   if(Math.abs(x)>281||Math.abs(z)>281)return true;
   const hx=Math.abs(Math.cos(yaw))*.9+Math.abs(Math.sin(yaw))*2.2,hz=Math.abs(Math.sin(yaw))*.9+Math.abs(Math.cos(yaw))*2.2;
   return obstacles.some(b=>Math.abs(x-b.x)<b.hx+hx&&Math.abs(z-b.z)<b.hz+hz);
 },follow(x,z){sun.position.set(x-65,110,z+50);sun.target.position.set(x,0,z);},addParked(vehicle){if(parked.children.length)return;for(let i=0;i<6;i++){const clone=vehicle.root.clone();clone.position.set(i%2?8.5:-8.5,0,45-i*35);clone.rotation.y=i%2?0:Math.PI;parked.add(clone);obstacles.push({x:clone.position.x,z:clone.position.z,hx:.9,hz:2.3});}}};
}

export function createGarage(){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#252b2d');scene.fog=new THREE.Fog('#252b2d',16,40);
 scene.add(new THREE.HemisphereLight('#dce9f1','#565753',1.5));
 const key=new THREE.DirectionalLight('#e9f3ff',2.4);key.position.set(-3,7,-3);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-6;key.shadow.camera.right=6;key.shadow.camera.top=6;key.shadow.camera.bottom=-6;key.shadow.normalBias=.015;scene.add(key);
 const rim=new THREE.DirectionalLight('#dfab85',1.5);rim.position.set(4,3,5);scene.add(rim);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#333a3a',roughness:.75}));floor.rotation.x=-Math.PI/2;floor.position.y=-.012;floor.receiveShadow=true;scene.add(floor);
 const platform=new THREE.Mesh(new THREE.CylinderGeometry(3.5,3.5,.035,100),new THREE.MeshStandardMaterial({color:'#424a49',metalness:.25,roughness:.55}));platform.position.y=-.023;platform.receiveShadow=true;scene.add(platform);
 const circle=new THREE.Mesh(new THREE.TorusGeometry(3.55,.008,4,120),new THREE.MeshBasicMaterial({color:'#88908a'}));circle.rotation.x=-Math.PI/2;scene.add(circle);
 return scene;
}

export function makeEnvironment(renderer){
 const env=new THREE.Scene();env.background=new THREE.Color('#a3b2bd');
 for(const [x,y,z,w,h,color] of [[0,8,0,16,16,'#ffffff'],[-7,4,0,5,12,'#ecf4ff'],[8,3,0,4,14,'#e0cab2']]){
   const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);env.add(m);
 }
 const pmrem=new THREE.PMREMGenerator(renderer);const target=pmrem.fromScene(env,.04);pmrem.dispose();env.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});return target.texture;
}
