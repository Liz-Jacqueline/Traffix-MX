'use strict';

// ═══════════════════════════════════════════════════════════
// GLOBALS
// ═══════════════════════════════════════════════════════════
const canvas=document.getElementById('sim'),ctx=canvas.getContext('2d');
let running=false,simSpeed=2,curIdx=0;
let animId=null,lastTime=0,dayMin=360;
let cars=[],peds=[],lights=[],sensors=[],laneDefs=[],crosswalks=[],sidewalkRects=[];
let totalThru=0,carHist=[],greenHist=[],peakData=new Array(12).fill(0);
let pedBtnPresses=0,pedBtnHist=[],totalPedCrosses=0;
let spawnT=0,pedSpawnT=0,flowT=0,flowCnt=0;
let idef=null,phaseCtrl=null,G=null;

// ── IA globals ──────────────────────────────────────────────────────
let totalSaved=0,savedHist=[],aiLog=[];
const DETECT_RANGE=110; // píxeles para detección de colas
const IA_MIN_GREEN=3500,IA_MAX_GREEN=20000,IA_MIN_YELLOW=2000;
let aiTickT=0; // acumula ms para ejecutar IA cada 1000ms

// Road geometry
const L=20, SW=22, HR=2*L, CAR_L=15;

function makeGeom(cx,cy){
  return {
    cx,cy,HR,
    yE1:cy+L/2,yE2:cy+3*L/2,yW1:cy-L/2,yW2:cy-3*L/2,
    xN1:cx+L/2,xN2:cx+3*L/2,xS1:cx-L/2,xS2:cx-3*L/2,
    rTop:cy-HR,rBot:cy+HR,rLeft:cx-HR,rRight:cx+HR,
    swTopOut:cy-HR-SW,swBotOut:cy+HR+SW,
    swLeftOut:cx-HR-SW,swRightOut:cx+HR+SW,
  };
}

function resize(){
  canvas.width=canvas.parentElement.clientWidth;
  canvas.height=canvas.parentElement.clientHeight;
  build(curIdx);
}
window.addEventListener('resize',resize);

// ═══════════════════════════════════════════════════════════
// DRAWING HELPERS
// ═══════════════════════════════════════════════════════════
function rr(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}
function qbez(p0,p1,p2,n=14){
  const o=[];
  for(let i=0;i<=n;i++){const t=i/n,u=1-t;o.push({x:u*u*p0.x+2*u*t*p1.x+t*t*p2.x,y:u*u*p0.y+2*u*t*p1.y+t*t*p2.y});}
  return o;
}
function drawSidewalk(x,y,w,h){
  if(w<=0||h<=0)return;
  ctx.fillStyle='#18263c';ctx.fillRect(x,y,w,h);
  ctx.strokeStyle='rgba(255,255,255,.03)';ctx.lineWidth=1;
  for(let tx=x;tx<x+w;tx+=9){ctx.beginPath();ctx.moveTo(tx,y);ctx.lineTo(tx,y+h);ctx.stroke();}
  for(let ty=y;ty<y+h;ty+=9){ctx.beginPath();ctx.moveTo(x,ty);ctx.lineTo(x+w,ty);ctx.stroke();}
  ctx.strokeStyle='rgba(0,229,255,.05)';ctx.lineWidth=1;ctx.strokeRect(x,y,w,h);
}
function drawRoadH(y,x0,x1){
  ctx.fillStyle='#101822';ctx.fillRect(x0,y-HR,x1-x0,HR*2);
  ctx.strokeStyle='#1e3248';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(x0,y-HR);ctx.lineTo(x1,y-HR);ctx.stroke();
  ctx.beginPath();ctx.moveTo(x0,y+HR);ctx.lineTo(x1,y+HR);ctx.stroke();
  ctx.strokeStyle='rgba(255,210,50,.2)';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y);ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.09)';ctx.lineWidth=1;ctx.setLineDash([14,12]);
  ctx.beginPath();ctx.moveTo(x0,y-L);ctx.lineTo(x1,y-L);ctx.stroke();
  ctx.beginPath();ctx.moveTo(x0,y+L);ctx.lineTo(x1,y+L);ctx.stroke();
  ctx.setLineDash([]);
}
function drawRoadV(x,y0,y1){
  ctx.fillStyle='#101822';ctx.fillRect(x-HR,y0,HR*2,y1-y0);
  ctx.strokeStyle='#1e3248';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(x-HR,y0);ctx.lineTo(x-HR,y1);ctx.stroke();
  ctx.beginPath();ctx.moveTo(x+HR,y0);ctx.lineTo(x+HR,y1);ctx.stroke();
  ctx.strokeStyle='rgba(255,210,50,.2)';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(x,y0);ctx.lineTo(x,y1);ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.09)';ctx.lineWidth=1;ctx.setLineDash([14,12]);
  ctx.beginPath();ctx.moveTo(x-L,y0);ctx.lineTo(x-L,y1);ctx.stroke();
  ctx.beginPath();ctx.moveTo(x+L,y0);ctx.lineTo(x+L,y1);ctx.stroke();
  ctx.setLineDash([]);
}
function fillBox(x,y,w,h){ctx.fillStyle='#101822';ctx.fillRect(x,y,w,h);}
function drawZebraH(x,y,w,h){
  ctx.fillStyle='rgba(35,50,75,.5)';ctx.fillRect(x,y,w,h);
  const n=7,sw=w/n;
  for(let i=0;i<n;i+=2){ctx.fillStyle='rgba(225,238,255,.2)';ctx.fillRect(x+i*sw,y,sw,h);}
}
function drawZebraV(x,y,w,h){
  ctx.fillStyle='rgba(35,50,75,.5)';ctx.fillRect(x,y,w,h);
  const n=7,sh=h/n;
  for(let i=0;i<n;i+=2){ctx.fillStyle='rgba(225,238,255,.2)';ctx.fillRect(x,y+i*sh,w,sh);}
}

// ═══════════════════════════════════════════════════════════
// IA: DETECCIÓN DE COLAS
// Cuenta autos esperando FRENTE al semáforo en rojo/amarillo
// ═══════════════════════════════════════════════════════════
function detectQueue(light){
  // Detecta cuántos autos están dentro del rango de detección
  // esperando (waiting) o moviéndose hacia el semáforo
  const { x, y } = light;
  let ahead=0,behind=0;
  for(const c of cars){
    if(c.done)continue;
    const dx=c.x-x, dy=c.y-y;
    const dist=Math.sqrt(dx*dx+dy*dy);
    if(dist<DETECT_RANGE){
      if(c.waiting) ahead++;
      else behind++;
    }
  }
  return {ahead,behind};
}

