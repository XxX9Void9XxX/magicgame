const socket = io();
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = innerWidth;
canvas.height = innerHeight;

const minimap = document.getElementById("minimap");
const mm = minimap.getContext("2d");

let state = {};
let me;
let camX=0, camY=0;
const keys={w:0,a:0,s:0,d:0};
const mouse={x:0,y:0};

window.onkeydown=e=>keys[e.key]=1;
window.onkeyup=e=>keys[e.key]=0;
window.onmousemove=e=>{mouse.x=e.clientX;mouse.y=e.clientY};
window.onmousedown=()=>{
  const a=Math.atan2(mouse.y-canvas.height/2,mouse.x-canvas.width/2);
  socket.emit("cast",{angle:a});
};

window.addEventListener("wheel",e=>{
  if(!me) return;
  me.selected += e.deltaY>0?1:-1;
  if(me.selected<0) me.selected=me.abilities.length-1;
  if(me.selected>=me.abilities.length) me.selected=0;
  socket.emit("select",me.selected);
});

function loop(){
  socket.emit("move",{
    w:keys.w,a:keys.a,s:keys.s,d:keys.d
  });
  requestAnimationFrame(loop);
}
loop();

socket.on("state",s=>{
  state=s;
  me=s.players[socket.id];
  if(me){
    camX=me.x-canvas.width/2;
    camY=me.y-canvas.height/2;
  }
});

function drawGrid(){
  ctx.strokeStyle="#222";
  for(let x=0;x<state.WORLD_SIZE;x+=64){
    ctx.beginPath();
    ctx.moveTo(x-camX,-camY);
    ctx.lineTo(x-camX,state.WORLD_SIZE-camY);
    ctx.stroke();
  }
  for(let y=0;y<state.WORLD_SIZE;y+=64){
    ctx.beginPath();
    ctx.moveTo(-camX,y-camY);
    ctx.lineTo(state.WORLD_SIZE-camX,y-camY);
    ctx.stroke();
  }
  ctx.strokeStyle="#fff";
  ctx.strokeRect(-camX,-camY,state.WORLD_SIZE,state.WORLD_SIZE);
}

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(!state.players) return;

  drawGrid();

  for(const c of state.crates){
    ctx.fillStyle="gold";
    ctx.fillRect(c.x-camX-8,c.y-camY-8,16,16);
  }

  for(const id in state.players){
    const p=state.players[id];
    ctx.fillStyle=id===socket.id?"cyan":"red";
    ctx.beginPath();
    ctx.arc(p.x-camX,p.y-camY,12,0,Math.PI*2);
    ctx.fill();

    ctx.fillStyle="lime";
    ctx.fillRect(p.x-camX-15,p.y-camY-22,30*(p.hp/100),4);
  }

  for(const s of state.spells){
    ctx.fillStyle="orange";
    ctx.beginPath();
    ctx.arc(s.x-camX,s.y-camY,6,0,Math.PI*2);
    ctx.fill();
  }

  mm.clearRect(0,0,minimap.width,minimap.height);
  const scale=minimap.width/state.WORLD_SIZE;

  for(const id in state.players){
    const p=state.players[id];
    mm.fillStyle=id===socket.id?"cyan":"red";
    mm.fillRect(p.x*scale,p.y*scale,3,3);
  }
  for(const c of state.crates){
    mm.fillStyle="yellow";
    mm.fillRect(c.x*scale,c.y*scale,3,3);
  }

  requestAnimationFrame(draw);
}
draw();
