import * as THREE from '../vendor/three.module.min.js';
// Small live overlay on the original community model's steering-wheel screen.
export function formulaDisplay(steering,scale){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=108;
 const ctx=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const screen=new THREE.Mesh(new THREE.PlaneGeometry(.064*scale,.027*scale),new THREE.MeshBasicMaterial({map:texture,toneMapped:false,side:THREE.DoubleSide}));
 screen.rotation.x=Math.PI/2;screen.position.set(0,-.010*scale,.006*scale);steering.add(screen);
 let last='';return state=>{const speed=Math.round(Math.abs(state.speed)*3.6),gear=state.direction<0?'R':state.gear,rev=Math.round(state.rpm/15000*15),key=`${speed}/${gear}/${rev}`;if(key===last)return;last=key;
 ctx.fillStyle='#05080d';ctx.fillRect(0,0,256,108);
 for(let i=0;i<15;i++){ctx.fillStyle=i<rev?(i<5?'#63ff64':i<10?'#ff413b':'#579cff'):'#202632';ctx.fillRect(8+i*16,7,11,8);}
 ctx.fillStyle='white';ctx.textAlign='center';ctx.font='bold 70px sans-serif';ctx.fillText(gear,174,89);ctx.font='bold 35px sans-serif';ctx.fillText(speed,64,64);ctx.font='14px sans-serif';ctx.fillStyle='#aebcca';ctx.fillText('KM/H',64,87);texture.needsUpdate=true;};
}
