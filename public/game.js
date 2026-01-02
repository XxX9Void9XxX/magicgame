const socket = io();
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

canvas.width = innerWidth;
canvas.height = innerHeight;

const TILE = 64;
let WORLD_SIZE = 40 * 1.5 * TILE;

let state = { players:{}, spells:[], crates:[] };
let camX = 0, camY = 0;
const keys = {};
const particles = [];
let currentSpell = "fire";

window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);

canvas.addEventListener("click", e => {
  const me = state.players[socket.id];
  if (!me) return;

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left - camX;
  const my = e.clientY - rect.top - camY;
  const angle = Math.atan2(my - me.y, mx - me.x);

  socket.emit("cast", { angle, type: currentSpell });
});

window.addEventListener("wheel", e => {
  const me = state.players[socket.id];
  if (!me) return;
  const list = me.abilities;
  let i = list.indexOf(currentSpell);
  i = e.deltaY > 0 ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
  currentSpell = list[i];
});

socket.on("state", s => state = s);

function spawnParticle(x, y, vx, vy, size, life, color, alpha=1) {
  particles.push({ x, y, vx, vy, size, life, color, alpha });
}

/* ---------------- SPELL VISUALS ---------------- */

function spellVisual(s) {
  const x = s.x, y = s.y;

  switch (s.type) {

    case "fire":
      for (let i=0;i<5;i++)
        spawnParticle(x,y,(Math.random()-0.5)*2,(Math.random()-0.5)*2,6,30,
          ["#ff4500","#ff8c00","#ffaa00"][Math.random()*3|0]);
      break;

    case "ice":
      for (let i=0;i<4;i++)
        spawnParticle(x,y,(Math.random()-0.5)*1.5,(Math.random()-0.5)*1.5,7,40,"#bfffff");
      break;

    case "lightning":
      ctx.strokeStyle="#ffff33";
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(x+camX,y+camY);
      ctx.lineTo(x+camX-s.vx*2,y+camY-s.vy*2);
      ctx.stroke();
      break;

    case "wind": // CLOUD BLAST
      for (let i=0;i<6;i++)
        spawnParticle(x,y,Math.random()*2,(Math.random()-0.5),12,50,"#e0ffff",0.6);
      break;

    case "poison": // GREEN CLOUD
      for (let i=0;i<6;i++)
        spawnParticle(x,y,(Math.random()-0.5),(Math.random()-0.5),14,60,"#33ff33",0.7);
      break;

    case "dark": // SHADOW SWIRL
      for (let i=0;i<5;i++)
        spawnParticle(x,y,(Math.random()-0.5)*1.2,(Math.random()-0.5)*1.2,10,55,
          ["#2b0033","#4b0082","#000"][Math.random()*3|0],0.8);
      break;

    case "light": // SPARKLING THREAD
      spawnParticle(x,y,0,0,4,20,"#ffffff");
      spawnParticle(x,y,(Math.random()-0.5),(Math.random()-0.5),3,15,"#ffffcc");
      break;

    case "water": // WATER SPLASH
      for (let i=0;i<4;i++)
        spawnParticle(x,y,(Math.random()-0.5)*2,(Math.random()-0.5)*2,6,35,"#00bfff",0.8);
      break;

    case "lava": // HEAVY SPARK BURST
      for (let i=0;i<7;i++)
        spawnParticle(x,y,(Math.random()-0.5)*3,(Math.random()-0.5)*3,7,30,
          ["#ff3300","#ff6600","#ffaa00"][Math.random()*3|0]);
      break;

    case "healing": // RAINBOW SPARKS
      spawnParticle(x,y,(Math.random()-0.5),(Math.random()-0.5),6,40,
        ["#ff00ff","#00ffff","#ffff00","#00ff00"][Math.random()*4|0]);
      break;
  }
}

/* ---------------- DRAW ---------------- */

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  const me = state.players[socket.id];
  if (!me) return;

  camX += (canvas.width/2 - me.x - camX) * 0.15;
  camY += (canvas.height/2 - me.y - camY) * 0.15;

  // Grid
  ctx.strokeStyle="#222";
  for (let x=0;x<WORLD_SIZE;x+=TILE){
    ctx.beginPath(); ctx.moveTo(x+camX,camY); ctx.lineTo(x+camX,camY+WORLD_SIZE); ctx.stroke();
  }
  for (let y=0;y<WORLD_SIZE;y+=TILE){
    ctx.beginPath(); ctx.moveTo(camX,y+camY); ctx.lineTo(camX+WORLD_SIZE,y+camY); ctx.stroke();
  }

  // Map border
  ctx.strokeStyle="white";
  ctx.lineWidth=3;
  ctx.strokeRect(camX,camY,WORLD_SIZE,WORLD_SIZE);

  // Players
  for (const id in state.players) {
    const p = state.players[id];
    ctx.fillStyle = id===socket.id ? "cyan":"red";
    ctx.beginPath();
    ctx.arc(p.x+camX,p.y+camY,16,0,Math.PI*2);
    ctx.fill();

    ctx.fillStyle="#400";
    ctx.fillRect(p.x+camX-16,p.y+camY-28,32,5);
    ctx.fillStyle="#f00";
    ctx.fillRect(p.x+camX-16,p.y+camY-28,32*(p.hp/100),5);
  }

  // Spells
  for (const s of state.spells) {
    spellVisual(s);
  }

  // Particles
  for (let i=particles.length-1;i>=0;i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    ctx.globalAlpha = p.alpha * (p.life/60);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x+camX,p.y+camY,p.size,0,Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (p.life <= 0) particles.splice(i,1);
  }

  requestAnimationFrame(draw);
}

function update() {
  socket.emit("move",{w:keys.w,a:keys.a,s:keys.s,d:keys.d});
  requestAnimationFrame(update);
}

update();
draw();
