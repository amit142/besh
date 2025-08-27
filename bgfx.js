// Plexus / particle background placeholder
// Future enhancement: animated canvas network.
export function initBackground() {
  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'bgfx';
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: '-2',
    background: 'linear-gradient(135deg, #2c1810 0%, #3e261a 50%, #5d3e2b 100%)'
  });
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  const DPR = window.devicePixelRatio || 1;
  function resize(){
    canvas.width = innerWidth * DPR; canvas.height = innerHeight * DPR; canvas.style.width = innerWidth+'px'; canvas.style.height = innerHeight+'px';
  }
  resize();
  window.addEventListener('resize', resize);
  // Subtle gold particles for wood grain effect
  const dots = Array.from({length:40}, ()=> ({
    x: Math.random()*canvas.width,
    y: Math.random()*canvas.height,
    r: 0.5 + Math.random()*1.5,
    dx: (Math.random()-.5)*0.1,
    dy: (Math.random()-.5)*0.1,
    opacity: 0.1 + Math.random()*0.2
  }));
  function frame(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.globalAlpha = 0.35;
    dots.forEach(d=>{
      d.x+=d.dx; d.y+=d.dy;
      if (d.x < 0 || d.x > canvas.width) d.dx*=-1;
      if (d.y < 0 || d.y > canvas.height) d.dy*=-1;
    });
    // draw connections
    ctx.lineWidth = 0.5 * DPR;
    for (let i=0;i<dots.length;i++){
      for (let j=i+1;j<dots.length;j++){
        const a=dots[i], b=dots[j];
        const dx=a.x-b.x, dy=a.y-b.y; const dist=Math.hypot(dx,dy);
        if (dist < 100*DPR){
          const alp = 1 - dist/(100*DPR);
            ctx.strokeStyle = `rgba(212,175,55,${alp*0.1})`;
            ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
    dots.forEach(d=>{
      ctx.beginPath();
      const grd = ctx.createRadialGradient(d.x,d.y,0,d.x,d.y,d.r*2*DPR);
      grd.addColorStop(0,`rgba(212,175,55,${d.opacity})`); grd.addColorStop(1,'transparent');
      ctx.fillStyle = grd; ctx.arc(d.x,d.y,d.r*3*DPR,0,Math.PI*2); ctx.fill();
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Auto-init when imported
initBackground();
