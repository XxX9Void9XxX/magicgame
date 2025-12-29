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

const players = {};
const spells = [];

io.on("connection", socket => {
  players[socket.id] = {
    id: socket.id,
    x: Math.random() * WORLD_SIZE,
    y: Math.random() * WORLD_SIZE,
    vx: 0,
    vy: 0,
    hp: 100,
    mana: 100,
    level: 1,
    xp: 0,
    slow: 0
  };

  socket.on("move", dir => {
    const p = players[socket.id];
    if (!p) return;

    const speed = p.slow > 0 ? 1.5 : 3;
    p.vx = 0;
    p.vy = 0;

    if (dir.w) p.vy -= speed;
    if (dir.s) p.vy += speed;
    if (dir.a) p.vx -= speed;
    if (dir.d) p.vx += speed;
  });

  socket.on("cast", data => {
    const p = players[socket.id];
    if (!p) return;

    const defs = {
      fire: { cost: 20, speed: 9, dmg: 20 },
      ice: { cost: 25, speed: 6, dmg: 15, slow: 90 },
      lightning: { cost: 35, speed: 16, dmg: 40 }
    };

    const def = defs[data.type];
    if (!def || p.mana < def.cost) return;

    p.mana -= def.cost;

    spells.push({
      owner: socket.id,
      type: data.type,
      x: p.x,
      y: p.y,
      vx: Math.cos(data.angle) * def.speed,
      vy: Math.sin(data.angle) * def.speed,
      damage: def.dmg + p.level * 4,
      slow: def.slow || 0
    });
  });

  socket.on("disconnect", () => delete players[socket.id]);
});

setInterval(() => {
  for (const id in players) {
    const p = players[id];
    p.x += p.vx;
    p.y += p.vy;
    p.x = Math.max(0, Math.min(WORLD_SIZE, p.x));
    p.y = Math.max(0, Math.min(WORLD_SIZE, p.y));
    p.mana = Math.min(100, p.mana + 0.15);
    if (p.slow > 0) p.slow--;
  }

  for (let i = spells.length - 1; i >= 0; i--) {
    const s = spells[i];
    s.x += s.vx;
    s.y += s.vy;

    for (const id in players) {
      if (id === s.owner) continue;
      const p = players[id];

      if (Math.hypot(p.x - s.x, p.y - s.y) < 18) {
        p.hp -= s.damage;
        if (s.slow) p.slow = s.slow;

        if (p.hp <= 0) {
          const killer = players[s.owner];
          killer.xp += 50;
          killer.level = 1 + Math.floor(killer.xp / 200);
          p.hp = 100;
          p.x = Math.random() * WORLD_SIZE;
          p.y = Math.random() * WORLD_SIZE;
        }

        spells.splice(i, 1);
        break;
      }
    }
