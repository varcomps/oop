let starSystem = { active: false, starType: 'G', starSize: 30, starColor: '#ffcc00', coronaColor: '#ffe57f', planets: [] };

function generateRealRandomSystem() {
    starSystem.active = true;
    const STAR_TYPES = [
        { type: 'M', color: '#ff5252', corona: '#ff8a80', sizeMult: 0.8 },
        { type: 'K', color: '#ff9800', corona: '#ffcc80', sizeMult: 0.9 },
        { type: 'G', color: '#ffeb3b', corona: '#fff59d', sizeMult: 1.0 },
        { type: 'F', color: '#fff9c4', corona: '#ffffff', sizeMult: 1.1 },
        { type: 'A', color: '#e0f7fa', corona: '#ffffff', sizeMult: 1.2 },
        { type: 'B', color: '#40c4ff', corona: '#80d8ff', sizeMult: 1.5 },
        { type: 'N', color: '#b388ff', corona: '#651fff', sizeMult: 0.4 }
    ];
    const starData = STAR_TYPES[Math.floor(Math.random() * STAR_TYPES.length)];
    starSystem.starColor = starData.color;
    starSystem.coronaColor = starData.corona;
    starSystem.starSize = 30 * starData.sizeMult + (Math.random() * 10);
    starSystem.starX = Math.random() * (canvas.width * 0.6) + canvas.width * 0.2;
    starSystem.starY = Math.random() * (canvas.height * 0.6) + canvas.height * 0.2;
    
    starSystem.planets = [];
    const planetCount = Math.floor(Math.random() * 6) + 1; 
    let currentDist = 80 + starSystem.starSize; 

    for(let i=0; i<planetCount; i++) {
        currentDist += 40 + Math.random() * 60;
        let pColor; const rand = Math.random();
        if (currentDist < 200) pColor = rand > 0.5 ? '#d84315' : '#8d6e63'; 
        else if (currentDist > 400) pColor = rand > 0.6 ? '#81d4fa' : '#3f51b5'; 
        else pColor = rand > 0.7 ? '#4caf50' : '#ffcc80'; 

        starSystem.planets.push({
            dist: currentDist, angle: Math.random() * Math.PI * 2,
            speed: (0.002 + Math.random() * 0.008) * (Math.random() > 0.5 ? 1 : -1),
            size: 5 + Math.random() * 8, color: pColor, hasRing: Math.random() > 0.8
        });
    }
}

function updateSystemPhysics() {
    if (!starSystem.active) return;
    const sDx = starSystem.starX - mapShip.x;
    const sDy = starSystem.starY - mapShip.y;
    const sDist = Math.hypot(sDx, sDy);
    
    // Гравитация звезды
    if (sDist < starSystem.starSize * 15) { 
        const force = 3.0 / (sDist * 0.8 + 200); 
        mapShip.vx += (sDx / sDist) * force; mapShip.vy += (sDy / sDist) * force;
    }
    // Столкновение со звездой
    if (sDist < starSystem.starSize + 4) {
         const nx = sDx / sDist, ny = sDy / sDist;
         const overlap = (starSystem.starSize + 4) - sDist;
         mapShip.x -= nx * overlap; mapShip.y -= ny * overlap;
         const dot = mapShip.vx * nx + mapShip.vy * ny;
         mapShip.vx = (mapShip.vx - 2 * dot * nx) * 0.5; mapShip.vy = (mapShip.vy - 2 * dot * ny) * 0.5;
    }

    // Планеты
    starSystem.planets.forEach(p => {
        const pX = starSystem.starX + Math.cos(p.angle) * p.dist;
        const pY = starSystem.starY + Math.sin(p.angle) * p.dist;
        const dx = pX - mapShip.x, dy = pY - mapShip.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist < p.size * 15) {
            const force = (0.8 * p.size) / (dist * dist + 100); 
            mapShip.vx += (dx / dist) * force; mapShip.vy += (dy / dist) * force;
        }
        if (dist < p.size + 4) {
            const nx = dx / dist, ny = dy / dist;
            mapShip.x -= nx * (p.size + 4 - dist); mapShip.y -= ny * (p.size + 4 - dist);
            const dot = mapShip.vx * nx + mapShip.vy * ny;
            mapShip.vx = (mapShip.vx - 2 * dot * nx) * 0.5; mapShip.vy = (mapShip.vy - 2 * dot * ny) * 0.5;
        }
    });
}

function renderSystem(cx, cy, parallaxScale, objAlpha) {
    const starScreenX = cx + (starSystem.starX - cx) * parallaxScale;
    const starScreenY = cy + (starSystem.starY - cy) * parallaxScale;
    
    if (parallaxScale > 0.05 && parallaxScale < 8) {
        ctx.globalAlpha = objAlpha;
        ctx.save(); ctx.translate(starScreenX, starScreenY);
        const starSize = starSystem.starSize * parallaxScale;
        ctx.shadowBlur = 60 * parallaxScale; ctx.shadowColor = starSystem.coronaColor;
        ctx.fillStyle = starSystem.coronaColor; ctx.beginPath(); ctx.arc(0, 0, starSize * 1.2, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 20 * parallaxScale; ctx.shadowColor = starSystem.starColor;
        ctx.fillStyle = starSystem.starColor; ctx.beginPath(); ctx.arc(0, 0, starSize, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
        
        starSystem.planets.forEach(p => {
            const screenDist = p.dist * parallaxScale; const planetSize = p.size * parallaxScale;
            p.angle += p.speed; 
            const px = Math.cos(p.angle) * screenDist; const py = Math.sin(p.angle) * screenDist;
            if (parallaxScale < 5) { 
                ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1 * parallaxScale; 
                ctx.beginPath(); ctx.arc(0,0, screenDist, 0,Math.PI*2); ctx.stroke(); 
            }
            ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(px, py, planetSize, 0, Math.PI*2); ctx.fill();
            if (p.hasRing) {
                ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2 * parallaxScale;
                ctx.beginPath(); ctx.ellipse(px, py, planetSize * 2, planetSize * 0.5, p.angle, 0, Math.PI*2); ctx.stroke();
            }
        });
        ctx.restore();
        ctx.globalAlpha = 1;
    }
    // [НОВАЯ ФУНКЦИЯ] Сброс системы (вызывается при прыжке)
    function resetStarSystem() {
        starSystem.active = false;
        starSystem.planets = [];
}
}