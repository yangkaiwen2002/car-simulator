import * as THREE from '../vendor/three.module.min.js';

// Functional instrument faces adapted to the community mesh's blank dial areas.
// Layout follows the available geometry; artwork is original, not factory artwork.
export function addInstruments(source,car,specs){
 const locations=car.id==='MI'?[
  {p:[-.383315,.521,.161495],r:.044,max:8,unit:'RPM ×1000',read:s=>s.rpm/1000},
  {p:[-.279195,.521,.161495],r:.044,max:180,unit:'km/h',read:s=>Math.abs(s.speed)*3.6},
  {p:[-.17417,.521,.161495],r:.044,max:60,unit:'DRIVE · min',read:s=>s.elapsed/60},
  ...[-.04003,.01093,.063735].map((x,i)=>({p:[x,.525,.1969],r:.0205,max:i===0?specs.gears.length:i===1?10:10,unit:['GEAR','THR','BRK'][i],read:s=>i===0?s.gear:i===1?(s.throttle||0)*10:(s.brake||0)*10}))
 ]:car.id==='TC6'?[
  {p:[.285,.505,.146],r:.047,max:8,unit:'RPM ×1000',read:s=>s.rpm/1000},
  {p:[.393,.505,.151],r:.054,max:240,unit:'km/h',read:s=>Math.abs(s.speed)*3.6},
  {p:[.498,.505,.132],r:.028,max:specs.gears.length,unit:'GEAR',read:s=>s.gear}
 ]:[];
 const needles=[];
 for(const d of locations){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');
  c.fillStyle='#101714';c.beginPath();c.arc(128,128,126,0,Math.PI*2);c.fill();c.strokeStyle='#8d9b8f';c.lineWidth=4;c.stroke();
  c.textAlign='center';c.textBaseline='middle';
  for(let i=0;i<=40;i++){const a=(-225+i/40*270)*Math.PI/180,major=i%5===0;c.strokeStyle=i>33&&d.unit.startsWith('RPM')?'#d47558':'#d6ddc8';c.lineWidth=major?2.5:1;c.beginPath();c.moveTo(128+Math.cos(a)*105,128+Math.sin(a)*105);c.lineTo(128+Math.cos(a)*(major?87:97),128+Math.sin(a)*(major?87:97));c.stroke();if(major){c.font='19px sans-serif';c.fillStyle='#dce3d2';c.fillText(String(Math.round(i/40*d.max)),128+Math.cos(a)*69,128+Math.sin(a)*69);}}
  c.fillStyle='#abb9a9';c.font='14px sans-serif';c.fillText(d.unit,128,167);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const group=new THREE.Group();group.position.fromArray(d.p);group.rotation.x=Math.PI/2;source.add(group);
  group.add(new THREE.Mesh(new THREE.CircleGeometry(d.r,48),new THREE.MeshBasicMaterial({map:texture})));
  const pivot=new THREE.Group();pivot.position.z=.001;group.add(pivot);
  const needle=new THREE.Mesh(new THREE.BoxGeometry(d.r*.015,d.r*.69,.001),new THREE.MeshBasicMaterial({color:'#e39d69'}));needle.position.y=d.r*.26;pivot.add(needle);
  const cap=new THREE.Mesh(new THREE.CircleGeometry(d.r*.085,16),new THREE.MeshBasicMaterial({color:'#c7c9b2'}));cap.position.z=.0018;group.add(cap);needles.push({pivot,read:d.read,max:d.max});
 }
 return state=>{for(const d of needles)d.pivot.rotation.z=(135-Math.min(d.max,Math.max(0,d.read(state)))/d.max*270)*Math.PI/180;};
}
