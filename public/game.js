const socket = io();
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const healthFill = document.getElementById("healthFill");
const manaFill = document.getElementById("manaFill");
const slots = document.querySelectorAll(".slot");
const minimap = document.getElementById("minimap");

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

  // Players + health bars
  for (const id in state.players) {
    const p = state.players[id];

    // player
    ctx.fillStyle = id === socket.id ? "cyan" : "red";
    ctx.beginPath();
    ctx.arc(p.x + camX, p.y + camY, 16, 0, Math.PI * 2);
    ctx.fill();

    // health bar above player
    const barWidth = 32;
    const hpPct = p.hp / 100;

    ctx.fillStyle = "#400";
    ctx.fillRect(p.x + camX - barWidth / 2, p.y + camY - 28, barWidth, 5);

    ctx.fillStyle = "#f00";
    ctx.fillRect(p.x + camX - barWidth / 2, p.y + camY - 28, barWidth * hpPct, 5);
  }

  // Spell visuals + particles
  for (const s of state.spells) {
    spawnParticles(s);

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
      ctx.lineTo(s.x + camX - s.vx * 2, s.y + camY - s.vy * 2);
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

  // player UI: health & mana bars
  healthFill.style.width = `${me.hp}%`;
  manaFill.style.width = `${me.mana}%`;

  // minimap
  minimap.innerHTML = "";
  const mmScale = 150 / WORLD_SIZE;
  const mmCtx = minimap.getContext?.("2d");
  if (mmCtx) {
    mmCtx.clearRect(0, 0, 150, 150);
    for (const id in state.players) {
      const p = state.players[id];
      mmCtx.fillStyle = id === socket.id ? "cyan" : "red";
      mmCtx.fillRect(p.x * mmScale, p.y * mmScale, 4, 4);
    }
  } else {
    // fallback: div dots
    for (const id in state.players) {
      const dot = document.createElement("div");
      dot.style.position = "absolute";
      dot.style.width = "4px";
      dot.style.height = "4px";
      dot.style.background = id === socket.id ? "cyan" : "red";
      dot.style.left = `${p.x * mmScale + minimap.offsetLeft}px`;
      dot.style.top = `${p.y * mmScale + minimap.offsetTop}px`;
      minimap.appendChild(dot);
    }
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();
