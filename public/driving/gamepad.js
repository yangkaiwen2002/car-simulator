// Standard-mapping gamepad: analog triggers and stick, with button edge detection.
const DEADZONE=.12;
export function shapeAxis(value,deadzone=DEADZONE,curve=1.7){
 const size=Math.abs(value||0);if(size<=deadzone)return 0;
 return Math.sign(value)*Math.min(1,(size-deadzone)/(1-deadzone))**curve;
}
// Button indices follow the W3C "standard" layout.
const BUTTONS={handbrake:0,shiftUp:1,shiftDown:2,rewind:3,lookBack:4,camera:5,pause:9,reset:8};
export function createGamepad(getPads=()=>globalThis.navigator?.getGamepads?.()||[]){
 const held={};let lastActive=-Infinity,current=null;
 return {
  get connected(){return !!current;},
  rumble(strong,weak,duration=120){try{current?.vibrationActuator?.playEffect?.('dual-rumble',{duration,strongMagnitude:Math.min(1,strong),weakMagnitude:Math.min(1,weak)});}catch{}},
  // Returns null without a pad. `active` is true while the player is using it.
  poll(now=0){
   let pad=null;for(const candidate of getPads()){if(candidate?.connected&&(!pad||candidate.mapping==='standard')){pad=candidate;if(candidate.mapping==='standard')break;}}
   current=pad;if(!pad)return null;
   const value=i=>pad.buttons[i]?.value||0,down=i=>!!pad.buttons[i]?.pressed;
   const edges={};for(const [name,index] of Object.entries(BUTTONS)){const pressed=down(index);edges[name]=pressed&&!held[name];held[name]=pressed;}
   const steer=-shapeAxis(pad.axes[0])+(down(14)?1:0)-(down(15)?1:0);
   const input={throttle:value(7),brake:value(6),steer:Math.max(-1,Math.min(1,steer)),handbrake:down(0),rewind:down(3),lookBack:down(4),lookX:-shapeAxis(pad.axes[2],.18,1.2),lookY:-shapeAxis(pad.axes[3],.18,1.2),edges};
   if(input.throttle>.05||input.brake>.05||Math.abs(input.steer)>.05||input.handbrake||Object.values(edges).some(Boolean))lastActive=now;
   input.active=now-lastActive<4;return input;
  },
 };
}
