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

// Initialize some crates with random abilities
const crateAbilities = ["ice","lightning"];
for(let i = 0; i < 5; i++){
  crates.push({x: Math.random()*WORLD_SIZE, y: Math.random()*WORLD_SIZE, ability: crateAbilities[Math.floor(Math.random()*crateAbilities.length)]});
}

io.on("connection", socket => {
  // Start with only Fire
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
    slow: 0,
    abilities: ["fire"]
  };

  socket.on("move", dir => {
    const p = players[socket.id];
    if (!p) return;
    const speed = p.slow > 0 ? 1.5 : 3;
    p.vx = 0; p.vy = 0;
    if (dir.w) p.vy -= speed;
    if (dir.s) p.vy += speed;
    if (dir.a) p.vx -= speed;
    if (dir.d) p.vx += speed;
  });

  socket.on("cast", data => {
    const p = players[socket.id];
    if (!p || !p.abilities.includes(data.type)) return; // can only cast unlocked abilities

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
      vx: Math.cos(data.angle) * def*
