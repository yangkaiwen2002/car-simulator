// Smashable street furniture: light props that fly when hit instead of
// stopping the car. One InstancedMesh per kind keeps draw calls low.
import * as THREE from '../vendor/three.module.min.js';
const CELL=24;
// Parts: [w,h,d, x,y,z, color] in metres, y measured from the ground.
const KINDS={
 bin:{radius:.36,slow:.02,probes:[0],parts:[[.55,.8,.55,0,.58,0,'#5b6364'],[.6,.06,.6,0,1,0,'#3f4647']]},
 bench:{radius:.42,slow:.03,probes:[-1.1,0,1.1],parts:[[.7,.07,3,0,.6,0,'#69705d'],[.5,.4,.14,0,.35,-1,'#5b6364'],[.5,.4,.14,0,.35,1,'#5b6364']]},
 lamp:{radius:.2,slow:.05,probes:[0],parts:[[.14,5.9,.14,0,3,0,'#5b6364'],[2.5,.13,.13,-1.1,5.9,0,'#5b6364'],[1,.1,.55,-2,5.85,0,'#f4f0dc']]},
 signal:{radius:.2,slow:.04,probes:[0],parts:[[.12,3.2,.12,0,1.6,0,'#5b6364'],[.4,.95,.32,0,3.35,0,'#454c4d'],[.2,.2,.34,0,3.1,0,'#92ce9a'],[.34,.2,.2,0,3.65,0,'#bd674f']]},
};
function geometryFor(parts){
 const positions=[],normals=[],colors=[],indices=[],color=new THREE.Color();
 for(const [w,h,d,x,y,z,tint] of parts){
  const box=new THREE.BoxGeometry(w,h,d).translate(x,y,z),base=positions.length/3;color.set(tint);
  positions.push(...box.attributes.position.array);normals.push(...box.attributes.normal.array);for(let i=0;i<box.attributes.position.count;i++)colors.push(color.r,color.g,color.b);for(const index of box.index.array)indices.push(base+index);box.dispose();
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);return geometry;
}
export function createProps(scene){
 const items=[],grid=new Map(),meshes={},flying=new Set(),dummy=new THREE.Object3D();dummy.rotation.order='YXZ';
 const cellKey=(x,z)=>Math.floor(x/CELL)+','+Math.floor(z/CELL);
 function place(item){dummy.position.set(item.x+item.ox,item.y,item.z+item.oz);dummy.rotation.set(item.pitch,item.yaw+item.spin,item.roll);dummy.updateMatrix();const mesh=meshes[item.kind];mesh.setMatrixAt(item.slot,dummy.matrix);mesh.instanceMatrix.needsUpdate=true;}
 return {
  add(kind,x,z,yaw=0){const item={kind,x,z,yaw,ox:0,oz:0,y:0,pitch:0,roll:0,spin:0,state:'standing',vx:0,vy:0,vz:0,turn:0,tumble:0,slot:items.filter(i=>i.kind===kind).length};items.push(item);const key=cellKey(x,z);if(!grid.has(key))grid.set(key,[]);grid.get(key).push(item);},
  build(){
   const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8});
   for(const kind of Object.keys(KINDS)){const count=items.filter(i=>i.kind===kind).length;if(!count)continue;const mesh=new THREE.InstancedMesh(geometryFor(KINDS[kind].parts),material,count);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;meshes[kind]=mesh;scene.add(mesh);}
   for(const item of items)place(item);
  },
  // Knock over anything inside the car's footprint. Returns the number hit this step.
  collide(state,specs){
   const speed=Math.hypot(state.speed,state.sideSpeed||0);if(speed<1.2)return 0;
   const shape=specs.collider||{hx:.9,hz:2.2},sin=Math.sin(state.yaw),cos=Math.cos(state.yaw),cx=Math.floor(state.x/CELL),cz=Math.floor(state.z/CELL);let hits=0;
   for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(const item of grid.get((cx+i)+','+(cz+j))||[]){
    if(item.state!=='standing')continue;const kind=KINDS[item.kind];
    for(const probe of kind.probes){
     const px=item.x+Math.sin(item.yaw)*probe-state.x,pz=item.z+Math.cos(item.yaw)*probe-state.z,right=px*cos-pz*sin,forward=-px*sin-pz*cos;
     if(Math.abs(right)>shape.hx+kind.radius||Math.abs(forward)>shape.hz+kind.radius)continue;
     const vx=cos*(state.sideSpeed||0)-sin*state.speed,vz=-sin*(state.sideSpeed||0)-cos*state.speed;
     item.state='flying';item.vx=vx*(.55+Math.random()*.3)+right*1.5*cos;item.vz=vz*(.55+Math.random()*.3)-right*1.5*sin;item.vy=2.5+Math.min(speed*.14,6);item.turn=(Math.random()-.5)*9;item.tumble=(right>=0?1:-1)*(2.5+Math.random()*4);flying.add(item);
     state.speed*=1-kind.slow;state.impactPulse=Math.max(state.impactPulse||0,.22);hits++;break;
    }
   }
   return hits;
  },
  update(dt){
   if(!flying.size||!(dt>0))return;
   for(const item of flying){
    item.vy-=9.81*dt;item.ox+=item.vx*dt;item.oz+=item.vz*dt;item.y+=item.vy*dt;item.spin+=item.turn*dt;item.roll+=item.tumble*dt;item.pitch+=item.tumble*.6*dt;
    if(item.y<=.12&&item.vy<0){item.y=.12;item.roll=Math.PI/2;item.pitch=0;item.state='down';flying.delete(item);}
    place(item);
   }
  },
  reset(){flying.clear();for(const item of items){if(item.state==='standing')continue;Object.assign(item,{state:'standing',ox:0,oz:0,y:0,pitch:0,roll:0,spin:0});place(item);}},
 };
}
