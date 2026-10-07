import * as THREE from '../vendor/three.module.min.js';
// Supplemental controls: the licensed exterior model contains no steering wheel.
// Dimensions and placement are game approximations, not McLaren CAD data.
export function mcl39Cockpit(source,steering){
 steering.position.set(0,.38,.71);source.add(steering);
 const carbon=new THREE.MeshStandardMaterial({color:0x15191c,roughness:.72,metalness:.2});
 const rubber=new THREE.MeshStandardMaterial({color:0x202327,roughness:.95});
 const box=(w,d,h,x,y,z,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,d,h),mat);m.position.set(x,y,z);steering.add(m);return m;};
 box(.24,.035,.13,0,0,0,carbon);box(.31,.035,.035,0,0,-.055,carbon);
 for(const side of [-1,1]){const grip=new THREE.Mesh(new THREE.CapsuleGeometry(.026,.12,6,12),rubber);grip.rotation.x=Math.PI/2;grip.position.set(side*.15,0,0);steering.add(grip);
  box(.075,.01,.12,side*.11,.035,0,carbon);
 }
 const colors=[0xff8b12,0x46d5df,0xe6e85a,0xc93743];
 for(let i=0;i<8;i++){const m=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,.007,14),new THREE.MeshStandardMaterial({color:colors[i%4]}));m.position.set((i<4?-1:1)*(.08+(i%2)*.028),-.024,.038-Math.floor(i%4/2)*.04);steering.add(m);}
 for(const x of [-.06,0,.06]){const m=new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,.012,16),new THREE.MeshStandardMaterial({color:x===0?0xff8b12:0x8c979e}));m.position.set(x,-.028,-.039);steering.add(m);}
}
