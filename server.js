import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
app.use(express.static("public"));

const TILE = 64;
const WORLD_SIZE = 40 * 1.5 * TILE;

const SPELL_COST = {
  fire: 10,
  ice: 12,
  lightning: 18,
  dark: 15,
  light: 15,
  poison: 12,
  healing: 14,
  water: 14,
  lava: 25,
  wind: 10
};

const ALL_ABILITIES = Object.keys(SPELL_COST);

let players = {};
let spells = [];
let crates = [];

/* ------------------ HELPERS ------------------ */
function randomPos() {
  return {
    x: Math.random() * (WORLD_SIZE - 100) + 50,
    y: Math.random() * (WORLD_SIZE - 100) + 50
  };
}

/* ------------------ CRATES ------------------ */
function spawnCrates() {
  if (crates.length > Object.keys(players).length * 1.5) return;
  const ability = ALL_ABILITIES.filter(a => a !== "fire")[Math.floor(Math.random() * (ALL_ABILITIES.length - 1))];
  crates.push({ ...randomPos(), ability });
}
setInterval(spawnCrates, 5000);

/* ------------------ SOCKET ------------------ */
io.on("connection", socket => {
  const id = socket.id;

  players[id] = {
    ...randomPos(),
    hp: 100,
    mana: 100,
    abilities: ["fire"],
    disableCast: 0,
    poisonUntil: 0,
    manaLockUntil: 0
  };

  socket.on("move", keys => {
    const p = players[id];
    if (!p) return;

    const speed = 6;
    let dx = 0, dy = 0;
    if (keys.w) dy -= speed;
    if (keys.s) dy += speed;
    if (keys.a) dx -= speed;
    if (keys.d) dx += speed;

    p.x = Math.max(0, Math.min(WORLD_SIZE, p.x + dx));
    p.y = Math.max(0, Math.min(WORLD_SIZE, p.y + dy));
  });

  socket.on("cast", ({ angle, type }) => {
    const p = players[id];
    if (!p) return;
    if (!p.abilities.includes(type)) return;
    if (Date.now() < p.disableCast) return;

    const cost = SPELL_COST[type];
    if (p.mana < cost) return;

    p.mana -= cost;

    const speed = 8;
    spells.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      type,
      owner: id
    });
  });

  socket.on("disconnect", () => {
    delete players[id];
  });
});

/* ------------------ SPELL LOGIC ------------------ */
function updateSpells() {
  for (let i = spells.length - 1; i >= 0; i--) {
    const s = spells[i];
    s.x += s.vx;
    s.y += s.vy;

    if (s.x < 0 || s.y < 0 || s.x > WORLD_SIZE || s.y > WORLD_SIZE) {
      spells.splice(i, 1);
      continue;
    }

    for (const pid in players) {
      if (pid === s.owner) continue;
      const p = players[pid];
      const dx = s.x - p.x;
      const dy = s.y - p.y;

      if (Math.hypot(dx, dy) < 20) {
        switch (s.type) {
          case "fire": p.hp -= 15; break;
          case "ice": p.hp -= 10; break;
          case "lightning": p.hp -= 20; break;
          case "dark": p.damageWeakUntil = Date.now() + 10000; break;
          case "light": p.manaLockUntil = Date.now() + 5000; break;
          case "poison": p.poisonUntil = Date.now() + 6000; break;
          case "healing":
            players[s.owner].hp = Math.min(100, players[s.owner].hp + 12);
            break;
          case "water": p.disableCast = Date.now() + 3000; break;
          case "lava": p.hp -= 30; break;
          case "wind":
            p.x += s.vx * 6;
            p.y += s.vy * 6;
            p.damageWeakUntil = Date.now() + 5000;
            break;
        }
        spells.splice(i, 1);
        break;
      }
    }
  }
}

/* ------------------ PLAYER EFFECTS ------------------ */
function updatePlayers() {
  const now = Date.now();

  for (const id in players) {
    const p = players[id];

    // Poison
    if (p.poisonUntil > now) p.hp -= 0.2;

    // Mana regen
    if (p.manaLockUntil < now) {
      p.mana = Math.min(100, p.mana + 0.15);
    }

    // Death
    if (p.hp <= 0) {
      p.abilities
        .filter(a => a !== "fire")
        .forEach(a => crates.push({ ...randomPos(), ability: a }));

      Object.assign(p, {
        ...randomPos(),
        hp: 100,
        mana: 100,
        abilities: ["fire"]
      });
    }
  }
}

/* ------------------ CRATE PICKUP ------------------ */
function updateCrates() {
  for (let i = crates.length - 1; i >= 0; i--) {
    const c = crates[i];
    for (const id in players) {
      const p = players[id];
      if (Math.hypot(c.x - p.x, c.y - p.y) < 30) {
        if (!p.abilities.includes(c.ability)) {
          p.abilities.push(c.ability);
          crates.splice(i, 1);
        }
        break;
      }
    }
  }
}

/* ------------------ GAME LOOP ------------------ */
setInterval(() => {
  updateSpells();
  updatePlayers();
  updateCrates();
  io.emit("state", { players, spells, crates });
}, 1000 / 60);

server.listen(PORT, () => console.log("✅ Server running on", PORT));
