import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static("public"));

const players = {};
const spells = [];

io.on("connection", socket => {
  players[socket.id] = {
    id: socket.id,
    x: Math.random() * 2000,
    y: Math.random() * 2000,
    hp: 100,
    mana: 100,
    level: 1,
    xp: 0
  };

  socket.on("move", dir => {
    const p = players[socket.id];
    if (!p) return;
    const speed = 4 + p.level * 0.3;
    if (dir.w) p.y -= speed;
    if (dir.s) p.y += speed;
    if (dir.a) p.x -= speed;
    if (dir.d) p.x += speed;
  });

  socket.on("cast", data => {
    const p = players[socket.id];
    if (!p || p.mana < 20) return;
    p.mana -= 20;

    spells.push({
      owner: socket.id,
      x: p.x,
      y: p.y,
      vx: Math.cos(data.angle) * 10,
      vy: Math.sin(data.angle) * 10,
      damage: 20 + p.level * 5
    });
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
  });
});

setInterval(() => {
  // move spells
  for (let i = spells.length - 1; i >= 0; i--) {
    const s = spells[i];
    s.x += s.vx;
    s.y += s.vy;

    for (const id in players) {
      if (id === s.owner) continue;
      const p = players[id];
      const dx = p.x - s.x;
      const dy = p.y - s.y;
      if (Math.hypot(dx, dy) < 20) {
        p.hp -= s.damage;
        if (p.hp <= 0) {
          players[s.owner].xp += 50;
          players[s.owner].level =
            1 + Math.floor(players[s.owner].xp / 200);
          p.hp = 100;
          p.x = Math.random() * 2000;
          p.y = Math.random() * 2000;
        }
        spells.splice(i, 1);
        break;
      }
    }

    if (Math.abs(s.x) > 3000 || Math.abs(s.y) > 3000)
      spells.splice(i, 1);
  }

  io.emit("state", { players, spells });
}, 1000 / 60);

httpServer.listen(process.env.PORT || 3000);
