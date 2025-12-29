const socket = io();
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const ui = document.getElementById("ui");

canvas.width = innerWidth;
canvas.height = innerHeight;

const TILE = 64;
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

  const worldX =
    me.tx * TILE + (e.clientX - canvas.width / 2);
  const worldY =
    me.ty * TILE + (e.clientY - canvas.height / 2);

  const angle = Math.atan2(
    worldY - (me.ty * TILE),
    worldX - (me.tx * TILE)
  );

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
  for (let x = 0; x < 40; x++)
    for (let y = 0; y < 40; y++)
      ctx.strokeRect(x * TILE + camX, y * TILE + camY, TILE, TILE);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const me = state.players[socket.id];
  if (!me) return;

  camX += ((canvas.width / 2 - me.tx * TILE) - camX) * 0.15;
  camY += ((canvas.height / 2 - me.ty * TILE) - camY) * 0.15;

  drawGrid();

  for (const id in state.players) {
    const p = state.players[id];
    ctx.fillStyle = id === socket.id ? "cyan" : "red";
    ctx.fillRect(
      p.tx * TILE + camX + 16,
      p.ty * TILE + camY + 16,
      32, 32
    );
  }

  ctx.fillStyle = "orange";
  for (const s of state.spells)
    ctx.fillRect(s.x + camX - 4, s.y + camY - 4, 8, 8);

  // minimap
  ctx.fillStyle = "#000a";
  ctx.fillRect(canvas.width - 160, 10, 150, 150);

  for (const id in state.players) {
    const p = state.players[id];
    ctx.fillStyle = id === socket.id ? "cyan" : "red";
    ctx.fillRect(
      canvas.width - 160 + p.tx * 3,
      10 + p.ty * 3,
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
