import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public/index.html"))
);

const TILE = 64;
const MAP_TILES = Math.floor(40 * 1.5);
const WORLD_SIZE = MAP_TILES * TILE;

const players = {};
const spells = [];
const crates = [];

const ABILITIES = [
  "ice","wind","water","lava",
  "poison","dark","light","healing"
];

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function spawnPos() {
  return {
    x: rand(100, WORLD_SIZE - 100),
    y: rand(100, WORLD_SIZE - 100)
  };
}

/* spawn ability crates */
setInterval(() => {
  if (crates.length < 30) {
    crates.push({
      id: Math.random().toString(36).slice(2),
      ...spawnPos(),
      ability: ABILITIES[Math.floor(Math.random() * ABILITIES.length)]
    });
  }
}, 4000);

io.on("connection", socket => {
  players[socket.id] = {
    ...spawnPos(),
    vx: 0,
    vy: 0,
    hp: 100,
    mana: 100,
    abilities: ["fire"],
    selected: 0,
    poisonUntil: 0,
    manaLockUntil: 0,
    disableCastUntil: 0
  };

  socket.on("move", k => {
    const p = players[socket.id];
    if (!p) return;
    const s = 4;
    p.vx = (k.d - k.a) * s;
    p.vy = (k.s - k.w) * s;
  });

  socket.on("cast", ({ angle }) => {
    const p = players[socket.id];
    if (!p) return;
    if (p.disableCastUntil > Date.now()) return;
    if (p.mana < 15) return;

    const type = p.abilities[p.selected];
    if (!type) return;

    p.mana -= 15;

    spells.push({
      owner: socket.id,
      type,
      x: p.x,
      y: p.y,
      vx: Math.cos(angle) * 8,
      vy: Math.sin(angle) * 8,
      life: 90
    });
  });

  socket.on("select", i => {
    const p = players[socket.id];
    if (p && p.abilities[i] !== undefined) p.selected = i;
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
  });
});

/* GAME LOOP */
setInterval(() => {
  for (const id in players) {
    const p = players[id];

    p.x += p.vx;
    p.y += p.vy;

    p.x = Math.max(20, Math.min(WORLD_SIZE - 20, p.x));
    p.y = Math.max(20, Math.min(WORLD_SIZE - 20, p.y));

    if (p.manaLockUntil < Date.now())
      p.mana = Math.min(100, p.mana + 0.25);

    if (p.poisonUntil > Date.now()) p.hp -= 0.05;

    for (let i = crates.length - 1; i >= 0; i--) {
      const c = crates[i];
      if (Math.hypot(c.x - p.x, c.y - p.y) < 30) {
        if (!p.abilities.includes(c.ability))
          p.abilities.push(c.ability);
        crates.splice(i, 1);
      }
    }

    if (p.hp <= 0) {
      p.hp = 100;
      p.mana = 100;
      p.abilities = ["fire"];
      p.selected = 0;
      Object.assign(p, spawnPos());
    }
  }

  for (let i = spells.length - 1; i >= 0; i--) {
    const s = spells[i];
    s.x += s.vx;
    s.y += s.vy;
    s.life--;

    for (const id in players) {
      if (id === s.owner) continue;
      const p = players[id];
      if (Math.hypot(p.x - s.x, p.y - s.y) < 20) {
        if (s.type === "fire") p.hp -= 12;
        if (s.type === "ice") p.vx *= 0.4, p.vy *= 0.4;
        if (s.type === "wind") p.vx += s.vx * 0.4, p.vy += s.vy * 0.4;
        if (s.type === "water") p.disableCastUntil = Date.now() + 3000;
        if (s.type === "lava") p.hp -= 25;
        if (s.type === "poison") p.poisonUntil = Date.now() + 5000;
        if (s.type === "light") p.manaLockUntil = Date.now() + 5000;
        if (s.type === "healing" && players[s.owner])
          players[s.owner].hp = Math.min(100, players[s.owner].hp + 12);

        spells.splice(i, 1);
        break;
      }
    }
    if (s.life <= 0) spells.splice(i, 1);
  }

  io.emit("state", {
    players,
    spells,
    crates,
    WORLD_SIZE
  });
}, 1000 / 60);

server.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});
