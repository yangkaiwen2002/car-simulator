// Tire smoke / dust particles and skid marks for one scene.
import * as THREE from '../vendor/three.module.min.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const PARTICLES=180,QUADS=700;
export function createEffects(scene){
 const positions=new Float32Array(PARTICLES*3),look=new Float32Array(PARTICLES*3);// look: size, alpha, dust
 const particles=Array.from({length:PARTICLES},()=>({life:0,max:1,vx:0,vy:0,vz:0,size:1,dust:0,strength:1}));
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('look',new THREE.BufferAttribute(look,3));
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{scale:{value:600}},
  vertexShader:'attribute vec3 look;uniform float scale;varying vec2 vLook;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=look.x*scale/max(.1,-mv.z);vLook=look.yz;}',
  fragmentShader:'varying vec2 vLook;void main(){float d=length(gl_PointCoord-.5)*2.0;float a=smoothstep(1.0,.15,d)*vLook.x;if(a<.004)discard;gl_FragColor=vec4(mix(vec3(.93,.94,.96),vec3(.62,.55,.42),vLook.y),a);}'});
 const points=new THREE.Points(geometry,material);points.frustumCulled=false;points.renderOrder=3;scene.add(points);
 let next=0;
 function emit(x,y,z,vx,vz,strength,dust){const slot=next,p=particles[slot];next=(next+1)%PARTICLES;p.life=p.max=.7+Math.random()*.8;p.vx=vx+(Math.random()-.5)*1.4;p.vz=vz+(Math.random()-.5)*1.4;p.vy=.5+Math.random()*.9;p.size=.5+Math.random()*.4;p.dust=dust?1:0;p.strength=strength;const i=slot*3;positions[i]=x;positions[i+1]=y;positions[i+2]=z;}
 // Skid marks: a ring buffer of ground quads, one strip per wheel.
 const skidPositions=new Float32Array(QUADS*12),skidGeometry=new THREE.BufferGeometry(),indices=[];
 for(let q=0;q<QUADS;q++){const v=q*4;indices.push(v,v+1,v+2,v+1,v+3,v+2);}
 skidGeometry.setAttribute('position',new THREE.BufferAttribute(skidPositions,3));skidGeometry.setIndex(indices);
 const skids=new THREE.Mesh(skidGeometry,new THREE.MeshBasicMaterial({color:'#0c0d0f',transparent:true,opacity:.42,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}));skids.frustumCulled=false;skids.renderOrder=1;scene.add(skids);
 let quad=0;const trails=[null,null,null,null],world=new THREE.Vector3();let emitClock=0;
 function mark(index,x,y,z,nx,nz,width){
  const left=[x-nx*width,y,z-nz*width],right=[x+nx*width,y,z+nz*width],last=trails[index];trails[index]={left,right};
  if(!last||Math.hypot(last.left[0]-left[0],last.left[2]-left[2])>3)return;
  skidPositions.set([...last.left,...last.right,...left,...right],quad*12);quad=(quad+1)%QUADS;skidGeometry.attributes.position.needsUpdate=true;
 }
 return {
  clear(){skidPositions.fill(0);skidGeometry.attributes.position.needsUpdate=true;trails.fill(null);for(const p of particles)p.life=0;look.fill(0);geometry.attributes.look.needsUpdate=true;},
  // Call once per rendered frame while driving.
  update(dt,{state,vehicle,camera,viewportHeight,offRoad=false,handbrake=false,enabled=true}){
   material.uniforms.scale.value=viewportHeight/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2));
   const speed=Math.hypot(state.speed,state.sideSpeed||0),ground=(state.groundHeight||0)+.03;
   if(enabled&&dt>0&&vehicle?.wheels){
    const rear=clamp(Math.max((Math.abs(state.rearSlip||0)-.1)*5,(state.wheelspin||0)*.8,handbrake&&speed>4?.9:0),0,1)*(speed>2.5||state.wheelspin>.2?1:0);
    const front=clamp((Math.abs(state.frontSlip||0)-.15)*5,0,1)*(speed>6?1:0);
    const dust=offRoad&&speed>6?clamp(speed/30,.25,.8):0;
    emitClock+=dt;const puff=emitClock>.028;if(puff)emitClock=0;
    // Skid direction follows travel; its normal sets the strip width.
    const sin=Math.sin(state.yaw),cos=Math.cos(state.yaw),vx=cos*(state.sideSpeed||0)-sin*state.speed,vz=-sin*(state.sideSpeed||0)-cos*state.speed,norm=Math.hypot(vx,vz)||1;
    vehicle.wheels.forEach((wheel,index)=>{
     const amount=Math.max(wheel.front?front:rear,dust);
     if(amount<.12){trails[index]=null;return;}
     wheel.pivot.getWorldPosition(world);
     if(!offRoad)mark(index,world.x,ground,world.z,-vz/norm,vx/norm,.13);else trails[index]=null;
     if(puff&&(dust||amount>.3))emit(world.x,ground+.15,world.z,vx*.12,vz*.12,dust?dust*.5:amount*.55,!!dust);
    });
   }else trails.fill(null);
   for(let i=0;i<PARTICLES;i++){const p=particles[i],j=i*3;if(p.life<=0){if(look[j+1]){look[j+1]=0;}continue;}
    p.life-=dt;const age=1-Math.max(0,p.life)/p.max;positions[j]+=p.vx*dt;positions[j+1]+=p.vy*dt;positions[j+2]+=p.vz*dt;p.vx*=1-dt*1.5;p.vz*=1-dt*1.5;
    look[j]=p.size*(1+age*3.2);look[j+1]=p.life>0?(1-age)*Math.min(1,age*8)*p.strength:0;look[j+2]=p.dust;}
   geometry.attributes.position.needsUpdate=true;geometry.attributes.look.needsUpdate=true;
  },
 };
}
