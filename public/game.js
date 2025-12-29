const socket = io();
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const healthFill = document.getElementById("healthFill");
const slots = document.querySelectorAll(".slot");

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

  if (e.key === "1") selectSpell("fire", 0);
  if (e.key === "2") selectSpell("ice", 1);
  if (e.key === "3") selectSpell("lightning", 2);
});

window.addEventListener("keyup", e => keys[e.key] = false);

function selectSpell(type, index) {
  spellType = type;
  slots.forEach(s => s.classList.remove("selected"));
  slots[index].classList.add("selected");
}

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

  /* PLAYERS + HEALTH BARS */
  for (const id in state.players) {
    const p = state.players[id];

    // player
    ctx.fillStyle = id === socket.id ? "cyan" : "red";
    ctx.beginPath();
    ctx.arc(p.x + camX, p.y + camY, 16, 0, Math.PI * 2);
    ctx.fill();

    // health bar
    const barWidth = 32;
    const hpPct = p.hp / 100;

    ctx.fillStyle = "#400";
    ctx.fillRect(
      p.x + camX - barWidth / 2,
      p.y + camY - 28,
      barWidth,
      5
    );

    ctx.fillStyle = "#f00";
    ctx.fillRect(
      p.x + camX - barWidth / 2,
      p.y + camY - 28,
      barWidth * hpPct,
      5
    );
  }

  /* SPELL VISUALS */
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

  /* PLAYER UI HEALTH */
  healthFill.style.width = `${me.hp}%`;
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();
