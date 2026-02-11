/* sector_anomaly.js */

let blackHole = { x: 0, y: 0, radius: 0, diskParticles: [] }; 

function generateBlackHole() {
    blackHole.x = canvas.width / 2; blackHole.y = canvas.height / 2;
    blackHole.radius = 35 + Math.random() * 20;
    blackHole.diskParticles = [];
    const pCount = 200 + Math.random() * 200;
    for(let i=0; i<pCount; i++) {
        const dist = blackHole.radius * 2 + Math.random() * 150; 
        blackHole.diskParticles.push({
            angle: Math.random() * Math.PI * 2, dist: dist,
            speed: (600 / (dist * dist)) * (0.5 + Math.random()*0.2),
            size: Math.random() * 2 + 1, color: Math.random() > 0.5 ? '#e040fb' : '#7c4dff', alpha: Math.random() * 0.7 + 0.3
        });
    }
}

function updateBlackHolePhysics() {
    // [ИСПРАВЛЕНИЕ] Если мы не в системе с черной дырой - игнорируем физику
    if (currentSystemType !== 'black_hole') return;

    if (isWarping) return;
    
    const dx = blackHole.x - mapShip.x;
    const dy = blackHole.y - mapShip.y;
    const distSq = dx*dx + dy*dy;
    const dist = Math.sqrt(distSq);

    if (dist < 700 && dist > 1) {
        const force = 15.0 / (distSq * 0.005 + 100); 
        mapShip.vx += (dx / dist) * force; mapShip.vy += (dy / dist) * force;
    }
    if (dist < blackHole.radius * 1.2) forceEmergencyWarp();
}

function forceEmergencyWarp() {
    if (isWarping) return;
    
    // [ИЗМЕНЕНИЕ] Теперь всегда варпаем в пустой сектор (null), без условий и затрат
    nextJumpTarget = null; 
    
    pendingJumpCost = 0; 
    if (typeof spectrumState !== 'undefined') spectrumState.hasScanned = false; 

    isWarping = true; warpState.phase = WARP_JUMP; warpState.timer = 0; warpFactor = 10; 
    
    // Примечание: SPACE_THEMES может быть не определен в текущей версии space_core, 
    // но оставляю как было в оригинале, меняю только логику цели.
    if (typeof SPACE_THEMES !== 'undefined') {
        bgState.nextThemeIdx = Math.floor(Math.random() * SPACE_THEMES.length); 
    } else if (typeof generateRandomTheme === 'function') {
        // Фолбек на новую систему тем, если старой нет
        bgState.nextTheme = generateRandomTheme();
    }
    
    bgState.progress = 0;

    chargeContainer.style.display = 'block'; chargeBar.style.width = '100%'; chargeBar.style.backgroundColor = '#d500f9'; 
    jumpBtn.disabled = true; jumpBtn.innerHTML = "ЭКСТРЕННЫЙ ПРЫЖОК!"; jumpBtn.style.color = "#d500f9"; jumpBtn.style.borderColor = "#d500f9";
    isDocked = false; dockBtn.style.display = 'none';
}

function renderBlackHole(cx, cy, parallaxScale, objAlpha) {
    const bhX = cx + (blackHole.x - cx) * parallaxScale;
    const bhY = cy + (blackHole.y - cy) * parallaxScale;
    const scale = parallaxScale;
    
    if (scale > 0.05 && scale < 8) {
        ctx.globalAlpha = objAlpha;
        ctx.save(); ctx.translate(bhX, bhY);
        const lensGrad = ctx.createRadialGradient(0, 0, blackHole.radius * scale * 1.5, 0, 0, blackHole.radius * scale * 4);
        lensGrad.addColorStop(0, 'rgba(100, 0, 255, 0.1)'); lensGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = lensGrad; ctx.beginPath(); ctx.arc(0, 0, blackHole.radius * scale * 4, 0, Math.PI*2); ctx.fill();
        blackHole.diskParticles.forEach(p => {
            p.angle += p.speed; const px = Math.cos(p.angle) * p.dist * scale; const py = Math.sin(p.angle) * (p.dist * 0.4) * scale;
            const sineVal = Math.sin(p.angle); const depthFactor = 0.3 + 0.35 * (sineVal + 1); 
            ctx.fillStyle = p.color; ctx.globalAlpha = p.alpha * depthFactor * objAlpha; 
            ctx.beginPath(); ctx.arc(px, py, p.size * scale, 0, Math.PI*2); ctx.fill();
        });
        ctx.globalAlpha = objAlpha;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * scale; ctx.shadowColor = '#fff'; ctx.shadowBlur = 10 * scale;
        ctx.beginPath(); ctx.arc(0, 0, blackHole.radius * scale * 1.1, 0, Math.PI*2); ctx.stroke(); ctx.shadowBlur = 0;
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, blackHole.radius * scale, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
    }
}
/* В конец файла sector_anomaly.js */

window.getAnomalySaveData = function() {
    return blackHole;
};

window.restoreAnomalySaveData = function(data) {
    if (data) {
        blackHole = data;
    }
};