import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static("public"));

const TILE = 64;
const WORLD_TILES = 40;
const WORLD_SIZE = WORLD_TILES * TILE;
const TICK = 1000 / 60;
const CRATE_RESPAWN = 10000; // 10 seconds

const players = {};
const spells = [];
const crates = [];

const crateAbilities = ["ice","lightning","dark","light","poison","healing"]; // Add new spells

// Spawn initial crates
for(let i = 0; i < 5; i++){
  crates.push({
    x: Math.random()*WORLD_SIZE,
    y: Math.random()*WORLD_SIZE,
    ability: crateAbilities[Math.floor(Math.random()*crateAbilities.length)]
  });
}

io.on("connection", socket => {
  players[socket.id] = {
    id: socket.id,
    x: Math.random()*WORLD_SIZE,
    y: Math.random()*WORLD_SIZE,
    vx: 0,
    vy: 0,
    hp: 100,
    mana: 100,
    level: 1,
    xp: 0,
    slow: 0,
    abilities: ["fire"]
  };

  socket.on("move", dir => {
    const p = players[socket.id];
    if(!p) return;
    const speed = p.slow>0?1.5:3;
    p.vx=0; p.vy=0;
    if(dir.w) p.vy-=speed;
    if(dir.s) p.vy+=speed;
    if(dir.a) p.vx-=speed;
    if(dir.d) p.vx+=speed;
  });

  socket.on("cast", data => {
    const p = players[socket.id];
    if(!p || !p.abilities.includes(data.type)) return;

    const defs = {
      fire: { cost: 20, speed: 9, dmg: 20 },
      ice: { cost: 25, speed: 6, dmg: 15, slow: 90 },
      lightning: { cost: 35, speed: 16, dmg: 40 },
      dark: { cost: 30, speed: 5, dmg: 5, debuff: {type:"weaken",duration:600} }, // 10s
      light: { cost: 30, speed: 5, dmg: 5, debuff: {type:"manaBlock",duration:300} }, // 5s
      poison: { cost: 25, speed: 4, dmg: 5, debuff: {type:"poison",duration:300} },
      healing: { cost: 20, speed: 0, heal: 20 } // instant heal on self
    };

    const def = defs[data.type];
    if(!def || p.mana < def.cost) return;

    p.mana -= def.cost;

    if(data.type==="healing"){
      p.hp = Math.min(100,p.hp + def.heal);
    } else {
      spells.push({
        owner: socket.id,
        type: data.type,
        x: p.x,
        y: p.y,
        vx: Math.cos(data.angle)*def.speed,
        vy: Math.sin(data.angle)*def.speed,
        damage: def.dmg + p.level*4,
        slow: def.slow || 0,
        debuff: def.debuff
      });
    }
  });

  socket.on("disconnect", () => delete players[socket.id]);
});

setInterval(()=>{
  for(const id in players){
    const p = players[id];
    p.x += p.vx; p.y += p.vy;
    p.x = Math.max(0, Math.min(WORLD_SIZE, p.x));
    p.y = Math.max(0, Math.min(WORLD_SIZE, p.y));
    p.mana = Math.min(100, p.mana+0.15);
    if(p.slow>0) p.slow--;
    if(!p.debuffs) p.debuffs = {};
    for(const d in p.debuffs){
      p.debuffs[d]--;
      if(p.debuffs[d]<=0) delete p.debuffs[d];
      if(d==="poison") p.hp -= 0.2; // continuous small poison damage
    }
  }

  // Spells & collisions
  for(let i=spells.length-1;i>=0;i--){
    const s = spells[i];
    s.x += s.vx; s.y += s.vy;

    for(const id in players){
      if(id===s.owner) continue;
      const p = players[id];
      if(Math.hypot(p.x-s.x,p.y-s.y)<18){
        p.hp -= s.damage;
        if(s.slow) p.slow = s.slow;
        if(s.debuff) p.debuffs[s.debuff.type] = s.debuff.duration;

        if(p.hp<=0){
          const killer = players[s.owner];
          killer.xp+=50;
          killer.level = 1+Math.floor(killer.xp/200);

          // Drop non-fire abilities as crates
          const dropAbilities = p.abilities.filter(a=>a!=="fire");
          for(const a of dropAbilities){
            crates.push({x: p.x, y: p.y, ability: a});
          }

          // Respawn player
          p.hp=100;
          p.mana=100;
          p.x=Math.random()*WORLD_SIZE;
          p.y=Math.random()*WORLD_SIZE;
          p.abilities = ["fire"];
        }
        spells.splice(i,1);
        break;
      }
    }
    if(s.x<-100||s.y<-100||s.x>WORLD_SIZE+100||s.y>WORLD_SIZE+100) spells.splice(i,1);
  }

  // Crates pickups (only if player doesn't already have ability)
  for(let i=crates.length-1;i>=0;i--){
    const c = crates[i];
    for(const id in players){
      const p = players[id];
      if(Math.hypot(p.x-c.x,p.y-c.y)<20){
        if(!p.abilities.includes(c.ability)){
          p.abilities.push(c.ability);
          crates.splice(i,1);
          setTimeout(()=>{
            crates.push({
              x: Math.random()*WORLD_SIZE,
              y: Math.random()*WORLD_SIZE,
              ability: crateAbilities[Math.floor(Math.random()*crateAbilities.length)]
            });
          }, CRATE_RESPAWN);
        }
        break;
      }
    }
  }

  io.emit("state",{players,spells,crates});
}, TICK);

httpServer.listen(process.env.PORT || 3000);
