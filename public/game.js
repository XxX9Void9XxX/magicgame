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

let camX = 0;
let camY = 0;

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

  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const worldX = mouseX - camX;
  const worldY = mouseY - camY;

  const angle = Math.atan2(worldY - me.y, worldX - me.x);

  socket.emit("cast", { angle, type: spellType });
});

socket.on("state", s => state = s);

function update() {
  socket.emit("move", {
    w: keys.w,
    a: keys.a,
    s: keys.s,
    d: keys.d
  });
}

function drawGrid() {
  ctx.strokeStyle = "#222";
  for (let x = 0; x <= WORLD_SIZE; x += TILE)
    ctx.beginPath(), ctx.moveTo(x + camX, camY),
    ctx.lineTo(x + camX, WORLD_SIZE + camY), ctx.stroke();

  for (let y = 0; y <= WORLD_SIZE; y += TILE)
    ctx.beginPath(), ctx.moveTo(camX, y + camY),
    ctx.lineTo(WORLD_SIZE + camX, y + camY), ctx.stroke();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const me = state.players[socket.id];
  if (!me) return;

  camX += (canvas.width / 2 - me.x - camX) * 0.15;
  camY += (canvas.height / 2 - me.y - camY) * 0.15;

  drawGrid();

  for (const id in state.players) {
    const p = state.players[id];
    ctx.fillStyle = id === socket.id ? "cyan" : "red";
    ctx.beginPath();
    ctx.arc(p.x + camX, p.y + camY, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "orange";
  for (const s of state.spells) {
    ctx.beginPath();
    ctx.arc(s.x + camX, s.y + camY, 6, 0, Math.PI * 2);
    ctx.fill();
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
