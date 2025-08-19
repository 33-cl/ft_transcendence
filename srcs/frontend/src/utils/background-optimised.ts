// // Fond étoilé optimisé sans trou noir
// const STAR_COUNT = 800;
// const STAR_SIZE_RANGE = [0.5, 2];
// const STAR_OPACITY_RANGE = [0.2, 1];
// const SHOOTING_STAR_COUNT = 2;
// const SHOOTING_STAR_SPAWN_RATE = 0.005;
// const SHOOTING_STAR_SPEED_RANGE = [4, 8];
// const SHOOTING_STAR_LENGTH_RANGE = [60, 120];
// const SHOOTING_STAR_OPACITY = 0.7;
// const SHOOTING_STAR_FADE_RATE = 0.03;
// const ATTRACTION_RADIUS = 80;
// const EASE = 0.12;

// let mouseX = window.innerWidth / 2;
// let mouseY = window.innerHeight / 2;

// class Star {
//   angle;
//   distance;
//   size;
//   opacity;
//   speed;
//   x;
//   y;
//   targetX;
//   targetY;
//   attractionTimer = 0;

//   constructor(centerX, centerY) {
//     this.angle = Math.random() * Math.PI * 2;
//     this.distance = Math.pow(Math.random(), 0.7) * (centerX * 1.2);
//     this.size = Math.random() * (STAR_SIZE_RANGE[1] - STAR_SIZE_RANGE[0]) + STAR_SIZE_RANGE[0];
//     this.opacity = Math.random() * (STAR_OPACITY_RANGE[1] - STAR_OPACITY_RANGE[0]) + STAR_OPACITY_RANGE[0];
//     this.speed = 0.0007 + Math.random() * 0.001;
//     this.x = centerX + Math.cos(this.angle) * this.distance;
//     this.y = centerY + Math.sin(this.angle) * this.distance;
//     this.targetX = this.x;
//     this.targetY = this.y;
//   }

//   update(centerX, centerY) {
//     this.angle += this.speed;
//     const orbitX = centerX + Math.cos(this.angle) * this.distance;
//     const orbitY = centerY + Math.sin(this.angle) * this.distance;
//     if (this.attractionTimer > 0) {
//       this.x += (this.targetX - this.x) * (EASE * 0.5);
//       this.y += (this.targetY - this.y) * (EASE * 0.5);
//       this.attractionTimer -= 16;
//     } else {
//       this.targetX = orbitX;
//       this.targetY = orbitY;
//       this.x += (this.targetX - this.x) * EASE;
//       this.y += (this.targetY - this.y) * EASE;
//     }
//   }

//   draw(ctx) {
//     ctx.beginPath();
//     ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
//     ctx.fillStyle = `rgba(255,255,255,${this.opacity})`;
//     ctx.fill();
//   }
// }

// class ShootingStar {
//   x; y; velocityX; velocityY; length; opacity; maxOpacity; tailPoints = []; active = true; lifespan; age = 0; baseSpeed;
//   constructor(canvasWidth, canvasHeight) {
//     const side = Math.floor(Math.random() * 4);
//     const speed = Math.random() * (SHOOTING_STAR_SPEED_RANGE[1] - SHOOTING_STAR_SPEED_RANGE[0]) + SHOOTING_STAR_SPEED_RANGE[0];
//     switch (side) {
//       case 0: this.x = Math.random() * canvasWidth; this.y = -40; this.velocityX = (Math.random() - 0.5) * speed; this.velocityY = speed; break;
//       case 1: this.x = canvasWidth + 40; this.y = Math.random() * canvasHeight; this.velocityX = -speed; this.velocityY = (Math.random() - 0.5) * speed; break;
//       case 2: this.x = Math.random() * canvasWidth; this.y = canvasHeight + 40; this.velocityX = (Math.random() - 0.5) * speed; this.velocityY = -speed; break;
//       default: this.x = -40; this.y = Math.random() * canvasHeight; this.velocityX = speed; this.velocityY = (Math.random() - 0.5) * speed; break;
//     }
//     this.length = Math.random() * (SHOOTING_STAR_LENGTH_RANGE[1] - SHOOTING_STAR_LENGTH_RANGE[0]) + SHOOTING_STAR_LENGTH_RANGE[0];
//     this.maxOpacity = SHOOTING_STAR_OPACITY;
//     this.opacity = 0;
//     this.lifespan = 120 + Math.random() * 80;
//     this.baseSpeed = speed;
//   }
//   update(canvasWidth, canvasHeight) {
//     this.age++;
//     const lifeProgress = this.age / this.lifespan;
//     if (lifeProgress < 0.2) this.opacity = (lifeProgress / 0.2) * this.maxOpacity;
//     else if (lifeProgress < 0.7) this.opacity = this.maxOpacity;
//     else this.opacity = this.maxOpacity * (1 - (lifeProgress - 0.7) / 0.3);
//     this.x += this.velocityX;
//     this.y += this.velocityY;
//     this.tailPoints.push({ x: this.x, y: this.y, opacity: this.opacity });
//     if (this.tailPoints.length > this.length / 5) this.tailPoints.shift();
//     this.tailPoints.forEach(point => { point.opacity -= SHOOTING_STAR_FADE_RATE * 1.5; });
//     this.tailPoints = this.tailPoints.filter(point => point.opacity > 0.01);
//     if (this.age >= this.lifespan || (this.opacity <= 0.01 && this.tailPoints.length === 0)) this.active = false;
//     if (this.x < -100 || this.x > canvasWidth + 100 || this.y < -100 || this.y > canvasHeight + 100) this.active = false;
//   }
//   draw(ctx) {
//     if (this.tailPoints.length < 2) return;
//     ctx.strokeStyle = 'rgba(255,255,255,0)'; ctx.lineWidth = 2;
//     for (let i = 1; i < this.tailPoints.length; i++) {
//       const p = this.tailPoints[i], prev = this.tailPoints[i - 1];
//       const grad = ctx.createLinearGradient(prev.x, prev.y, p.x, p.y);
//       grad.addColorStop(0, `rgba(255,255,255,${prev.opacity * 0.3})`);
//       grad.addColorStop(1, `rgba(255,255,255,${p.opacity})`);
//       ctx.strokeStyle = grad;
//       ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke();
//     }
//     const head = this.tailPoints[this.tailPoints.length - 1];
//     if (head) {
//       ctx.beginPath(); ctx.arc(head.x, head.y, 2, 0, Math.PI * 2);
//       ctx.fillStyle = `rgba(255,255,255,${head.opacity})`;
//       ctx.fill();
//     }
//   }
// }

