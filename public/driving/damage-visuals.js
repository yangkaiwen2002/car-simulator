import * as THREE from '../vendor/three.module.min.js';
export function damageVisuals(root,source,body,specs){
 const engineZ=specs.engineLocation==='rear'?1:-1.1;
 body.geometry=body.geometry.clone();const original=body.geometry.attributes.position.array.slice(),box=body.geometry.boundingBox;
 const width=box.max.x-box.min.x,length=box.max.y-box.min.y;
 let revision=-1,burstStart=-100,wasExploded=false;
 const group=new THREE.Group();root.add(group);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const c=canvas.getContext('2d'),g=c.createRadialGradient(32,32,2,32,32,31);g.addColorStop(0,'#ffffff');g.addColorStop(.4,'#ffffffe8');g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.fillRect(0,0,64,64);const texture=new THREE.CanvasTexture(canvas);
 const smoke=Array.from({length:14},()=>{const m=new THREE.SpriteMaterial({map:texture,color:'#33383b',transparent:true,opacity:0,depthWrite:false});const p=new THREE.Sprite(m);group.add(p);return p;});
 const fire=Array.from({length:9},()=>{const m=new THREE.SpriteMaterial({map:texture,color:'#ff7b17',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});const p=new THREE.Sprite(m);group.add(p);return p;});
 const flash=new THREE.PointLight('#ff8a30',0,13,2);flash.position.set(0,1,engineZ);group.add(flash);
 const cracks=new THREE.Group();source.add(cracks);const lineMat=new THREE.LineBasicMaterial({color:'#c9d4d8',transparent:true,opacity:.6});
 for(let i=0;i<8;i++){const angle=i*Math.PI/4,points=[];for(let j=0;j<4;j++)points.push(new THREE.Vector3(Math.cos(angle)*j*.06,box.max.y*.3+Math.sin(angle)*j*.04,box.max.z*.8+j*.01));cracks.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),lineMat));}cracks.visible=false;
 return function update(state){const d=state.damage;if(!d)return;
  if(revision!==d.revision){revision=d.revision;const a=body.geometry.attributes.position.array;
   for(let i=0;i<a.length;i+=3){let x=original[i],y=original[i+1],z=original[i+2];const front=Math.max(0,(y-(box.max.y-length*.3))/(length*.3)),rear=Math.max(0,((box.min.y+length*.3)-y)/(length*.3)),left=Math.max(0,((box.min.x+width*.3)-x)/(width*.3)),right=Math.max(0,(x-(box.max.x-width*.3))/(width*.3));
    y-=d.front*front*front*.65;y+=d.rear*rear*rear*.62;x+=d.left*left*left*.38;x-=d.right*right*right*.38;const crush=Math.max(d.front*front,d.rear*rear,d.left*left,d.right*right);z+=crush*(Math.sin(original[i]*19+original[i+1]*14)*.06-.035);a[i]=x;a[i+1]=y;a[i+2]=z;
   }body.geometry.attributes.position.needsUpdate=true;body.geometry.computeVertexNormals();body.geometry.computeBoundingSphere();body.material.roughness=.3+d.structure*.5;cracks.visible=d.front>.3;
  }
  if(d.exploded&&!wasExploded)burstStart=state.elapsed;wasExploded=d.exploded;
  const smoking=d.engine>.3||d.structure>.45,burn=d.exploded,age=state.elapsed-burstStart;group.visible=smoking||burn;
  smoke.forEach((p,i)=>{const t=(state.elapsed*.45+i/14)%1;p.position.set(Math.sin(i*7)*(.15+t*.7),.8+t*3.5,engineZ+Math.cos(i*3)*t*.6);p.scale.setScalar(.3+t*2);p.material.opacity=smoking?(1-t)*Math.min(.4,d.engine*.35):0;});
  fire.forEach((p,i)=>{const t=(state.elapsed*1.7+i/9)%1,burst=age<.7?1-age/.7:0;p.position.set(Math.sin(i*5)*(.3+burst*1.6),.55+t*(.7+burst*2),engineZ+Math.cos(i*5)*(.25+burst));p.scale.setScalar((.35+t*.8+burst*2)*(1-t*.5));p.material.opacity=burn?(1-t)*.72:0;});flash.intensity=burn?3+Math.sin(state.elapsed*23)*.8+(age<.5?20*(1-age/.5):0):0;
 };
}
