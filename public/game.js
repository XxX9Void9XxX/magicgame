const socket = io();
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const ui = document.getElementById("ui");

canvas.width = innerWidth;
canvas.height = innerHeight;

const TILE = 64;
const WORLD_SIZE = 40 * TILE;

let state = { players: {}, spells: [] };
let spellType = "fire";
const keys = {};
const particles = [];

let camX = 0, camY = 0;

window.addEventListener("keydown", e => {
  keys[e.key] = true;
  if (e.key === "1") spellType = "fire";
  if (e.key === "2") spellType = "ice";
  if (e.key === "3") spellType = "lightning";
});
window.addEventListener("keyup", e => keys[e.key] = false);

canvas.addEventListener("click", e => {
  const me = state.players[socket.id];
  if (!me) return;

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left - camX;
  const my = e.clientY - rect.top - camY;

  const angle = Math.atan2(my - me.y, mx - me.x);
  socket.emit("cast", { angle, type: spellType });
});

socket.on("state", s => state = s);

function update() {
  socket.emit("move", {
    w: keys.w, a: keys.a,
    s: keys.s, d: keys.d
  });
}

function spawnParticles(spell) {
  const colors = {
    fire: ["#ff4500", "#ff8c00", "#ffaa00"],
    ice: ["#aeefff", "#dfffff"],
    lightning: ["#fff700", "#ffd700"]
  };

  for (let i = 0; i < 3; i++) {
    particles.push({
      x: spell.x,
      y: spell.y,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      life: 30,
      color: colors[spell.type][Math.floor(Math.random() * colors[spell.type].length)]
    });
  }
}

function drawGrid() {
  ctx.strokeStyle = "#222";
  for (let x = 0; x <= WORLD_SIZE; x += TILE)
    ctx.strokeRect(x + camX, camY, TILE, WORLD_SIZE);
  for (let y = 0; y <= WORLD_SIZE; y += TILE)
    ctx.strokeRect(camX, y + camY, WORLD_SIZE, TILE);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const me = state.players[socket.id];
  if (!me) return;

  camX += (canvas.width / 2 - me.x - camX) * 0.15;
  camY += (canvas.height / 2 - me.y - camY) * 0.15;

  drawGrid();

  for (const s of state.spells) spawnParticles(s);

  // players
  for (const id in state.players) {
    const p = state.players[id];
    ctx.fillStyle = id === socket.id ? "cyan" : "red";
    ctx.beginPath();
    ctx.arc(p.x + camX, p.y + camY, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  // spells core
  for (const s of state.spells) {
    if (s.type === "fire") {
      ctx.fillStyle = "orange";
      ctx.beginPath();
      ctx.arc(s.x + camX, s.y + camY, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    if (s.type === "ice") {
      ctx.fillStyle = "#bff";
      ctx.beginPath();
      ctx.arc(s.x + camX, s.y + camY, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    if (s.type === "lightning") {
      ctx.strokeStyle = "#ff0";
      ctx.beginPath();
      ctx.moveTo(s.x + camX, s.y + camY);
      ctx.lineTo(
        s.x + camX - s.vx * 2,
        s.y + camY - s.vy * 2
      );
      ctx.stroke();
    }
  }

  // particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life--;

    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life / 30;
    ctx.fillRect(p.x + camX, p.y + camY, 3, 3);
    ctx.globalAlpha = 1;

    if (p.life <= 0) particles.splice(i, 1);
  }

  // minimap
  ctx.fillStyle = "#000a";
  ctx.fillRect(canvas.width - 160, 10, 150, 150);
  for (const id in state.players) {
    const p = state.players[id];
    ctx.fillStyle = id === socket.id ? "cyan" : "red";
    ctx.fillRect(
      canvas.width - 160 + (p.x / WORLD_SIZE) * 150,
      10 + (p.y / WORLD_SIZE) * 150,
      4, 4
    );
  }

  ui.innerHTML = `
    HP: ${me.hp}<br>
    Mana: ${me.mana.toFixed(0)}<br>
    Level: ${me.level}<br>
    Spell: ${spellType} (1/2/3)
  `;
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();