// ═══════════════════════════════════════════════════════════
// IA: MOTOR DE DECISIONES
// Ejecuta cada ~1000ms de tiempo real de simulación.
// Ajusta timers del PhaseController basado en presión de colas.
// ═══════════════════════════════════════════════════════════
function runAI(){
  if(!phaseCtrl||!running)return;

  for(const light of lights){
    const {ahead,behind}=detectQueue(light);
    // Actualizar presión acumulada del semáforo
    if(ahead>0) light.pressure=Math.min(100,light.pressure+ahead*5);
    else        light.pressure=Math.max(0,light.pressure-10);
    light.queueAhead=ahead;
    light.queueBehind=behind;
  }

  // Decisiones sobre la fase VERDE actualmente activa
  if(phaseCtrl.state==='green'){
    const gi=phaseCtrl.cur;
    const gid=phaseCtrl.phases[gi].gids[0];
    const greenLights=lights.filter(l=>l.gid===gid);
    const totalAhead=greenLights.reduce((s,l)=>s+l.queueAhead,0);
    const totalBehind=greenLights.reduce((s,l)=>s+l.queueBehind,0);
    const elapsed=phaseCtrl.greenBudget-phaseCtrl.timer;

    // ── EXTENSIÓN: Cola alta y podemos extender ──────────────
    if(totalAhead>=3 && elapsed>=IA_MIN_GREEN && phaseCtrl.timer<3000 && phaseCtrl.greenBudget<IA_MAX_GREEN && !phaseCtrl._iaExtended){
      const ext=Math.min(IA_MAX_GREEN-phaseCtrl.greenBudget, totalAhead*700);
      phaseCtrl.timer+=ext;
      phaseCtrl.greenBudget+=ext;
      phaseCtrl._iaExtended=true;
      const extS=(ext/1000).toFixed(1);
      logIA(phaseCtrl.phases[gi].name,`⬆ Verde extendido +${extS}s (cola: ${totalAhead} autos)`);
    }

    // ── CORTE ANTICIPADO: Fase vacía, IA libera tiempo ───────
    if(totalAhead===0 && totalBehind===0 && elapsed>=IA_MIN_GREEN && phaseCtrl.timer>3500 && !phaseCtrl._iaCut){
      const saved=phaseCtrl.timer-2000;
      const savedS=(saved/1000).toFixed(1);
      phaseCtrl.timer=2000; // 2 s de gracia y cambia
      phaseCtrl._iaCut=true;
      totalSaved+=saved/1000;
      greenLights.forEach(l=>l.iaSaved=(l.iaSaved||0)+saved/1000);
      logIA(phaseCtrl.phases[gi].name,`✂ Verde cortado (vacío) +${savedS}s ahorrados`);
    }
  }

  // Decisiones sobre las fases en ROJO — priorización
  if(phaseCtrl.state==='allred'){
    // Encontrar la fase con mayor presión para darle prioridad
    let bestPressure=-1,bestIdx=-1;
    for(let i=0;i<phaseCtrl.phases.length;i++){
      const gid=phaseCtrl.phases[i].gids[0];
      const p=lights.filter(l=>l.gid===gid).reduce((s,l)=>s+l.pressure,0);
      if(p>bestPressure){bestPressure=p;bestIdx=i;}
    }
    if(bestPressure>=50 && bestIdx>=0 && bestIdx!==phaseCtrl.cur){
      phaseCtrl._nextForcedPhase=bestIdx;
      const bestName=phaseCtrl.phases[bestIdx].name;
      logIA('IA Prioridad',`🔀 Siguiente: ${bestName} (presión ${bestPressure.toFixed(0)}%)`);
    }
  }

  // Reset flags al cambiar de fase
  if(phaseCtrl.state==='yellow'||phaseCtrl.state==='allred'){
    phaseCtrl._iaExtended=false;
    phaseCtrl._iaCut=false;
  }

  savedHist.push(Math.round(totalSaved));
  if(savedHist.length>20)savedHist.shift();
  renderSig();
}

function logIA(sem,msg){
  aiLog.unshift({time:new Date().toLocaleTimeString(),sem,msg});
  if(aiLog.length>15)aiLog.pop();
  renderAILog();
}

function renderAILog(){
  const el=document.getElementById('iaLog');
  if(!aiLog.length){el.innerHTML='<div class="ia-empty">Inicia la simulación para ver decisiones de la IA.</div>';return;}
  el.innerHTML=aiLog.map(e=>`<div class="ia-entry"><span class="ia-time">${e.time}</span><span class="ia-sem">${e.sem}</span><span class="ia-msg">${e.msg}</span></div>`).join('');
}

// ═══════════════════════════════════════════════════════════
// PHASE CONTROLLER — Adaptativo + IA
// ═══════════════════════════════════════════════════════════
class PhaseController{
  constructor(phases){
    this.phases=phases;
    this.YELLOW=2500;this.ALLRED=1800;
    this.MIN_G=3500;this.MAX_G=20000;this.BASE_G=7000;this.SKIP_TH=0.5;
    this.cur=0;this.state='green';this.timer=this.MIN_G;this.greenBudget=this.MIN_G;
    this.pedQueued=false;this.pedActive=false;
    this.pedTimer=0;this.pedDuration=7000;
    this.pedCooldown=0;this.pedCooldownTime=22000;
    this.cycleCount=0;this.pedCooldownCycles=phases.length;
    this._iaExtended=false;this._iaCut=false;this._nextForcedPhase=-1;
    this._startGreen(0);
  }
  _gid(i){return this.phases[i].gids[0];}
  _applyGreen(i){const g=this._gid(i);for(const l of lights)l.state=l.gid===g?'green':'red';}
  _applyYellow(){const g=this._gid(this.cur);for(const l of lights)l.state=l.gid===g?'yellow':'red';}
  _applyAllRed(){for(const l of lights)l.state='red';}
  _demand(i){
    const g=this._gid(i);
    return lights.filter(l=>l.gid===g).reduce((s,l)=>s+l.demand,0);
  }
  _calcGreen(i){
    const demands=this.phases.map((_,k)=>this._demand(k));
    const total=demands.reduce((s,d)=>s+d,0);
    const myD=demands[i];
    if(total<1)return this.MIN_G;
    const n=this.phases.length;
    const maxD=Math.max(...demands);
    const allBusy=demands.every(d=>d>=maxD*0.4);
    if(allBusy){
      const fairShare=1/n,myShare=myD/total,ratio=myShare/fairShare;
      return Math.round(Math.min(this.MAX_G,Math.max(this.MIN_G,this.BASE_G*ratio)));
    }
    return Math.round(Math.min(this.MAX_G,Math.max(this.MIN_G,this.MIN_G+myD*600)));
  }
  _nextPhase(){
    // IA puede forzar una fase por alta presión
    if(this._nextForcedPhase>=0){
      const nfp=this._nextForcedPhase;this._nextForcedPhase=-1;return nfp;
    }
    const n=this.phases.length;
    let best=(this.cur+1)%n,bestD=-Infinity;
    for(let k=1;k<=n;k++){
      const i=(this.cur+k)%n;
      const d=this._demand(i);
      if(d>bestD){bestD=d;best=i;}
    }
    if(bestD<=this.SKIP_TH)return(this.cur+1)%n;
    return best;
  }
  _junctionClear(){
    if(!G)return true;
    const m=CAR_L,{rLeft,rRight,rTop,rBot}=G;
    return !cars.some(c=>!c.done&&c.x>rLeft-m&&c.x<rRight+m&&c.y>rTop-m&&c.y<rBot+m);
  }
  _startGreen(i){
    this.cur=i;this.state='green';
    this.greenBudget=this._calcGreen(i);
    this.timer=this.greenBudget;
    this._applyGreen(i);
    const g=this._gid(i);
    for(const l of lights)if(l.gid===g)l.demand=Math.max(0,l.demand-1.5);
  }
  requestPed(){
    if(this.pedActive||this.pedQueued||this.pedCooldown>0)return;
    this.pedQueued=true;pedBtnPresses++;
    document.getElementById('pedStatus').textContent='⚠ Solicitud registrada';
    document.getElementById('pedStatus').style.color='var(--ped)';
    if(this.state==='green'&&this.timer>3000)this.timer=2500;
  }
  update(dt){
    if(this.pedCooldown>0)this.pedCooldown=Math.max(0,this.pedCooldown-dt);
    if(this.state==='ped'){
      this.pedTimer-=dt;
      if(this.pedTimer<=0){
        this.pedActive=false;
        for(const cw of crosswalks)cw.pedGo=false;
        this._applyAllRed();this.state='allred';this.timer=this.ALLRED;
        this.pedCooldown=this.pedCooldownTime;this.cycleCount=0;
      }
      return;
    }
    this.timer-=dt;
    if(this.state==='green'){
      const g=this._gid(this.cur);
      for(const l of lights)if(l.gid===g)l.demand=Math.max(0,l.demand-dt*0.005);
      if(this.timer>0){
        const nb=this._calcGreen(this.cur);
        const diff=nb-this.greenBudget;
        if(Math.abs(diff)>400){
          this.timer=Math.min(this.MAX_G,Math.max(500,this.timer+diff*0.12));
          this.greenBudget=nb;
        }
      }
      if(this.timer<=0){this._applyYellow();this.state='yellow';this.timer=this.YELLOW;}
      return;
    }
    if(this.state==='yellow'&&this.timer<=0){
      this._applyAllRed();this.state='allred';this.timer=this.ALLRED;this.cycleCount++;return;
    }
    if(this.state==='allred'&&this.timer<=0){
      if(!this._junctionClear()&&this.timer>-2000)return;
      if(this.pedQueued&&this.pedCooldown<=0&&this.cycleCount>=this.pedCooldownCycles){
        this.pedQueued=false;this.pedActive=true;
        this.pedTimer=this.pedDuration;this.state='ped';
        this._applyAllRed();
        for(const cw of crosswalks)cw.pedGo=true;
        document.getElementById('pedStatus').textContent='🚶 FASE PEATONAL';
        document.getElementById('pedStatus').style.color='var(--ped)';
        return;
      }
      this._startGreen(this._nextPhase());
      if(!this.pedQueued){
        document.getElementById('pedStatus').textContent='Sin solicitud';
        document.getElementById('pedStatus').style.color='var(--muted)';
      }
    }
  }
  getPhaseName(){
    if(this.state==='ped')return'🚶 FASE PEATONAL';
    if(this.state==='allred')return'🔴 INTERMEDIO';
    if(this.state==='yellow')return'🟡 AMARILLO';
    const t=Math.max(0,Math.ceil(this.timer/1000));
    return`${this.phases[this.cur].name} (${t}s)`;
  }
}

