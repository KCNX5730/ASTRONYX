import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ed8ff);
scene.fog = new THREE.Fog(0x9ed8ff, 25, 90);

const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, .1, 200);
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Lights
scene.add(new THREE.HemisphereLight(0xffffff,0x668866,2.2));
const sun=new THREE.DirectionalLight(0xffffff,2.8);
sun.position.set(15,25,10); sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
scene.add(sun);

// Ground
const ground=new THREE.Mesh(
 new THREE.PlaneGeometry(160,160),
 new THREE.MeshStandardMaterial({color:0x4e8b4a,roughness:1})
);
ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);

// Simple environment
const roadMat=new THREE.MeshStandardMaterial({color:0x555555});
const road=new THREE.Mesh(new THREE.BoxGeometry(10,.04,160),roadMat);
road.position.y=.02; scene.add(road);
const lineMat=new THREE.MeshBasicMaterial({color:0xffffff});
for(let z=-75;z<80;z+=6){
 const line=new THREE.Mesh(new THREE.BoxGeometry(.25,.05,3),lineMat);
 line.position.set(0,.06,z); scene.add(line);
}
function building(x,z,w,h,d){
 const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color:0xb7b0a4}));
 b.position.set(x,h/2,z); b.castShadow=b.receiveShadow=true; scene.add(b);
}
building(-12,-12,8,9,8); building(13,-25,10,13,9); building(-14,18,9,7,10); building(14,18,7,11,7);

let player, model, mixer;
const clock=new THREE.Clock();
const velocity=new THREE.Vector3();
let grounded=true, yaw=0, pitch=-0.12;
const move={x:0,y:0};
const speed=5.2, gravity=18, jumpPower=7.5;

// Load supplied character
new GLTFLoader().load("./assets/Teacher_Joe_03.glb", gltf=>{
 model=gltf.scene;
 model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
 // Put the model into a player root so movement/rotation is predictable.
 player=new THREE.Group(); player.add(model); player.position.set(0,0,10);
 // Many character GLBs are authored with feet around y=0; this keeps it grounded.
 model.position.y=0;
 scene.add(player);
 document.getElementById("loading").style.display="none";
}, undefined, err=>{
 console.error(err);
 document.getElementById("loading").textContent="Could not load the 3D model.";
});

function jump(){
 if(player && grounded){ velocity.y=jumpPower; grounded=false; }
}
document.getElementById("jump").addEventListener("pointerdown",e=>{e.preventDefault();jump()});

// Virtual joystick
const joy=document.getElementById("joystick"), stick=document.getElementById("stick");
let joyId=null;
function joyUpdate(e){
 const r=joy.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2;
 let dx=e.clientX-cx, dy=e.clientY-cy, max=48;
 const len=Math.hypot(dx,dy); if(len>max){dx=dx/len*max;dy=dy/len*max}
 stick.style.transform=`translate(${dx}px,${dy}px)`;
 move.x=dx/max; move.y=dy/max;
}
joy.addEventListener("pointerdown",e=>{joyId=e.pointerId;joy.setPointerCapture(joyId);joyUpdate(e)});
joy.addEventListener("pointermove",e=>{if(e.pointerId===joyId)joyUpdate(e)});
function joyEnd(e){if(e.pointerId===joyId){joyId=null;move.x=move.y=0;stick.style.transform="translate(0,0)"}}
joy.addEventListener("pointerup",joyEnd); joy.addEventListener("pointercancel",joyEnd);

// Touch/mouse look: swipe anywhere on right side
const look=document.getElementById("lookZone");
let lookId=null,lastX=0,lastY=0;
look.addEventListener("pointerdown",e=>{lookId=e.pointerId;lastX=e.clientX;lastY=e.clientY;look.setPointerCapture(lookId)});
look.addEventListener("pointermove",e=>{
 if(e.pointerId!==lookId)return;
 const dx=e.clientX-lastX, dy=e.clientY-lastY; lastX=e.clientX;lastY=e.clientY;
 yaw-=dx*.008; pitch-=dy*.006; pitch=Math.max(-1.05,Math.min(.55,pitch));
});
look.addEventListener("pointerup",e=>{if(e.pointerId===lookId)lookId=null});
look.addEventListener("pointercancel",e=>{if(e.pointerId===lookId)lookId=null});

// Desktop keyboard support
const keys={};
addEventListener("keydown",e=>{keys[e.code]=true;if(e.code==="Space")jump()});
addEventListener("keyup",e=>keys[e.code]=false);

const camTarget=new THREE.Vector3();
const desiredCam=new THREE.Vector3();

function animate(){
 requestAnimationFrame(animate);
 const dt=Math.min(clock.getDelta(),.05);
 if(!player){renderer.render(scene,camera);return}

 // Combine joystick + keyboard
 let mx=move.x, my=move.y;
 if(keys.KeyA)mx-=1;if(keys.KeyD)mx+=1;if(keys.KeyW)my-=1;if(keys.KeyS)my+=1;
 const mag=Math.hypot(mx,my); if(mag>1){mx/=mag;my/=mag}

 // Camera-relative movement
 const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
 const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
 const dir=new THREE.Vector3().addScaledVector(right,mx).addScaledVector(forward,-my);
 if(dir.lengthSq()>.001){
   dir.normalize();
   player.position.addScaledVector(dir,speed*dt);
   // Character faces the direction of travel
   const target=Math.atan2(dir.x,dir.z);
   player.rotation.y=THREE.MathUtils.lerp(player.rotation.y,target,.18);
 }

 // Gravity / jump
 velocity.y-=gravity*dt;
 player.position.y+=velocity.y*dt;
 if(player.position.y<=0){player.position.y=0;velocity.y=0;grounded=true}

 // Keep player in the playable area
 player.position.x=THREE.MathUtils.clamp(player.position.x,-70,70);
 player.position.z=THREE.MathUtils.clamp(player.position.z,-70,70);

 // Third-person camera follows player; finger swipe controls yaw/pitch
 camTarget.copy(player.position); camTarget.y+=1.65;
 const radius=6;
 desiredCam.set(
   camTarget.x + Math.sin(yaw)*Math.cos(pitch)*radius,
   camTarget.y + Math.sin(pitch)*radius,
   camTarget.z + Math.cos(yaw)*Math.cos(pitch)*radius
 );
 camera.position.lerp(desiredCam,1-Math.pow(.001,dt));
 camera.lookAt(camTarget);

 renderer.render(scene,camera);
}
animate();

addEventListener("resize",()=>{
 camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
 renderer.setSize(innerWidth,innerHeight);
});
