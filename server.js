import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static("public"));

const TILE = 64;
const WORLD_SIZE = 40; // 40x40 tiles

const players = {};
const spells = [];

io.on("connection", socket => {
  players[socket.id] = {
    id: socket.id,
    tx: Math.floor(Math.random() * WORLD_SIZE),
    ty: Math.floor(Math.random() * WORLD_SIZE),
    hp: 100,
    mana: 100,
    level: 1,
    xp: 0,
    slow: 0
  };

  socket.on("move", dir => {
    const p = players[socket.id];
    if (!p) return;

    if (p.slow > 0) return;

    if (dir.w) p.ty--;
    if (dir.s) p.ty++;
    if (dir.a) p.tx--;
    if (dir.d) p.tx++;

    p.tx = Math.max(0, Math.min(WORLD_SIZE-1, p.tx));
    p.ty = Math.max(0, Math.min(WORLD_SIZE-1, p.ty));
  });

  socket.on("cast", data => {
    const p = players[socket.id];
    if (!p) return;

    const spellData = {
      fire: { cost:20, speed:8, dmg:20 },
      ice: { cost:25, speed:6, dmg:15, slow:60 },
      lightning: { cost:35, speed:14, dmg:40 }
    };

    const s = spellData[data.type];
    if (!s || p.mana < s.cost) return;
    p.mana -= s.cost;

    spells.push({
      owner: socket.id,
      type: data.type,
      x: p.tx * TILE + TILE/2,
      y: p.ty * TILE + TILE/2,
      vx: Math.cos(data.angle) * s.speed,
      vy: Math.sin(data.angle) * s.speed,
      damage: s.dmg + p.level * 4,
      slow: s.slow || 0
    });
  });

  socket.on("disconnect", () => delete players[socket.id]);
});

setInterval(() => {
  // mana regen
  for (const id in players) {
    const p = players[id];
    p.mana = Math.min(100, p.mana + 0.16);
    if (p.slow > 0) p.slow--;
  }

  // spells
  for (let i = spells.length-1; i >= 0; i--) {
    const s = spells[i];
    s.x += s.vx;
    s.y += s.vy;

    for (const id in players) {
      if (id === s.owner) continue;
      const p = players[id];
      const px = p.tx * TILE + TILE/2;
      const py = p.ty * TILE + TILE/2;

      if (Math.hypot(px - s.x, py - s.y) < 20) {
        p.hp -= s.damage;
        if (s.slow) p.slow = s.slow;

        if (p.hp <= 0) {
          const killer = players[s.owner];
          killer.xp += 50;
          killer.level = 1 + Math.floor(killer.xp / 200);

          p.hp = 100;
          p.tx = Math.floor(Math.random() * WORLD_SIZE);
          p.ty = Math.floor(Math.random() * WORLD_SIZE);
        }

        spells.splice(i,1);
        break;
      }
    }
  }

  io.emit("state", { players, spells });
}, 1000/60);

httpServer.listen(process.env.PORT || 3000);
