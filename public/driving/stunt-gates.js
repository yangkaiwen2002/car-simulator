// Roadside banners and ground stripes that mark the city stunts.
import * as THREE from '../vendor/three.module.min.js';
import {STUNTS,ROAD_HALF} from './stunts.js';
export const STUNT_COLORS={trap:'#27d3ff',zone:'#ffb629',drift:'#ff3d94'};
const TITLES={trap:'SPEED TRAP · 测速点',zone:'SPEED ZONE · 区间测速',drift:'DRIFT ZONE · 漂移区'};
function banner(text,color){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=64;const c=canvas.getContext('2d');
 c.fillStyle='#14161f';c.fillRect(0,0,1024,64);c.fillStyle=color;c.fillRect(0,0,1024,7);c.fillRect(0,57,1024,7);
 for(let x=0;x<1024;x+=256){c.fillStyle=color;c.beginPath();c.moveTo(x+14,18);c.lineTo(x+40,18);c.lineTo(x+28,46);c.lineTo(x+2,46);c.fill();}
 c.fillStyle='#fff';c.font='700 28px "Helvetica Neue",Arial,"PingFang SC",sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,512,33);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;return new THREE.MeshBasicMaterial({map:texture,toneMapped:false});
}
export function addStuntGates(scene){
 const group=new THREE.Group(),post=new THREE.MeshStandardMaterial({color:'#2a2d3a',roughness:.6,metalness:.4});
 for(const stunt of STUNTS){
  const color=STUNT_COLORS[stunt.kind],face=banner(`${TITLES[stunt.kind]}  ·  ${stunt.name}`,color),side=new THREE.MeshBasicMaterial({color:'#14161f'});
  const stripe=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.75,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  for(const gate of stunt.gates){
   const px=-gate.dz,pz=gate.dx,yaw=Math.atan2(-pz,px),width=ROAD_HALF*2+1.6;
   const board=new THREE.Mesh(new THREE.BoxGeometry(width,1.35,.22),[side,side,side,side,face,face]);board.position.set(gate.x,6.4,gate.z);board.rotation.y=yaw;group.add(board);
   for(const sign of [-1,1]){const pole=new THREE.Mesh(new THREE.BoxGeometry(.3,7.1,.3),post);pole.position.set(gate.x+px*sign*(width/2-.15),3.55,gate.z+pz*sign*(width/2-.15));pole.castShadow=true;group.add(pole);
    const lamp=new THREE.Mesh(new THREE.BoxGeometry(.36,.9,.36),new THREE.MeshBasicMaterial({color,toneMapped:false}));lamp.position.set(pole.position.x,5.2,pole.position.z);group.add(lamp);}
   const ground=new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF*2,1.1),stripe);ground.rotation.order='YXZ';ground.rotation.set(-Math.PI/2,yaw,0);ground.position.set(gate.x,.03,gate.z);group.add(ground);
  }
 }
 scene.add(group);return group;
}