// ═══════════════════════════════════════════════════════════
// TRAFFIC LIGHT — con propiedades IA
// ═══════════════════════════════════════════════════════════
class TLight{
  constructor(x,y,name,gid){
    this.x=x;this.y=y;this.name=name;this.gid=gid;
    this.state='red';this.demand=0;
    // IA
    this.pressure=0;this.queueAhead=0;this.queueBehind=0;this.iaSaved=0;
  }
  isGo(){return this.state==='green';}
  draw(){
    ctx.save();
    ctx.fillStyle='#182030';ctx.fillRect(this.x-1.5,this.y,3,22);
    ctx.fillStyle='#0a0e1c';ctx.strokeStyle='#1e2e44';ctx.lineWidth=1.2;
    rr(this.x-9,this.y-50,18,50,3);ctx.fill();ctx.stroke();
    const C={red:'#ef4444',yellow:'#eab308',green:'#22c55e'};
    const O={red:'#3a0f0f',yellow:'#3a2d00',green:'#0a2610'};
    [{s:'red',oy:-43},{s:'yellow',oy:-30},{s:'green',oy:-17}].forEach(p=>{
      const on=this.state===p.s;
      ctx.beginPath();ctx.arc(this.x,this.y+p.oy,5.5,0,Math.PI*2);
      ctx.fillStyle=on?C[p.s]:O[p.s];ctx.fill();
      if(on){ctx.shadowColor=C[p.s];ctx.shadowBlur=10;ctx.fill();ctx.shadowBlur=0;}
    });
    // ── IA: indicador de presión sobre el semáforo ──
    if(this.pressure>5){
      const px=this.x,py=this.y-62;
      const pw=16,ph=3;
      ctx.fillStyle='rgba(0,0,0,.5)';rr(px-pw/2,py,pw,ph,1.5);ctx.fill();
      const pct=this.pressure/100;
      const pc=this.pressure>60?'#ef4444':this.pressure>30?'#eab308':'#00ffcc';
      ctx.fillStyle=pc;ctx.shadowColor=pc;ctx.shadowBlur=4;
      if(pct>0){rr(px-pw/2,py,pw*pct,ph,1.5);ctx.fill();}
      ctx.shadowBlur=0;
      // número de cola
      if(this.queueAhead>0){
        ctx.fillStyle=pc;
        ctx.font='bold 7px "Space Mono",monospace';
        ctx.textAlign='center';
        ctx.fillText(this.queueAhead,px,py-2);
      }
    }
    // ── IA: anillo visual de detección (sutil) ──
    if(this.state!=='green'&&this.queueAhead>0){
      const alpha=Math.min(0.25,this.queueAhead*0.05);
      ctx.strokeStyle=`rgba(0,255,204,${alpha})`;
      ctx.lineWidth=1;ctx.setLineDash([3,5]);
      ctx.beginPath();ctx.arc(this.x,this.y,DETECT_RANGE,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════
// SENSOR
// ═══════════════════════════════════════════════════════════
class Sensor{
  constructor(x,y,w,h,li){this.x=x;this.y=y;this.w=w;this.h=h;this.li=li;this.active=false;}
  check(){
    this.active=false;
    for(const c of cars){
      if(c.x>this.x&&c.x<this.x+this.w&&c.y>this.y&&c.y<this.y+this.h){
        this.active=true;
        if(lights[this.li]){
          const bonus=c.waiting?0.6:0.3;
          lights[this.li].demand=Math.min(20,lights[this.li].demand+bonus);
        }
      }
    }
  }
  draw(){
    ctx.save();ctx.strokeStyle=this.active?'rgba(127,255,0,.7)':'rgba(30,45,74,.35)';
    ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.strokeRect(this.x,this.y,this.w,this.h);ctx.setLineDash([]);
    if(this.active){ctx.fillStyle='rgba(127,255,0,.05)';ctx.fillRect(this.x,this.y,this.w,this.h);}
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════
// PEDESTRIAN SIGNAL
// ═══════════════════════════════════════════════════════════
class PedLight{
  constructor(x,y){this.x=x;this.y=y;this.flashOn=true;this.flashT=0;}
  update(dt){
    const blink=phaseCtrl&&phaseCtrl.pedActive&&phaseCtrl.pedTimer<2000;
    if(blink){this.flashT-=dt;if(this.flashT<=0){this.flashT=270;this.flashOn=!this.flashOn;}}
    else this.flashOn=true;
  }
  draw(){
    const go=!!(phaseCtrl&&phaseCtrl.pedActive);
    ctx.save();
    ctx.fillStyle='#182030';ctx.fillRect(this.x-1.5,this.y,3,16);
    ctx.fillStyle='#0a0e1c';ctx.strokeStyle='#1e2e44';ctx.lineWidth=1.2;
    rr(this.x-10,this.y-42,20,42,3);ctx.fill();ctx.stroke();
    ctx.save();ctx.fillStyle=!go?'#ef4444':'#3a0f0f';
    if(!go){ctx.shadowColor='#ef4444';ctx.shadowBlur=8;}
    ctx.beginPath();ctx.ellipse(this.x,this.y-30,4,5,0,0,Math.PI*2);ctx.fill();
    ctx.fillRect(this.x-4,this.y-37,2,7);ctx.fillRect(this.x-1.5,this.y-39,2,9);
    ctx.fillRect(this.x+1.5,this.y-38,2,8);ctx.fillRect(this.x+3.5,this.y-36,2,6);
    ctx.shadowBlur=0;ctx.restore();
    const manOn=go&&this.flashOn;
    ctx.save();ctx.fillStyle=manOn?'#22c55e':'#0a2610';
    if(manOn){ctx.shadowColor='#22c55e';ctx.shadowBlur=8;}
    ctx.beginPath();ctx.arc(this.x,this.y-13,2.8,0,Math.PI*2);ctx.fill();
    ctx.fillRect(this.x-1.5,this.y-10,3,6);
    ctx.save();ctx.translate(this.x-1.5,this.y-8);ctx.rotate(-0.65);ctx.fillRect(0,-1,5,1.8);ctx.restore();
    ctx.save();ctx.translate(this.x+1.5,this.y-8);ctx.rotate(0.5);ctx.fillRect(0,-1,4,1.8);ctx.restore();
    ctx.save();ctx.translate(this.x,this.y-4);ctx.rotate(-0.45);ctx.fillRect(-1,0,2,6);ctx.restore();
    ctx.save();ctx.translate(this.x,this.y-4);ctx.rotate(0.4);ctx.fillRect(-1,0,2,6);ctx.restore();
    ctx.shadowBlur=0;ctx.restore();
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════
// CROSSWALK
// ═══════════════════════════════════════════════════════════
class Crosswalk{
  constructor(zebra,dir,plx,ply,btnx,btny,waitA,waitB,spawnA,spawnB){
    this.z=zebra;this.dir=dir;this.pedGo=false;
    this.btnActive=false;this.btnFlashOn=true;this.btnFlashT=0;
    this.pl=new PedLight(plx,ply);
    this.btnx=btnx;this.btny=btny;
    this.waitA=waitA;this.waitB=waitB;this.spawnA=spawnA;this.spawnB=spawnB;
  }
  pressButton(){
    if(!this.btnActive&&phaseCtrl&&!phaseCtrl.pedQueued&&!phaseCtrl.pedActive&&phaseCtrl.pedCooldown<=0){
      this.btnActive=true;phaseCtrl.requestPed();
    }
  }
  update(dt){
    this.pedGo=!!(phaseCtrl&&phaseCtrl.pedActive);
    if(!this.pedGo)this.btnActive=false;
    this.pl.update(dt);
    if(this.btnActive){this.btnFlashT-=dt;if(this.btnFlashT<=0){this.btnFlashT=340;this.btnFlashOn=!this.btnFlashOn;}}
    else this.btnFlashOn=true;
  }
  draw(){
    const z=this.z;
    if(this.dir==='H')drawZebraH(z.x,z.y,z.w,z.h);else drawZebraV(z.x,z.y,z.w,z.h);
    this.pl.draw();
    const bx=this.btnx,by=this.btny;
    ctx.save();
    ctx.fillStyle=this.btnActive&&this.btnFlashOn?'rgba(168,85,247,.55)':'rgba(10,16,30,.9)';
    ctx.strokeStyle=this.btnActive?'#a855f7':'#283850';ctx.lineWidth=1.2;
    rr(bx-7,by-7,14,14,3);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.arc(bx,by,3.5,0,Math.PI*2);
    ctx.fillStyle=this.btnActive&&this.btnFlashOn?'#a855f7':this.pedGo?'#22c55e':'#ef4444';
    ctx.fill();
    if(this.btnActive||this.pedGo){ctx.shadowColor=this.btnActive?'#a855f7':'#22c55e';ctx.shadowBlur=7;ctx.fill();ctx.shadowBlur=0;}
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════
// CAR
// ═══════════════════════════════════════════════════════════
const COLORS=['#3b82f6','#f97316','#a855f7','#06b6d4','#ec4899','#84cc16','#f59e0b','#14b8a6','#fb7185','#60a5fa'];
const CAR_W=L*0.65|0;
const MAX_SPD=1.4,ACCEL=0.08,BRAKE=0.22,SAFE_GAP=CAR_L+12;

class Car{
  constructor(lane){
    this.lane=lane;this.ptIdx=0;
    const p=lane.pts[0];
    this.x=p.x;this.y=p.y;this.angle=0;this.spd=0;
    this.maxSpd=MAX_SPD*(0.85+Math.random()*0.3);
    this.col=COLORS[Math.floor(Math.random()*COLORS.length)];
    this.done=false;this.waiting=false;this.waitTime=0;this._arc=0;
    if(lane.pts.length>1){const dx=lane.pts[1].x-p.x,dy=lane.pts[1].y-p.y;this.angle=Math.atan2(dy,dx);}
  }
  distToStop(){
    const si=this.lane.stopIdx;
    if(si<0||this.ptIdx>=si)return Infinity;
    const pts=this.lane.pts,ni=Math.min(this.ptIdx+1,pts.length-1);
    let d=Math.hypot(pts[ni].x-this.x,pts[ni].y-this.y);
    for(let i=ni;i<si;i++)d+=Math.hypot(pts[i+1].x-pts[i].x,pts[i+1].y-pts[i].y);
    return d;
  }
  update(dt,sm){
    if(this.done)return;
    const pts=this.lane.pts;
    if(this.ptIdx>=pts.length-1){this.done=true;totalThru++;return;}
    const f=sm*dt/16;
    let gap=99999;
    for(const o of this.lane.cars){
      if(o===this||o.done)continue;
      const d=o._arc-this._arc;
      if(d>0&&d<gap)gap=d;
    }
    const li=this.lane.lightIdx;
    const dStop=this.distToStop();
    const redStop=li>=0&&lights[li]&&!lights[li].isGo()&&dStop<SAFE_GAP*2.5;
    const pedStop=phaseCtrl&&(phaseCtrl.pedActive||phaseCtrl.state==='allred')&&li>=0&&dStop<SAFE_GAP*3.5;
    const mustStop=gap<SAFE_GAP||redStop||pedStop;
    if(mustStop){
      const frac=Math.max(0,Math.min(1,(gap-CAR_L)/SAFE_GAP));
      this.spd=Math.max(0,this.spd-BRAKE*(1.5-frac)*f*6);
      this.waiting=true;this.waitTime+=dt;
    } else {
      this.spd=Math.min(this.maxSpd,this.spd+ACCEL*f*3);
      this.waiting=false;
    }
    if(gap<99999)this.spd=Math.min(this.spd,Math.max(0,(gap-CAR_L)*0.08));
    let rem=this.spd*f;
    while(rem>0&&this.ptIdx<pts.length-1){
      const tx=pts[this.ptIdx+1].x,ty=pts[this.ptIdx+1].y;
      const dx=tx-this.x,dy=ty-this.y,dist=Math.hypot(dx,dy);
      this.angle=Math.atan2(dy,dx);
      if(dist<=rem){this._arc+=dist;this.x=tx;this.y=ty;this.ptIdx++;rem-=dist;}
      else{this._arc+=rem;this.x+=dx/dist*rem;this.y+=dy/dist*rem;rem=0;}
    }
    if(this.ptIdx>=pts.length-1){this.done=true;totalThru++;}
  }
  draw(){
    ctx.save();
    ctx.translate(this.x,this.y);ctx.rotate(this.angle);
    ctx.shadowColor=this.col;ctx.shadowBlur=3;
    ctx.fillStyle=this.col;rr(-CAR_L/2,-CAR_W/2,CAR_L,CAR_W,2.5);ctx.fill();
    ctx.shadowBlur=0;
    ctx.fillStyle='rgba(180,220,255,.28)';rr(CAR_L/2-5,-CAR_W/2+1.5,4,CAR_W-3,1);ctx.fill();
    ctx.fillStyle='rgba(239,68,68,.9)';
    ctx.fillRect(-CAR_L/2+1,-CAR_W/2+1,2.5,2);ctx.fillRect(-CAR_L/2+1,CAR_W/2-3,2.5,2);
    ctx.restore();
  }
}

class Ped{
  constructor(cw,side){
    this.cw=cw;this.side=side;
    this.spd=0.32+Math.random()*0.18;
    this.done=false;this.age=0;this.ph=Math.random()*Math.PI*2;
    this.hue=Math.random()*360;this.state='approach';this.pressedBtn=false;
    const sp=side===0?cw.spawnA:cw.spawnB;
    const wp=side===0?cw.waitA:cw.waitB;
    const ep=side===0?cw.waitB:cw.waitA;
    const isH=cw.dir==='H';const scatter=5;
    this.x=sp.x+(isH?(Math.random()*scatter*2-scatter):0);
    this.y=sp.y+(isH?0:(Math.random()*scatter*2-scatter));
    this.wx=wp.x+(isH?(Math.random()*4-2):0);
    this.wy=wp.y+(isH?0:(Math.random()*4-2));
    this.ex=ep.x+(isH?(Math.random()*4-2):0);
    this.ey=ep.y+(isH?0:(Math.random()*4-2));
    this.fx=this.ex+(isH?(Math.random()*10-5):(side===0?-6:6));
    this.fy=this.ey+(isH?(side===0?-6:6):(Math.random()*10-5));
  }
  canCross(){return this.cw.pedGo;}
  update(dt,sm){
    if(this.done)return;
    this.age+=dt;const f=sm*dt/16;
    if(this.state==='approach'){
      this._go(this.wx,this.wy,f);
      if(this._near(this.wx,this.wy,5)){this.state='wait';if(!this.pressedBtn){this.pressedBtn=true;this.cw.pressButton();}}
    } else if(this.state==='wait'){
      if(this.canCross()){this.state='cross';totalPedCrosses++;}
    } else if(this.state==='cross'){
      const half=Math.hypot(this.ex-this.wx,this.ey-this.wy)/2;
      const traveled=Math.hypot(this.x-this.wx,this.y-this.wy);
      if(!this.canCross()&&traveled<half){this.state='wait';return;}
      this._go(this.ex,this.ey,f);
      if(this._near(this.ex,this.ey,5))this.state='leave';
    } else {
      this._go(this.fx,this.fy,f*1.2);
      if(this._near(this.fx,this.fy,6))this.done=true;
    }
  }
  _go(tx,ty,f){const dx=tx-this.x,dy=ty-this.y,d=Math.hypot(dx,dy);if(d<.5)return;this.x+=dx/d*Math.min(d,this.spd*f);this.y+=dy/d*Math.min(d,this.spd*f);}
  _near(tx,ty,r){return Math.hypot(tx-this.x,ty-this.y)<r;}
  draw(){
    ctx.save();
    const bob=Math.sin(this.age/120+this.ph)*(this.state==='wait'?0:1.4);
    const col=this.state==='wait'?'#f59e0b':this.state==='cross'?'#22c55e':`hsl(${this.hue},70%,60%)`;
    ctx.fillStyle=col;
    ctx.beginPath();ctx.arc(this.x,this.y-8+bob,3,0,Math.PI*2);ctx.fill();
    ctx.fillRect(this.x-1.8,this.y-5+bob,3.6,6);
    ctx.fillRect(this.x-2.5,this.y+1+bob,2,5);ctx.fillRect(this.x+.5,this.y+1+bob,2,5);
    if(this.state==='wait'){
      ctx.strokeStyle='rgba(245,158,11,.5)';ctx.lineWidth=1.2;
      ctx.beginPath();ctx.arc(this.x,this.y-8,9,0,Math.PI*2);ctx.stroke();
    }
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
function mkL(x,y,nm,gid){return new TLight(x,y,nm,gid);}
function mkP(pts,li,si){return{pts,lightIdx:li,stopIdx:si,cars:[]};}
function makeCW(g,arm){
  const {cx,cy,rTop,rBot,rLeft,rRight,swTopOut,swBotOut,swLeftOut,swRightOut}=g;
  const T=12,M=SW/2;
  let zeb,dir,plx,ply,btnx,btny,wA,wB,sA,sB;
  if(arm==='W'){
    zeb={x:rLeft-T,y:rTop,w:T,h:HR*2};dir='V';
    plx=rLeft-M;ply=swTopOut+4;btnx=rLeft-M+10;btny=swTopOut+M;
    wA={x:rLeft-T/2,y:rTop-3};wB={x:rLeft-T/2,y:rBot+3};
    sA={x:rLeft-T/2,y:swTopOut+4};sB={x:rLeft-T/2,y:swBotOut-4};
  } else if(arm==='E'){
    zeb={x:rRight,y:rTop,w:T,h:HR*2};dir='V';
    plx=rRight+M;ply=swTopOut+4;btnx=rRight+M-10;btny=swTopOut+M;
    wA={x:rRight+T/2,y:rTop-3};wB={x:rRight+T/2,y:rBot+3};
    sA={x:rRight+T/2,y:swTopOut+4};sB={x:rRight+T/2,y:swBotOut-4};
  } else if(arm==='N'){
    zeb={x:rLeft,y:rTop-T,w:HR*2,h:T};dir='H';
    plx=rLeft-M;ply=rTop-T/2;btnx=rLeft-M+8;btny=rTop-T/2+8;
    wA={x:rLeft-3,y:rTop-T/2};wB={x:rRight+3,y:rTop-T/2};
    sA={x:swLeftOut+4,y:rTop-T/2};sB={x:swRightOut-4,y:rTop-T/2};
  } else {
    zeb={x:rLeft,y:rBot,w:HR*2,h:T};dir='H';
    plx=rLeft-M;ply=rBot+T/2;btnx=rLeft-M+8;btny=rBot+T/2-8;
    wA={x:rLeft-3,y:rBot+T/2};wB={x:rRight+3,y:rBot+T/2};
    sA={x:swLeftOut+4,y:rBot+T/2};sB={x:swRightOut-4,y:rBot+T/2};
  }
  return new Crosswalk(zeb,dir,plx,ply,btnx,btny,wA,wB,sA,sB);
}

// ═══════════════════════════════════════════════════════════
// INTERSECTIONS
// ═══════════════════════════════════════════════════════════
function buildT(){
  const W=canvas.width,H=canvas.height,cx=W/2,cy=H/2,m=250;
  lights=[];sensors=[];laneDefs=[];crosswalks=[];sidewalkRects=[];peds=[];
  G=makeGeom(cx,cy);
  const {yE1,yW1,xN1,xS1,rTop,rBot,rLeft,rRight,swTopOut,swBotOut,swLeftOut,swRightOut}=G;
  sidewalkRects.push({x:-m,y:swTopOut,w:W+2*m,h:SW});
  sidewalkRects.push({x:-m,y:rBot,w:W+2*m,h:SW});
  sidewalkRects.push({x:swLeftOut,y:-m,w:SW,h:cy-HR+m});
  sidewalkRects.push({x:rRight,y:-m,w:SW,h:cy-HR+m});
  lights.push(mkL(cx-HR-4,yE1+4,'E-bound →',0));
  lights.push(mkL(cx+HR+4,yW1-8,'W-bound ←',1));
  lights.push(mkL(cx,rTop-4,'Ramal ↓',2));
  sensors.push(new Sensor(cx-HR*2.5,yE1-L/2,HR*0.8,L,0));
  sensors.push(new Sensor(cx+HR*1.4,yW1-L/2,HR*0.8,L,1));
  sensors.push(new Sensor(xS1-L/2,cy-HR*2.5,L,HR*0.8,2));
  crosswalks.push(makeCW(G,'W'));crosswalks.push(makeCW(G,'E'));crosswalks.push(makeCW(G,'N'));
  laneDefs.push(mkP([{x:-m,y:yE1},{x:rLeft,y:yE1},{x:rRight,y:yE1},{x:W+m,y:yE1}],0,1));
  laneDefs.push(mkP([{x:W+m,y:yW1},{x:rRight,y:yW1},{x:rLeft,y:yW1},{x:-m,y:yW1}],1,1));
  laneDefs.push(mkP([{x:xN1,y:-m},{x:xN1,y:rTop},...qbez({x:xN1,y:rTop},{x:xN1,y:yE1},{x:rRight,y:yE1}),{x:W+m,y:yE1}],2,1));
  laneDefs.push(mkP([{x:xS1,y:-m},{x:xS1,y:rTop},...qbez({x:xS1,y:rTop},{x:xS1,y:yW1},{x:rLeft,y:yW1}),{x:-m,y:yW1}],2,1));
  laneDefs.push(mkP([{x:-m,y:yE1},{x:rLeft,y:yE1},...qbez({x:rLeft,y:yE1},{x:xN1,y:yE1},{x:xN1,y:-m})],0,1));
  phaseCtrl=new PhaseController([{gids:[0],name:'🟢 E-bound →'},{gids:[1],name:'🟢 W-bound ←'},{gids:[2],name:'🟢 Ramal ↓'}]);
  idef={name:'INTERSECCIÓN TIPO T — IA ACTIVA',draw(){drawRoadH(cy,-m,W+m);drawRoadV(cx,-m,cy+HR);fillBox(cx-HR,cy-HR,HR*2,HR*2);}};
}

function buildCross(){
  const W=canvas.width,H=canvas.height,cx=W/2,cy=H/2,m=250;
  lights=[];sensors=[];laneDefs=[];crosswalks=[];sidewalkRects=[];peds=[];
  G=makeGeom(cx,cy);
  const {yE1,yE2,yW1,yW2,xN1,xN2,xS1,xS2,rTop,rBot,rLeft,rRight,swTopOut,swBotOut,swLeftOut,swRightOut}=G;
  sidewalkRects.push({x:swLeftOut,y:swTopOut,w:SW,h:SW});sidewalkRects.push({x:rRight,y:swTopOut,w:SW,h:SW});
  sidewalkRects.push({x:swLeftOut,y:rBot,w:SW,h:SW});sidewalkRects.push({x:rRight,y:rBot,w:SW,h:SW});
  sidewalkRects.push({x:-m,y:swTopOut,w:rLeft+m,h:SW});sidewalkRects.push({x:-m,y:rBot,w:rLeft+m,h:SW});
  sidewalkRects.push({x:rRight+SW,y:swTopOut,w:W+m-(rRight+SW),h:SW});sidewalkRects.push({x:rRight+SW,y:rBot,w:W+m-(rRight+SW),h:SW});
  sidewalkRects.push({x:swLeftOut,y:-m,w:SW,h:rTop+m});sidewalkRects.push({x:rRight,y:-m,w:SW,h:rTop+m});
  sidewalkRects.push({x:swLeftOut,y:rBot+SW,w:SW,h:H+m-(rBot+SW)});sidewalkRects.push({x:rRight,y:rBot+SW,w:SW,h:H+m-(rBot+SW)});
  sensors.push(new Sensor(cx-HR*2.5,yE1-L/2,HR*0.8,L*2,0));
  sensors.push(new Sensor(cx+HR*1.4,yW2-L/2,HR*0.8,L*2,1));
  sensors.push(new Sensor(xN1-L/2,cy+HR*1.4,L*2,HR*0.8,2));
  sensors.push(new Sensor(xS1-L/2,cy-HR*2.5,L*2,HR*0.8,3));
  crosswalks.push(makeCW(G,'W'));crosswalks.push(makeCW(G,'E'));crosswalks.push(makeCW(G,'N'));crosswalks.push(makeCW(G,'S'));
  laneDefs.push(mkP([{x:-m,y:yE1},{x:rLeft,y:yE1},{x:rRight,y:yE1},{x:W+m,y:yE1}],0,1));
  laneDefs.push(mkP([{x:-m,y:yE2},{x:rLeft,y:yE2},...qbez({x:rLeft,y:yE2},{x:xS2,y:yE2},{x:xS2,y:rBot}),{x:xS2,y:H+m}],0,1));
  laneDefs.push(mkP([{x:W+m,y:yW1},{x:rRight,y:yW1},{x:rLeft,y:yW1},{x:-m,y:yW1}],1,1));
  laneDefs.push(mkP([{x:W+m,y:yW2},{x:rRight,y:yW2},...qbez({x:rRight,y:yW2},{x:xN2,y:yW2},{x:xN2,y:rTop}),{x:xN2,y:-m}],1,1));
  laneDefs.push(mkP([{x:xN1,y:H+m},{x:xN1,y:rBot},{x:xN1,y:rTop},{x:xN1,y:-m}],2,1));
  laneDefs.push(mkP([{x:xN2,y:H+m},{x:xN2,y:rBot},...qbez({x:xN2,y:rBot},{x:xN2,y:yE2},{x:rRight,y:yE2}),{x:W+m,y:yE2}],2,1));
  laneDefs.push(mkP([{x:xS1,y:-m},{x:xS1,y:rTop},{x:xS1,y:rBot},{x:xS1,y:H+m}],3,1));
  laneDefs.push(mkP([{x:xS2,y:-m},{x:xS2,y:rTop},...qbez({x:xS2,y:rTop},{x:xS2,y:yW2},{x:rLeft,y:yW2}),{x:-m,y:yW2}],3,1));
  lights.length=0;
  lights.push(mkL(cx-HR-4,yE1+4,'E-bound →',0));lights.push(mkL(cx+HR+4,yW1-8,'W-bound ←',1));
  lights.push(mkL(cx+HR/2,rBot+4,'N-bound ↑',2));lights.push(mkL(cx-HR/2,rTop-4,'S-bound ↓',3));
  phaseCtrl=new PhaseController([{gids:[0],name:'🟢 E-bound →'},{gids:[1],name:'🟢 W-bound ←'},{gids:[2],name:'🟢 N-bound ↑'},{gids:[3],name:'🟢 S-bound ↓'}]);
  idef={name:'CRUCE EN CRUZ (+) — IA ACTIVA',draw(){drawRoadH(cy,-m,W+m);drawRoadV(cx,-m,H+m);fillBox(cx-HR,cy-HR,HR*2,HR*2);}};
}

function buildDoubleY(){
  const W=canvas.width,H=canvas.height,cy=H/2,m=250;
  const cx1=Math.round(W*0.34),cx2=Math.round(W*0.66);
  lights=[];sensors=[];laneDefs=[];crosswalks=[];sidewalkRects=[];peds=[];
  const g1=makeGeom(cx1,cy),g2=makeGeom(cx2,cy);
  G=g1;
  const {yE1,yW1}=g1;
  sidewalkRects.push({x:-m,y:g1.swTopOut,w:W+2*m,h:SW});sidewalkRects.push({x:-m,y:g1.rBot,w:W+2*m,h:SW});
  sidewalkRects.push({x:g1.swLeftOut,y:-m,w:SW,h:cy-HR+m});sidewalkRects.push({x:g1.rRight,y:-m,w:SW,h:cy-HR+m});
  sidewalkRects.push({x:g2.swLeftOut,y:cy+HR+SW,w:SW,h:H+m-(cy+HR+SW)});sidewalkRects.push({x:g2.rRight,y:cy+HR+SW,w:SW,h:H+m-(cy+HR+SW)});
  lights.push(mkL(cx1-HR-4,yE1+4,'J1 →',0));lights.push(mkL(cx1+HR+4,yW1-8,'J1 ←',1));lights.push(mkL(cx1,g1.rTop-4,'J1 ↓',2));
  lights.push(mkL(cx2-HR-4,yE1+4,'J2 →',3));lights.push(mkL(cx2+HR+4,yW1-8,'J2 ←',4));lights.push(mkL(cx2,g2.rBot+4,'J2 ↑',5));
  sensors.push(new Sensor(cx1-HR*2.5,yE1-L/2,HR*0.8,L,0));sensors.push(new Sensor(cx1+HR*1.4,yW1-L/2,HR*0.8,L,1));
  sensors.push(new Sensor(g1.xS1-L/2,cy-HR*2.5,L,HR*0.8,2));sensors.push(new Sensor(cx2-HR*2.5,yE1-L/2,HR*0.8,L,3));
  sensors.push(new Sensor(cx2+HR*1.4,yW1-L/2,HR*0.8,L,4));sensors.push(new Sensor(g2.xN1-L/2,cy+HR*1.4,L,HR*0.8,5));
  crosswalks.push(makeCW(g1,'W'));crosswalks.push(makeCW(g1,'E'));crosswalks.push(makeCW(g1,'N'));
  crosswalks.push(makeCW(g2,'W'));crosswalks.push(makeCW(g2,'E'));crosswalks.push(makeCW(g2,'S'));
  laneDefs.push(mkP([{x:-m,y:yE1},{x:cx1-HR,y:yE1},{x:cx1+HR,y:yE1},{x:cx2-HR,y:yE1},{x:cx2+HR,y:yE1},{x:W+m,y:yE1}],0,1));
  laneDefs.push(mkP([{x:W+m,y:yW1},{x:cx2+HR,y:yW1},{x:cx2-HR,y:yW1},{x:cx1+HR,y:yW1},{x:cx1-HR,y:yW1},{x:-m,y:yW1}],4,3));
  laneDefs.push(mkP([{x:g1.xN1,y:-m},{x:g1.xN1,y:g1.rTop},...qbez({x:g1.xN1,y:g1.rTop},{x:g1.xN1,y:yE1},{x:cx1+HR,y:yE1}),{x:W+m,y:yE1}],2,1));
  laneDefs.push(mkP([{x:g1.xS1,y:-m},{x:g1.xS1,y:g1.rTop},...qbez({x:g1.xS1,y:g1.rTop},{x:g1.xS1,y:yW1},{x:cx1-HR,y:yW1}),{x:-m,y:yW1}],2,1));
  laneDefs.push(mkP([{x:g2.xN1,y:H+m},{x:g2.xN1,y:g2.rBot},...qbez({x:g2.xN1,y:g2.rBot},{x:g2.xN1,y:yW1},{x:cx2-HR,y:yW1}),{x:-m,y:yW1}],5,1));
  laneDefs.push(mkP([{x:g2.xS1,y:H+m},{x:g2.xS1,y:g2.rBot},...qbez({x:g2.xS1,y:g2.rBot},{x:g2.xS1,y:yE1},{x:cx2+HR,y:yE1}),{x:W+m,y:yE1}],5,1));
  phaseCtrl=new PhaseController([{gids:[0],name:'🟢 J1 →'},{gids:[1],name:'🟢 J1 ←'},{gids:[2],name:'🟢 J1 Ramal'},{gids:[3],name:'🟢 J2 →'},{gids:[4],name:'🟢 J2 ←'},{gids:[5],name:'🟢 J2 Ramal'}]);
  idef={name:'DOBLE CRUCE EN Y — IA ACTIVA',draw(){
    drawRoadH(cy,-m,W+m);drawRoadV(cx1,-m,cy+HR);drawRoadV(cx2,cy-HR,H+m);
    fillBox(cx1-HR,cy-HR,HR*2,HR*2);fillBox(cx2-HR,cy-HR,HR*2,HR*2);
  }};
}

// ═══════════════════════════════════════════════════════════
// BUILD + SELECT
// ═══════════════════════════════════════════════════════════
const BUILDERS=[buildT,buildCross,buildDoubleY];
const NAMES=['INTERSECCIÓN TIPO T — IA ACTIVA','CRUCE EN CRUZ (+) — IA ACTIVA','DOBLE CRUCE EN Y — IA ACTIVA'];
function build(i){
  cars=[];peds=[];pedBtnPresses=0;totalPedCrosses=0;aiLog=[];
  BUILDERS[i]();
  for(const l of laneDefs)l.cars=[];
  document.getElementById('intersectionLabel').textContent=NAMES[i];
  renderSig();renderSens();updatePhaseDisplay();renderAILog();
}
function selectIntersection(i){
  curIdx=i;document.querySelectorAll('.ibtn').forEach((b,j)=>b.classList.toggle('active',i===j));
  resetSim();
}

// ═══════════════════════════════════════════════════════════
// SPAWN
// ═══════════════════════════════════════════════════════════
function spawnCar(){
  if(!laneDefs.length)return;
  const shuffled=[...laneDefs].sort(()=>Math.random()-0.5);
  for(const ld of shuffled){
    const active=ld.cars.filter(c=>!c.done);
    if(active.length>=5)continue;
    if(active.some(c=>c._arc<SAFE_GAP*2+CAR_L))continue;
    const c=new Car(ld);ld.cars.push(c);cars.push(c);return;
  }
}
function spawnPed(){
  if(!crosswalks.length)return;
  const cw=crosswalks[Math.floor(Math.random()*crosswalks.length)];
  peds.push(new Ped(cw,Math.round(Math.random())));
}
function manualPedRequest(){
  if(!phaseCtrl||!crosswalks.length)return;
  if(phaseCtrl.pedActive||phaseCtrl.pedQueued||phaseCtrl.pedCooldown>0){
    document.getElementById('pedStatus').textContent='⏳ Cooldown activo';
    document.getElementById('pedStatus').style.color='var(--muted)';return;
  }
  crosswalks[0].pressButton();
}

function demand(min){
  const h=min/60;
  if(h>=7&&h<9)return 2.3;if(h>=12&&h<13)return 1.85;
  if(h>=17&&h<19.5)return 2.6;if(h>=22||h<6)return 0.35;return 1.0;
}

// ═══════════════════════════════════════════════════════════
// MAIN LOOP
// ═══════════════════════════════════════════════════════════
function loop(ts){
  if(!running)return;
  const dt=Math.min(ts-lastTime,50);lastTime=ts;
  const eff=dt*simSpeed;
  dayMin+=eff/3000;if(dayMin>=1440)dayMin-=1440;
  const dem=demand(dayMin);
  if(phaseCtrl)phaseCtrl.update(eff);
  for(const s of sensors)s.check();
  for(const cw of crosswalks)cw.update(eff);
  spawnT-=dt;
  if(spawnT<=0){spawnT=1600/(dem*simSpeed);if(cars.filter(c=>!c.done).length<55)spawnCar();}
  pedSpawnT-=dt;
  if(pedSpawnT<=0){pedSpawnT=9000/simSpeed;if(peds.length<14&&peds.filter(p=>p.state==='wait').length<4)spawnPed();}
  for(const c of cars)c.update(eff,1);
  for(const ld of laneDefs)ld.cars=ld.cars.filter(c=>!c.done);
  cars=cars.filter(c=>!c.done);
  for(const p of peds)p.update(eff,1);
  peds=peds.filter(p=>!p.done);
  flowT-=dt;flowCnt+=cars.filter(c=>!c.waiting).length*dt/1000;
  if(flowT<=0){flowT=5000;carHist.push(Math.round(flowCnt));if(carHist.length>20)carHist.shift();flowCnt=0;updateCharts();}
  // IA tick ~cada 1s real
  aiTickT-=dt;
  if(aiTickT<=0){aiTickT=1000;runAI();}
  const bkt=Math.floor(((dayMin/60-6+18)%18)/1.5);
  if(bkt>=0&&bkt<peakData.length)peakData[bkt]=Math.min(100,peakData[bkt]+cars.length*eff/55000);
  drawBg();
  for(const sw of sidewalkRects)drawSidewalk(sw.x,sw.y,sw.w,sw.h);
  idef.draw();
  for(const cw of crosswalks)cw.draw();
  for(const s of sensors)s.draw();
  for(const p of peds)p.draw();
  for(const c of cars)c.draw();
  for(const l of lights)l.draw();
  drawHUD();updateStats(dem);
  animId=requestAnimationFrame(loop);
}

function drawBg(){
  const W=canvas.width,H=canvas.height;
  ctx.fillStyle='#060a12';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(16,30,50,.4)';ctx.lineWidth=.5;
  for(let x=0;x<W;x+=44){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=44){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
}

function drawHUD(){
  const W=canvas.width,H=canvas.height,h=Math.floor(dayMin/60)%24,m=Math.floor(dayMin%60),d=demand(dayMin);
  ctx.save();
  ctx.font='bold 12px "Space Mono",monospace';ctx.fillStyle='rgba(0,229,255,.85)';ctx.textAlign='right';
  ctx.fillText('⏱ '+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'),W-14,H-14);
  const lbl=d>=2?'🔴 HORA PICO':d>=1.5?'🟡 ALTO FLUJO':d<=0.5?'⚪ BAJO FLUJO':'🟢 FLUJO NORMAL';
  ctx.font='600 11px Rajdhani,sans-serif';ctx.fillStyle=d>=2?'#ef4444':d>=1.5?'#eab308':'#22c55e';
  ctx.fillText(lbl,W-14,H-30);
  // IA badge en HUD
  ctx.font='bold 10px "Space Mono",monospace';ctx.fillStyle='rgba(0,255,204,.7)';ctx.textAlign='left';
  ctx.fillText('🧠 IA +'+Math.round(totalSaved)+'s ahorrados',14,H-14);
  if(phaseCtrl&&phaseCtrl.pedActive){
    const r=Math.max(0,Math.ceil(phaseCtrl.pedTimer/1000));
    ctx.font='bold 12px "Space Mono",monospace';ctx.fillStyle='#a855f7';ctx.textAlign='center';
    ctx.fillText(`🚶 FASE PEATONAL — ${r}s`,W/2,34);
  } else if(phaseCtrl&&phaseCtrl.pedCooldown>0){
    const cd=Math.ceil(phaseCtrl.pedCooldown/1000);
    ctx.font='600 10px Rajdhani,sans-serif';ctx.fillStyle='rgba(74,96,128,.6)';ctx.textAlign='center';
    ctx.fillText(`Botón peatonal en ${cd}s`,W/2,32);
  }
  ctx.restore();
}

function updateStats(dem){
  const mov=cars.filter(c=>!c.waiting);
  const spd=mov.length>0?(mov.reduce((a,c)=>a+c.spd,0)/mov.length*16).toFixed(1):'0.0';
  const wait=cars.filter(c=>c.waiting);
  const wt=wait.length>0?Math.round(wait.reduce((a,c)=>a+c.waitTime,0)/wait.length/1000):0;
  document.getElementById('statCars').textContent=cars.length;
  document.getElementById('statPed').textContent=peds.length;
  document.getElementById('statSpeed').textContent=spd+' km/h';
  document.getElementById('statWait').textContent=wt+'s';
  document.getElementById('statBtn').textContent=pedBtnPresses;
  document.getElementById('statPedCross').textContent=totalPedCrosses;
  document.getElementById('statSaved').textContent=Math.round(totalSaved)+'s';
  document.getElementById('statTotal').textContent=totalThru.toLocaleString();
  renderSig();renderSens();updatePeakBars();updatePhaseDisplay();
}

function renderSig(){
  const pt=phaseCtrl?Math.max(0,Math.round(phaseCtrl.timer/1000)):0;
  document.getElementById('signalStatus').innerHTML=lights.map(l=>{
    const t=l.state==='green'?pt+'s':l.state==='yellow'?'⚠':'-';
    const pressColor=l.pressure>60?'#ef4444':l.pressure>30?'#eab308':'#00ffcc';
    const pressPct=Math.round(l.pressure);
    return `<div class="sigrow">
      <span>${l.name}</span>
      <div style="display:flex;align-items:center;gap:5px">
        <span class="sigtimer">${t}</span>
        <div class="sigind ${l.state}"></div>
      </div>
      ${l.pressure>3?`<div class="sig-ia-info">🧠 Cola:${l.queueAhead} Pres:${pressPct}%
        <div class="pbar-wrap"><div class="pbar-bg"><div class="pbar-fill" style="width:${pressPct}%;background:${pressColor}"></div></div></div>
      </div>`:''}
    </div>`;
  }).join('');
}

function renderSens(){
  const a=sensors.filter(s=>s.active).length;
  document.getElementById('sensorDots').innerHTML=sensors.map(s=>`<div class="sdot ${s.active?'active':''}"></div>`).join('');
  document.getElementById('sensorLabel').textContent=`${a}/${sensors.length} activos`;
}
function updatePhaseDisplay(){
  if(!phaseCtrl)return;
  document.getElementById('phaseDisplay').textContent=phaseCtrl.getPhaseName();
  const bar=document.getElementById('phaseBar'),n=phaseCtrl.phases.length;
  if(bar.children.length!==n+1){bar.innerHTML='';for(let i=0;i<=n;i++){const s=document.createElement('div');s.className='phase-seg inactive';bar.appendChild(s);}}
  [...bar.children].forEach((seg,i)=>{
    if(i===n){seg.className=phaseCtrl.state==='ped'?'phase-seg ped':'phase-seg inactive';return;}
    if(phaseCtrl.state==='allred'||phaseCtrl.state==='yellow'){seg.className='phase-seg yellow';return;}
    seg.className='phase-seg'+(i===phaseCtrl.cur&&phaseCtrl.state==='green'?' active':' inactive');
  });
}
function updatePeakBars(){
  const bars=document.getElementById('peakBars');
  if(bars.children.length!==peakData.length)bars.innerHTML=peakData.map(()=>`<div class="pbar"></div>`).join('');
  const peaks=[1,2,4,5,8,9],cur=Math.floor(((dayMin/60-6+18)%18)/1.5);
  [...bars.children].forEach((b,i)=>{b.style.height=Math.max(2,peakData[i])+'%';b.className='pbar'+(peaks.includes(i)?' peak':'')+(i===cur?' cur':'');});
  const h=Math.floor(dayMin/60)%24,m=Math.floor(dayMin%60);
  document.getElementById('peakLabel').textContent=`Hora: ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

let fChart,gChart,dChart,pBtnChart,sChart;
function initCharts(){
  const base={type:'line',options:{animation:false,responsive:true,plugins:{legend:{display:false}},scales:{x:{display:false},y:{display:false,min:0}},elements:{point:{radius:0}}}};
  fChart=new Chart(document.getElementById('flowChart'),{...base,data:{labels:new Array(20).fill(''),datasets:[{data:new Array(20).fill(0),borderColor:'rgba(0,229,255,.8)',backgroundColor:'rgba(0,229,255,.07)',fill:true,borderWidth:1.5,tension:.4}]}});
  gChart=new Chart(document.getElementById('greenChart'),{...base,data:{labels:new Array(20).fill(''),datasets:[{data:new Array(20).fill(0),borderColor:'rgba(34,197,94,.8)',backgroundColor:'rgba(34,197,94,.07)',fill:true,borderWidth:1.5,tension:.4}]}});
  pBtnChart=new Chart(document.getElementById('pedBtnChart'),{...base,data:{labels:new Array(20).fill(''),datasets:[{data:new Array(20).fill(0),borderColor:'rgba(168,85,247,.8)',backgroundColor:'rgba(168,85,247,.07)',fill:true,borderWidth:1.5,tension:.4}]}});
  sChart=new Chart(document.getElementById('savedChart'),{...base,data:{labels:new Array(20).fill(''),datasets:[{data:new Array(20).fill(0),borderColor:'rgba(0,255,204,.8)',backgroundColor:'rgba(0,255,204,.07)',fill:true,borderWidth:1.5,tension:.4}]}});
  dChart=new Chart(document.getElementById('densityChart'),{type:'bar',data:{labels:lights.length?lights.map(l=>l.name.slice(-2)):['N','S','E','O'],datasets:[{data:lights.length?lights.map(()=>0):[0,0,0,0],backgroundColor:['rgba(0,229,255,.65)','rgba(255,107,53,.65)','rgba(168,85,247,.65)','rgba(127,255,0,.65)','rgba(0,255,204,.65)','rgba(234,179,8,.65)'],borderWidth:0,borderRadius:3}]},options:{animation:{duration:250},responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'rgba(200,216,240,.4)',font:{size:8}},grid:{display:false}},y:{display:false,min:0,max:100}}}});
}
function updateCharts(){
  if(!fChart)return;
  const pad=a=>{const r=[...a];while(r.length<20)r.unshift(0);return r.slice(-20);};
  fChart.data.datasets[0].data=pad(carHist);fChart.update('none');
  const ag=phaseCtrl?Math.round(phaseCtrl.timer/1000):0;
  greenHist.push(ag);if(greenHist.length>20)greenHist.shift();
  gChart.data.datasets[0].data=pad(greenHist);gChart.update('none');
  pedBtnHist.push(pedBtnPresses);if(pedBtnHist.length>20)pedBtnHist.shift();
  pBtnChart.data.datasets[0].data=pad(pedBtnHist);pBtnChart.update('none');
  sChart.data.datasets[0].data=pad(savedHist);sChart.update('none');
  // densidad = presión IA por semáforo
  dChart.data.labels=lights.map(l=>l.name.slice(-3));
  dChart.data.datasets[0].data=lights.map(l=>Math.round(l.pressure));
  dChart.update('none');
}

function toggleSim(){
  running=!running;
  const btn=document.getElementById('playBtn');
  if(running){btn.textContent='⏸ PAUSA';lastTime=performance.now();animId=requestAnimationFrame(loop);}
  else{btn.textContent='▶ INICIAR';if(animId)cancelAnimationFrame(animId);}
}
function resetSim(){
  running=false;if(animId)cancelAnimationFrame(animId);
  document.getElementById('playBtn').textContent='▶ INICIAR';
  cars=[];peds=[];totalThru=0;carHist=[];greenHist=[];peakData=new Array(12).fill(0);
  pedBtnPresses=0;pedBtnHist=[];totalPedCrosses=0;dayMin=360;flowCnt=0;spawnT=0;pedSpawnT=0;
  totalSaved=0;savedHist=[];aiLog=[];aiTickT=0;
  document.getElementById('pedStatus').textContent='Sin solicitud';document.getElementById('pedStatus').style.color='var(--muted)';
  build(curIdx);drawBg();for(const sw of sidewalkRects)drawSidewalk(sw.x,sw.y,sw.w,sw.h);
  idef.draw();for(const cw of crosswalks)cw.draw();for(const l of lights)l.draw();
  if(fChart){
    fChart.data.datasets[0].data=new Array(20).fill(0);fChart.update('none');
    gChart.data.datasets[0].data=new Array(20).fill(0);gChart.update('none');
    pBtnChart.data.datasets[0].data=new Array(20).fill(0);pBtnChart.update('none');
    sChart.data.datasets[0].data=new Array(20).fill(0);sChart.update('none');
    dChart.data.datasets[0].data=lights.map(()=>0);dChart.update('none');
  }
  updateStats(1);updatePhaseDisplay();renderAILog();
}
function setSpeed(v){simSpeed=parseInt(v);document.getElementById('speedVal').textContent='×'+v;}

window.addEventListener('load',()=>{
  resize();initCharts();
  drawBg();for(const sw of sidewalkRects)drawSidewalk(sw.x,sw.y,sw.w,sw.h);
  idef.draw();for(const cw of crosswalks)cw.draw();for(const l of lights)l.draw();
  updateStats(1);updatePeakBars();updatePhaseDisplay();renderAILog();
});