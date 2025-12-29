import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;
app.use(express.static("public"));

const WORLD_SIZE = 40*1.5*64; // match client
const TILE = 64;
let players = {};
let spells = [];
let crates = [];

function randomPos(){ return {x:Math.random()*WORLD_SIZE, y:Math.random()*WORLD_SIZE}; }

function spawnCrates(){
  if(crates.length>=players.length*1.5) return; 
  crates.push({ ...randomPos(), ability:["ice","lightning","dark","light","poison","healing","water","lava","wind"][Math.floor(Math.random()*9)] });
}
setInterval(spawnCrates,5000);

io.on("connection", socket=>{
  const id = socket.id;
  players[id]={x:WORLD_SIZE/2,y:WORLD_SIZE/2,hp:100,mana:100,abilities:["fire"],vx:0,vy:0};
  console.log("Player connected",id);

  socket.on("move", data=>{
    const p = players[id]; if(!p) return;
    const speed=6;
    let dx=0, dy=0;
    if(data.w) dy-=speed;
    if(data.s) dy+=speed;
    if(data.a) dx-=speed;
    if(data.d) dx+=speed;
    p.x=Math.min(Math.max(p.x+dx,0),WORLD_SIZE);
    p.y=Math.min(Math.max(p.y+dy,0),WORLD_SIZE);
  });

  socket.on("cast", ({angle,type})=>{
    const p = players[id]; if(!p) return;
    if(!p.abilities.includes(type)) return;
    const speed=8;
    spells.push({x:p.x,y:p.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,type,owner:id});
  });

  socket.on("disconnect",()=>{ delete players[id]; });
});

// Spell hits and effects
function handleSpells(){
  for(let i=spells.length-1;i>=0;i--){
    const s=spells[i];
    s.x+=s.vx; s.y+=s.vy;
    if(s.x<0||s.y<0||s.x>WORLD_SIZE||s.y>WORLD_SIZE){spells.splice(i,1); continue;}
    for(const pid in players){
      if(pid===s.owner) continue;
      const p=players[pid];
      const dx=s.x-p.x, dy=s.y-p.y;
      if(Math.sqrt(dx*dx+dy*dy)<20){
        // Hit effects
        switch(s.type){
          case "fire": p.hp-=15; break;
          case "ice": p.hp-=10; break;
          case "lightning": p.hp-=20; break;
          case "dark": p.hp-=5; p.darkDebuff=Date.now()+10000; break;
          case "light": p.lightDebuff=Date.now()+5000; break;
          case "poison": p.poisonDebuff=Date.now()+5000; break;
          case "healing": players[s.owner].hp=Math.min(players[s.owner].hp+10,100); break;
          case "water": p.disableCast=Date.now()+3000; break;
          case "lava": p.hp-=30; break;
          case "wind": p.vx=(p.x-s.x>0?1:-1)*5; p.vy=(p.y-s.y>0?1:-1)*2; p.windDebuff=Date.now()+5000; break;
        }
        spells.splice(i,1); break;
      }
    }
  }
}

// Apply continuous effects
function applyDebuffs(){
  const now = Date.now();
  for(const id in players){
    const p=players[id];
    if(p.poisonDebuff && now<p.poisonDebuff) p.hp-=0.2;
    if(p.darkDebuff && now<p.darkDebuff) p.hp=p.hp; // future: reduce attack
    if(p.windDebuff && now<p.windDebuff) p.hp=p.hp; // future: reduce attack
    if(p.hp<=0){
      // Drop all non-fire abilities
      p.abilities=p.abilities.filter(a=>a==="fire");
      p.hp=100; p.x=WORLD_SIZE/2; p.y=WORLD_SIZE/2;
    }
  }
}

setInterval(()=>{
  handleSpells();
  applyDebuffs();
  io.emit("state",{players,spells,crates});
},1000/60);

server.listen(PORT,()=>console.log("Server running on port",PORT));
