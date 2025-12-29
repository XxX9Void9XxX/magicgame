const socket = io();
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const ui = document.getElementById("ui");

canvas.width = innerWidth;
canvas.height = innerHeight;

let state = { players:{}, spells:[] };
const keys = {};

window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);

canvas.addEventListener("click", e => {
  const me = state.players[socket.id];
  if (!me) return;
  const angle = Math.atan2(
    e.clientY - canvas.height/2,
    e.clientX - canvas.width/2
  );
  socket.emit("cast", { angle });
});

socket.on("state", s => state = s);

function update() {
  socket.emit("move", {
    w: keys["w"], a: keys["a"],
    s: keys["s"], d: keys["d"]
  });
}

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const me = state.players[socket.id];
  if (!me) return;

  ctx.save();
  ctx.translate(
    canvas.width/2 - me.x,
    canvas.height/2 - me.y
  );

  for (const id in state.players) {
    const p = state.players[id];
    ctx.fillStyle = id === socket.id ? "cyan" : "red";
    ctx.beginPath();
    ctx.arc(p.x,p.y,15,0,Math.PI*2);
    ctx.fill();
  }

  ctx.fillStyle = "orange";
  for (const s of state.spells) {
    ctx.beginPath();
    ctx.arc(s.x,s.y,6,0,Math.PI*2);
    ctx.fill();
  }

  ctx.restore();

  ui.innerHTML = `
    HP: ${me.hp}<br>
    Mana: ${me.mana}<br>
    Level: ${me.level}
  `;
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();