// class Starfield {
//   canvas; ctx; stars = []; shootingStars = [];
//   constructor(canvasId) {
//     const canvas = document.getElementById(canvasId);
//     if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Canvas non trouvé');
//     this.canvas = canvas;
//     const ctx = this.canvas.getContext('2d');
//     if (!ctx) throw new Error('Contexte 2D non trouvé');
//     this.ctx = ctx;
//     this.init();
//   }
//   init() {
//     this.canvas.style.position = 'fixed';
//     this.canvas.style.top = '0';
//     this.canvas.style.left = '0';
//     this.canvas.style.width = '100%';
//     this.canvas.style.height = '100%';
//     this.canvas.style.zIndex = '0';
//     this.resizeCanvas();
//     this.createStars();
//     this.setupEvents();
//     this.animate();
//   }
//   resizeCanvas() {
//     this.canvas.width = window.innerWidth;
//     this.canvas.height = window.innerHeight;
//     this.createStars();
//   }
//   createStars() {
//     const cx = this.canvas.width / 2, cy = this.canvas.height / 2;
//     this.stars = Array.from({ length: STAR_COUNT }, () => new Star(cx, cy));
//   }
//   spawnShootingStar() {
//     if (this.shootingStars.length < SHOOTING_STAR_COUNT && Math.random() < SHOOTING_STAR_SPAWN_RATE) {
//       this.shootingStars.push(new ShootingStar(this.canvas.width, this.canvas.height));
//     }
//   }
//   updateShootingStars() {
//     this.shootingStars.forEach(star => star.update(this.canvas.width, this.canvas.height));
//     this.shootingStars = this.shootingStars.filter(star => star.active);
//   }
//   setupEvents() {
//     window.addEventListener('resize', () => this.resizeCanvas());
//     window.addEventListener('mousemove', e => {
//       mouseX = e.clientX;
//       mouseY = e.clientY;
//     });
//     window.addEventListener('touchmove', e => {
//       const t = e.touches[0];
//       if (!t) return;
//       mouseX = t.clientX;
//       mouseY = t.clientY;
//     });
//   }
//   attractStars() {
//     this.stars.forEach(star => {
//       const dx = star.x - mouseX, dy = star.y - mouseY, dist = Math.sqrt(dx * dx + dy * dy);
//       if (dist < ATTRACTION_RADIUS) {
//         star.targetX = mouseX;
//         star.targetY = mouseY;
//         star.attractionTimer = 400;
//       }
//     });
//   }
//   draw() {
//     this.ctx.fillStyle = '#000';
//     this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
//     this.attractStars();
//     this.stars.forEach(star => { star.update(this.canvas.width / 2, this.canvas.height / 2); star.draw(this.ctx); });
//     this.spawnShootingStar();
//     this.updateShootingStars();
//     this.shootingStars.forEach(star => star.draw(this.ctx));
//   }
//   animate() {
//     this.draw();
//     requestAnimationFrame(this.animate.bind(this));
//   }
// }

// window.addEventListener('DOMContentLoaded', () => {
//   new Starfield('background');
// });
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('background');
  if (!(canvas instanceof HTMLCanvasElement)) return;
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.zIndex = '0';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
});
