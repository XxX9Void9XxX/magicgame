const socket = io();
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const healthFill = document.getElementById("healthFill");
const manaFill = document.getElementById("manaFill");
const slots = document.querySelectorAll(".slot");
const minimap = document.getElementById("minimap");
const mmCtx = minimap.getContext("2d");

canvas.width = innerWidth;
canvas.height = innerHeight;
minimap.width = 150; minimap.height = 150;

const TILE = 64;
const WORLD_SIZE = 40*TILE;

let state = { players:{}, spells:[] };
let spellType = "fire";
const keys = {};
const particles = [];
let camX=0, camY=0;

window.addEventListener("keydown", e=>{
  keys[e.key]=true;
  if(e.key==="1") selectSpell("fire",0);
  if(e.key==="2") selectSpell("ice",1);
  if(e.key==="3") selectSpell("lightning",2);
});
window.addEventListener("keyup", e=>keys[e.key]=false);

function selectSpell(type,index){
  spellType=type;
  slots.forEach(s=>s.classList.remove("selected"));
  slots[index].classList.add("selected");
}

canvas.addEventListener("click", e=>{
  const me=state.players[socket.id]; if(!me) return;
  const rect=canvas.getBoundingClientRect();
  const mx=e.clientX-rect.left-camX;
  const my=e.clientY-rect.top-camY;
  const angle=Math.atan2(my-me.y, mx-me.x);
  socket.emit("cast",{angle,type:spellType});
});

socket.on("state", s=>state=s);

function update(){
  socket.emit("move",{w:keys.w,a:keys.a,s:keys.s,d:keys.d});
}

function spawnParticles(spell){
  const colors={fire:["#ff4500","#ff8c00","#ffaa00"],ice:["#aeefff","#dfffff"],lightning:["#fff700","#ffd700"]};
  for(let i=0;i<3;i++){
    particles.push({x:spell.x,y:spell.y,vx:(Math.random()-0.5)*2,vy:(Math.random()-0.5)*2,life:30,color:colors[spell.type][Math.floor(Math.random()*colors[spell.type].length)]});
  }
}

function drawGrid(){
  ctx.strokeStyle="#222";
  for(let x=0;x<=WORLD_SIZE;x+=TILE) ctx.strokeRect(x+camX,camY,TILE,WORLD_SIZE);
  for(let y=0;y<=WORLD_SIZE;y+=TILE) ctx.strokeRect(camX,y+camY,WORLD_SIZE,TILE);
}

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const me=state.players[socket.id]; if(!me) return;
  camX+=(c
