const socket = io();
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const healthFill = document.getElementById("healthFill");
const manaFill = document.getElementById("manaFill");
const hotbar = document.getElementById("hotbar");
const minimap = document.getElementById("minimap");
const mmCtx = minimap.getContext("2d");

canvas.width = innerWidth;
canvas.height = innerHeight;
minimap.width = 150; minimap.height = 150;

const TILE = 64;
const WORLD_SIZE = 40*TILE;

let state = { players:{}, spells:[], crates:[] };
let spellType = "fire";
const keys = {};
const particles = [];
let camX=0, camY=0;

window.addEventListener("keydown", e=>{
  keys[e.key]=true;
});
window.addEventListener("keyup", e=>keys[e.key]=false);

canvas.addEventListener("click", e=>{
  const me=state.players[socket.id]; if(!me) return;
  const rect=canvas.getBoundingClientRect();
  const mx=e.clientX-rect.left-camX;
  const my=e.clientY-rect.top-camY;
  const angle=Math.atan2(my-me.y, mx-me.x);
  socket.emit("cast",{angle,type:spellType});
});

window.addEventListener("wheel", e=>{
  const me = state.players[socket.id]; if(!me) return;
  if(me.abilities.length <= 1) return;
  let idx = me.abilities.indexOf(spellType);
  if(e.deltaY<0) idx = (idx+me.abilities.length-1)%me.abilities.length;
  else idx = (idx+1)%me.abilities.length;
  spellType = me.abilities[idx];
});

hotbar.addEventListener("click", e=>{
  const me = state.players[socket.id]; if(!me) return;
  const slots = [...hotbar.children];
  const rect = hotbar.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const slotWidth = rect.width / slots.length;
  const index = Math.floor(x/slotWidth);
  if(index < me.abilities.length){
    spellType = me.abilities[index];
  }
});

socket.on("state", s=>state=s);

function update(){
  socket.emit("move",{w:keys.w,a:keys.a,s:keys.s,d:keys.d});
}

function spawnParticles(spell){
  const colors={
    fire:["#ff4500","#ff8c00","#ffaa00"],
    ice:["#aeefff","#dfffff"],
    lightning:["#fff700","#ffd700"],
    dark:["#800080","#4b0082","#000"],
    light:["#ffffff","#f0f8ff"],
    poison:["#00ff00","#008000","#66ff66"],
    healing:["#ff00ff","#00ffff","#ffff00","#ff8800"]
  };
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
  camX+=(canvas.width/2-me.x-camX)*0.15;
  camY+=(canvas.height/2-me.y-camY)*0.15;
  drawGrid();

  // Players
  for(const id in state.players){
    const p=state.players[id];
    ctx.fillStyle=id===socket.id?"cyan":"red";
    ctx.beginPath();
    ctx.arc(p.x+camX,p.y+camY,16,0,Math.PI*2); ctx.fill();

    const barWidth=32, hpPct=p.hp/100;
    ctx.fillStyle="#400"; ctx.fillRect(p.x+camX-barWidth/2,p.y+camY-28,barWidth,5);
    ctx.fillStyle="#f00"; ctx.fillRect(p.x+camX-barWidth/2,p.y+camY-28,barWidth*hpPct,5);
  }

  // Spells
  for(const s of state.spells){
    spawnParticles(s);
    if(s.type==="fire"){ctx.fillStyle="orange";ctx.beginPath();ctx.arc(s.x+camX,s.y+camY,8,0,Math.PI*2);ctx.fill();}
    if(s.type==="ice"){ctx.fillStyle="#bff";ctx.beginPath();ctx.arc(s.x+camX,s.y+camY,10,0,Math.PI*2);ctx.fill();}
    if(s.type==="lightning"){ctx.strokeStyle="#ff0";ctx.beginPath();ctx.moveTo(s.x+camX,s.y+camY);ctx.lineTo(s.x+camX-s.vx*2,s.y+camY-s.vy*2);ctx.stroke();}
    if(s.type==="dark"){ctx.fillStyle="#800080";ctx.beginPath();ctx.arc(s.x+camX,s.y+camY,12,0,Math.PI*2);ctx.fill();}
    if(s.type==="light"){ctx.fillStyle="#fff";ctx.fillRect(s.x+camX-2,s.y+camY-2,4,4);}
    if(s.type==="poison"){ctx.fillStyle="#0f0";ctx.beginPath();ctx.arc(s.x+camX,s.y+camY,10,0,Math.PI*2);ctx.fill();}
  }

  // Particles
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i]; p.x+=p.vx; p.y+=p.vy; p.life--;
    ctx.fillStyle=p.color; ctx.globalAlpha=p.life/30; ctx.fillRect(p.x+camX,p.y+camY,3,3); ctx.globalAlpha=1;
    if(p.life<=0) particles.splice(i,1);
  }

  // Crates
  for(const c of state.crates){
    ctx.font="28px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
    let emoji = "📦";
    if(c.ability==="ice") emoji="❄️";
    if(c.ability==="lightning") emoji="⚡";
    if(c.ability==="dark") emoji="🌌";
    if(c.ability==="light") emoji="✨";
    if(c.ability==="poison") emoji="☠️";
    if(c.ability==="healing") emoji="🌈";
    ctx.fillText(emoji, c.x+camX, c.y+camY);
  }

  // UI
  healthFill.style.width=`${me.hp}%`;
  manaFill.style.width=`${me.mana}%`;

  // Hotbar
  hotbar.innerHTML="";
  me.abilities.forEach(a=>{
    let emoji="🔥";
    if(a==="ice") emoji="❄️";
    if(a==="lightning") emoji="⚡";
    if(a==="dark") emoji="🌌";
    if(a==="light") emoji="✨";
    if(a==="poison") emoji="☠️";
    if(a==="healing") emoji="🌈";
    const div=document.createElement("div");
    div.classList.add("slot");
    if(a===spellType) div.classList.add("selected");
    div.textContent=emoji;
    hotbar.appendChild(div);
  });

  // Minimap
  mmCtx.clearRect(0,0,150,150);
  const mmScale=150/WORLD_SIZE;
  for(const id in state.players){
    const p=state.players[id];
    mmCtx.fillStyle=id===socket.id?"cyan":"red";
    mmCtx.fillRect(p.x*mmScale,p.y*mmScale,4,4);
  }
  for(const c of state.crates){
    mmCtx.fillStyle="gold";
    mmCtx.fillRect(c.x*mmScale,c.y*mmScale,4,4);
  }
}

function loop(){update(); draw(); requestAnimationFrame(loop);}
loop();
