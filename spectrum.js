/* spectrum.js - 2D RADAR: FINAL RUSSIAN EDITION & SMOOTH STARS */

const spCanvas = document.getElementById('sp3dCanvas'); 
const spCtx = spCanvas.getContext('2d');

window.activeAutopilotRoute = null;

// --- НАСТРОЙКИ ---
const BUTTON_RADIUS = 50; 
const MAX_JUMP_DIST = 200; 
const PLAYER_SAFE_ZONE = 150; 

if (typeof scanState === 'undefined') {
    window.scanState = {
        active: false,
        radius: 0,
        maxRadius: 1200,
        scanned: false,
        nodes: [],          
        centerNode: null,   
        lockedTarget: null, 
        path: [],           
        pathAnimProgress: 0,
        animTime: 0,
        backgroundStars: [],
        nebulas: [],
        comets: [],
        lockAnim: 0, 
        labelOffset: { x: 0, y: 0 } 
    };
}

// Инъекция CSS
function injectSpectrumStyles() {
    const styleId = 'spectrum-styles';
    if (document.getElementById(styleId)) return;

    const css = `
        #spectrumUI { 
            display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0, 0, 0, 0.95); z-index: 180; 
            flex-direction: column; align-items: center; justify-content: center; 
            backdrop-filter: blur(8px); 
        }
        .sp-window-container { 
            display: flex; flex-direction: column; 
            box-shadow: 0 0 120px rgba(0, 229, 255, 0.1); 
            border: 1px solid #333; 
            position: relative; width: 1200px; height: 800px; 
            background: #050505; 
            overflow: hidden;
            border-radius: 10px;
        }
        canvas#sp3dCanvas { 
            width: 100%; height: 100%; display: block; 
            background: #020205; 
            cursor: crosshair; 
        }
        .sp-header-overlay { 
            position: absolute; top: 0; left: 0; width: 100%; height: 40px; 
            padding: 0 20px; box-sizing: border-box; pointer-events: none; 
            display: flex; justify-content: space-between; align-items: center; 
            background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent); 
            z-index: 10; 
        }
        .sp-title { 
            font-family: 'Orbitron'; color: #00e5ff; font-size: 16px; font-weight: 700; letter-spacing: 4px; 
            text-shadow: 0 0 20px rgba(0, 229, 255, 0.6);
        }
        .sp-close-btn { 
            pointer-events: auto; color: #666; font-weight: 900; cursor: pointer; 
            font-family: 'Orbitron'; font-size: 14px; transition: 0.3s; 
        }
        .sp-close-btn:hover { color: #ff1744; text-shadow: 0 0 10px #ff1744; }
    `;
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = css;
    document.head.appendChild(style);
}

// --- КЛАССЫ И ИНИЦИАЛИЗАЦИЯ ---

class SpectrumNode {
    constructor(type, x, y) {
        this.type = type; 
        this.x = x; 
        this.y = y;
        this.visible = false;
        this.playerData = null;
        this.pulseOffset = Math.random() * 10;
        this.orbitAngle = Math.random() * Math.PI * 2; 
        this.neighbors = [];
    }
}

function initSpectrumBackground() {
    scanState.backgroundStars = [];
    scanState.nebulas = [];
    scanState.comets = [];
    
    const W = 1200; const H = 800;

    // 1. Звезды (ПЛАВНЫЕ)
    for(let i=0; i<450; i++) {
        scanState.backgroundStars.push({
            x: (Math.random() - 0.5) * W,
            y: (Math.random() - 0.5) * H,
            size: Math.random() * 1.8 + 0.5,
            
            // Параметры для плавного синуса
            baseAlpha: Math.random() * 0.5 + 0.2, // Средняя яркость
            pulseSpeed: 0.5 + Math.random() * 1.5, // Скорость пульсации (медленная)
            pulsePhase: Math.random() * Math.PI * 2,
            
            color: Math.random() > 0.85 ? '#00e5ff' : '#ffffff'
        });
    }
    
    // 2. Кометы (РЕДКИЕ - всего 1)
    for(let i=0; i<1; i++) { createComet(); }
    
    // 3. Туманности
    for(let i=0; i<7; i++) {
        scanState.nebulas.push({
            x: (Math.random() - 0.5) * W * 0.9,
            y: (Math.random() - 0.5) * H * 0.9,
            radius: 250 + Math.random() * 250,
            baseColor: Math.random() > 0.5 ? [0, 80, 150] : [80, 0, 120], 
            pulseSpeed: 0.002 + Math.random() * 0.003,
            offset: Math.random() * 10
        });
    }
}

function createComet() {
    const angle = Math.random() * Math.PI * 2;
    const dist = 900; 
    scanState.comets.push({
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 4, 
        vy: (Math.random() - 0.5) * 4,
        trail: [], size: 3, life: 0 
    });
}

window.resetSpectrum = function() {
    scanState = {
        active: false, radius: 0, maxRadius: 1200, scanned: false,
        nodes: [], centerNode: null, lockedTarget: null, path: [], pathAnimProgress: 0,
        animTime: 0, 
        backgroundStars: [], nebulas: [], comets: [], lockAnim: 0,
        labelOffset: {x:0, y:0}
    };
    initSpectrumBackground();
};

window.clear3DTarget = function() {
    scanState.lockedTarget = null;
    scanState.path = [];
    scanState.pathAnimProgress = 0;
    window.activeAutopilotRoute = null;
    scanState.lockAnim = 0;
};

function initSpectrum() {
    injectSpectrumStyles();
    spCanvas.width = 1200;
    spCanvas.height = 800;
    if (!scanState.backgroundStars.length) initSpectrumBackground();
    spCanvas.onmousedown = (e) => handleRadarClick(e.offsetX, e.offsetY);
}

function toggleSpectrum(state) {
    isSpectrumOpen = state;
    document.getElementById('spectrumUI').style.display = state ? 'flex' : 'none';
    if(state) initSpectrum(); 
}

// --- ОТРИСОВКА ---

function updateSpectrum() {
    if (!isSpectrumOpen) return;
    
    spCtx.fillStyle = '#020205';
    spCtx.fillRect(0, 0, spCanvas.width, spCanvas.height);
    
    scanState.animTime += 0.015;
    
    const cx = spCanvas.width / 2;
    const cy = spCanvas.height / 2;
    
    drawBackgroundLayers(cx, cy);

    if (!scanState.scanned && !scanState.active) {
        drawCentralScanButton(cx, cy);
    }
    
    if (scanState.active) {
        scanState.radius += 20; 
        spCtx.save();
        spCtx.beginPath();
        spCtx.arc(cx, cy, scanState.radius, 0, Math.PI*2);
        spCtx.strokeStyle = `rgba(0, 255, 200, ${Math.max(0, 1 - (scanState.radius / scanState.maxRadius))})`;
        spCtx.lineWidth = 5;
        spCtx.shadowBlur = 20; spCtx.shadowColor = '#00ffaa';
        spCtx.stroke();
        
        scanState.nodes.forEach(n => {
            const dist = Math.hypot(n.x, n.y);
            if (scanState.radius > dist && !n.visible) n.visible = true;
        });

        if (scanState.radius > scanState.maxRadius) {
            scanState.active = false;
            scanState.scanned = true;
        }
        spCtx.restore();
    }
    
    // Плавное появление пути
    if (scanState.path.length > 1) {
        if (scanState.pathAnimProgress < 1) {
            scanState.pathAnimProgress += 0.04; 
            if (scanState.pathAnimProgress > 1) scanState.pathAnimProgress = 1;
        }

        spCtx.save();
        spCtx.translate(cx, cy);
        
        const totalSegments = scanState.path.length - 1;
        const currentDrawIndex = Math.floor(totalSegments * scanState.pathAnimProgress);
        const partialSeg = (totalSegments * scanState.pathAnimProgress) - currentDrawIndex;

        spCtx.beginPath();
        if (totalSegments > 0) {
            spCtx.moveTo(scanState.path[0].x, scanState.path[0].y);
            for(let i=0; i < currentDrawIndex; i++) {
                spCtx.lineTo(scanState.path[i+1].x, scanState.path[i+1].y);
            }
            if (currentDrawIndex < totalSegments) {
                const p1 = scanState.path[currentDrawIndex];
                const p2 = scanState.path[currentDrawIndex+1];
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                spCtx.lineTo(p1.x + dx * partialSeg, p1.y + dy * partialSeg);
            }
        }

        spCtx.shadowBlur = 10; spCtx.shadowColor = '#00e676';
        spCtx.strokeStyle = '#00e676';
        spCtx.lineWidth = 3;
        spCtx.lineCap = 'round';
        spCtx.lineJoin = 'round';
        spCtx.stroke();
        
        spCtx.fillStyle = '#fff';
        scanState.path.forEach((p, idx) => {
            if (p.type !== 'ship' && idx <= currentDrawIndex + 1) { 
                spCtx.beginPath(); spCtx.arc(p.x, p.y, 4, 0, Math.PI*2); spCtx.fill();
            }
        });
        
        spCtx.restore();
    }

    scanState.nodes.forEach(n => {
        if (!n.visible) return;
        const tx = cx + n.x;
        const ty = cy + n.y;
        
        if (n.type === 'ship') drawPlayerShip(tx, ty); 
        else if (n.type === 'station') drawStationIcon(tx, ty, n);
        else if (n.type === 'system') drawSystemIcon(tx, ty, n);
        else if (n.type === 'black_hole') drawBlackHoleIcon(tx, ty, n);
        else if (n.type === 'player') drawPlayerIcon(tx, ty, n);
        else drawRouteNode(tx, ty, n); 
    });
    
    if (scanState.lockedTarget) {
        scanState.lockAnim += (1 - scanState.lockAnim) * 0.1;
        const t = scanState.lockedTarget;
        const tx = cx + t.x;
        const ty = cy + t.y;
        
        drawLockInterface(tx, ty, t);
    }
}

// --- ВИЗУАЛ ФОНА (ЗВЕЗДЫ) ---

function drawBackgroundLayers(cx, cy) {
    spCtx.globalCompositeOperation = 'lighter';
    scanState.nebulas.forEach(n => {
        const pulse = Math.sin(scanState.animTime * n.pulseSpeed + n.offset) * 0.1 + 0.9;
        const r = n.radius * pulse;
        const rgb = n.baseColor;
        const grad = spCtx.createRadialGradient(cx + n.x, cy + n.y, 0, cx + n.x, cy + n.y, r);
        grad.addColorStop(0, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.2)`);
        grad.addColorStop(1, 'transparent');
        spCtx.fillStyle = grad;
        spCtx.beginPath(); spCtx.arc(cx + n.x, cy + n.y, r, 0, Math.PI*2); spCtx.fill();
    });
    spCtx.globalCompositeOperation = 'source-over';

    scanState.backgroundStars.forEach(s => {
        // ОЧЕНЬ ПЛАВНОЕ МЕРЦАНИЕ
        // Используем синус от времени с индивидуальной фазой
        const sine = Math.sin(scanState.animTime * s.pulseSpeed + s.pulsePhase);
        // Нормализуем синус от -1..1 в 0..1, но с учетом baseAlpha
        // Пусть альфа качается от (baseAlpha - 0.2) до (baseAlpha + 0.2)
        let a = s.baseAlpha + (sine * 0.2);
        if (a < 0.1) a = 0.1;
        if (a > 1) a = 1;

        spCtx.fillStyle = s.color;
        spCtx.globalAlpha = a;
        spCtx.beginPath(); spCtx.arc(cx + s.x, cy + s.y, s.size, 0, Math.PI*2); spCtx.fill();
    });
    spCtx.globalAlpha = 1;

    spCtx.lineWidth = 3;
    scanState.comets.forEach(c => {
        c.x += c.vx; c.y += c.vy; c.life++;
        c.trail.push({x: c.x, y: c.y});
        if (c.trail.length > 50) c.trail.shift();

        if (c.trail.length > 1) {
            for (let i = 0; i < c.trail.length - 1; i++) {
                const p1 = c.trail[i];
                const p2 = c.trail[i+1];
                const opacity = (i / c.trail.length) * 0.9;
                
                spCtx.beginPath();
                spCtx.moveTo(cx + p1.x, cy + p1.y);
                spCtx.lineTo(cx + p2.x, cy + p2.y);
                spCtx.strokeStyle = `rgba(220, 255, 255, ${opacity})`;
                spCtx.stroke();
            }
        }
        spCtx.fillStyle = '#fff';
        spCtx.shadowBlur = 15; spCtx.shadowColor = '#fff';
        spCtx.beginPath(); spCtx.arc(cx + c.x, cy + c.y, c.size, 0, Math.PI*2); spCtx.fill();
        spCtx.shadowBlur = 0;

        if (Math.hypot(c.x, c.y) > 1000) {
            const angle = Math.random() * Math.PI * 2;
            c.x = Math.cos(angle) * 900;
            c.y = Math.sin(angle) * 900;
            c.vx = -Math.cos(angle) * (2 + Math.random()*2); 
            c.vy = -Math.sin(angle) * (2 + Math.random()*2);
            c.trail = [];
        }
    });
}

function drawCentralScanButton(cx, cy) {
    const pulse = Math.sin(scanState.animTime * 2) * 0.5 + 0.5; 
    const r = BUTTON_RADIUS + pulse * 5;
    
    spCtx.shadowBlur = 25; spCtx.shadowColor = '#00e5ff';
    spCtx.fillStyle = 'rgba(0, 10, 20, 0.9)';
    spCtx.strokeStyle = '#00e5ff';
    spCtx.lineWidth = 3;
    
    spCtx.beginPath(); spCtx.arc(cx, cy, r, 0, Math.PI*2); spCtx.fill(); spCtx.stroke();
    spCtx.shadowBlur = 0;
    
    spCtx.save();
    spCtx.translate(cx, cy);
    spCtx.rotate(scanState.animTime * 0.5); 
    spCtx.strokeStyle = 'rgba(0, 229, 255, 0.7)';
    spCtx.lineWidth = 6;
    spCtx.beginPath(); spCtx.arc(0, 0, r + 8, 0, 1.5); spCtx.stroke();
    spCtx.beginPath(); spCtx.arc(0, 0, r + 8, Math.PI, Math.PI + 1.5); spCtx.stroke();
    spCtx.restore();
    
    spCtx.font = "bold 20px Orbitron";
    spCtx.fillStyle = "#00e5ff";
    spCtx.textAlign = "center";
    spCtx.textBaseline = "middle";
    spCtx.letterSpacing = "2px";
    spCtx.fillText("SCAN", cx, cy);
}

// --- ИКОНКИ ---

function drawPlayerShip(x, y) {
    spCtx.shadowBlur = 20; spCtx.shadowColor = '#00e676';
    spCtx.fillStyle = '#00e676';
    spCtx.beginPath();
    spCtx.moveTo(x, y - 12);
    spCtx.lineTo(x + 9, y + 9);
    spCtx.lineTo(x, y + 6); 
    spCtx.lineTo(x - 9, y + 9);
    spCtx.fill();
    spCtx.shadowBlur = 0;
}

function drawRouteNode(x, y, n) {
    const pulse = Math.sin(scanState.animTime * 3 + n.x) * 0.3 + 0.7; 
    spCtx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
    spCtx.shadowBlur = 10; spCtx.shadowColor = '#fff';
    spCtx.beginPath(); spCtx.arc(x, y, 4, 0, Math.PI*2); spCtx.fill();
    spCtx.shadowBlur = 0;
}

function drawStationIcon(x, y, t) {
    spCtx.shadowBlur = 15; spCtx.shadowColor = '#00e5ff';
    spCtx.fillStyle = '#002244'; spCtx.strokeStyle = '#00e5ff'; spCtx.lineWidth = 2;
    spCtx.beginPath(); spCtx.arc(x, y, 8, 0, Math.PI*2); spCtx.fill(); spCtx.stroke();
    spCtx.shadowBlur = 0;
    spCtx.fillStyle = '#fff'; spCtx.beginPath(); spCtx.arc(x, y, 3, 0, Math.PI*2); spCtx.fill();

    spCtx.save();
    spCtx.translate(x, y);
    spCtx.rotate(scanState.animTime); 
    spCtx.fillStyle = '#00e5ff';
    for(let i=0; i<3; i++) {
        spCtx.rotate(Math.PI * 2 / 3);
        spCtx.beginPath(); spCtx.arc(14, 0, 2, 0, Math.PI*2); spCtx.fill();
    }
    spCtx.restore();
}

function drawSystemIcon(x, y, t) {
    spCtx.shadowBlur = 20; spCtx.shadowColor = '#ffab00';
    spCtx.fillStyle = '#ffab00'; spCtx.beginPath(); spCtx.arc(x, y, 7, 0, Math.PI*2); spCtx.fill();
    spCtx.shadowBlur = 0;
    spCtx.strokeStyle = 'rgba(255, 171, 0, 0.6)'; spCtx.lineWidth = 1;
    spCtx.beginPath(); spCtx.arc(x, y, 18, 0, Math.PI*2); spCtx.stroke();
    
    t.orbitAngle += 0.02; 
    spCtx.fillStyle = '#fff';
    spCtx.beginPath(); 
    spCtx.arc(x + Math.cos(t.orbitAngle)*18, y + Math.sin(t.orbitAngle)*18, 3, 0, Math.PI*2); 
    spCtx.fill();
    spCtx.fillStyle = '#ffd700';
    spCtx.beginPath(); 
    spCtx.arc(x + Math.cos(t.orbitAngle * 0.7 + 1)*24, y + Math.sin(t.orbitAngle * 0.7 + 1)*24, 2, 0, Math.PI*2); 
    spCtx.fill();
}

function drawBlackHoleIcon(x, y, t) {
    const warp = Math.sin(scanState.animTime * 3) * 2;
    
    spCtx.shadowBlur = 25; spCtx.shadowColor = '#d500f9';
    spCtx.strokeStyle = '#d500f9'; spCtx.lineWidth = 3; 
    spCtx.fillStyle = '#000';
    spCtx.beginPath(); spCtx.arc(x, y, 8 + warp, 0, Math.PI*2); 
    spCtx.fill(); spCtx.stroke();
    spCtx.shadowBlur = 0;
    spCtx.strokeStyle = 'rgba(200, 0, 255, 0.6)';
    spCtx.beginPath();
    spCtx.ellipse(x, y, 20 + warp, 6, -0.3, 0, Math.PI*2);
    spCtx.stroke();
}

function drawPlayerIcon(x, y, t) {
    spCtx.shadowBlur = 20; spCtx.shadowColor = '#ff1744';
    spCtx.fillStyle = '#ff1744'; 
    spCtx.beginPath(); spCtx.arc(x, y, 6, 0, Math.PI*2); spCtx.fill();
    
    const pulse = Math.sin(scanState.animTime * 3) * 0.5 + 0.5; 
    spCtx.strokeStyle = `rgba(255, 23, 68, ${1 - pulse})`;
    spCtx.lineWidth = 2;
    spCtx.beginPath(); spCtx.arc(x, y, 10 + pulse * 10, 0, Math.PI*2); spCtx.stroke();
    spCtx.shadowBlur = 0;
}

// --- УМНЫЙ UI И ТЕКСТОВЫЕ ЭФФЕКТЫ ---

function getSmartLabelPos(x, y) {
    const W = spCanvas.width;
    const H = spCanvas.height;
    let offX = 60; let offY = -40;
    if (x > W - 220) offX = -220;
    if (y < 80) offY = 60;
    if (y > H - 80) offY = -60;
    return { x: offX, y: offY };
}

// ФУНКЦИЯ КРАСИВОГО ТЕКСТА (БЕЗ РЕЗКИХ СКАЧКОВ)
function drawStyledText(ctx, text, x, y, type) {
    ctx.textAlign = "left";
    const chars = text.split('');
    let offsetX = 0;
    
    chars.forEach((char, i) => {
        let fill = "#fff";
        let font = "bold 14px Orbitron";
        let dy = 0; 
        let glow = 0;

        // --- ЛОГИКА АНИМАЦИИ БУКВ ---

        if (type === 'station') {
            const wavePos = (scanState.animTime * 5) % (text.length + 5);
            const dist = Math.abs(i - wavePos);
            if (dist < 2) {
                fill = "#00e5ff"; 
                glow = 10;
            } else {
                fill = "#b0bec5"; 
            }
        }
        else if (type === 'system') {
            const breathe = Math.sin(scanState.animTime * 2 + i * 0.2);
            fill = breathe > 0 ? "#ffd700" : "#ffecb3";
            glow = breathe > 0.5 ? 10 : 0;
        }
        else if (type === 'black_hole') {
            // ЧЕРНО-ФИОЛЕТОВЫЙ + РЕДКИЙ ГЛИТЧ
            // Основной цвет: Темно-фиолетовый (почти черный) #2a003b 
            // переливается в яркий фиолетовый
            const flow = Math.sin(scanState.animTime * 3 + i * 0.5); 
            
            if (flow > 0.7) fill = "#d500f9"; // Яркий пик
            else if (flow < -0.7) fill = "#2a003b"; // Темное дно
            else fill = "#7c4dff"; // Средний

            // Глитч (редкий)
            if (Math.random() > 0.98) {
                fill = "#fff"; // Вспышка белого
                dy = (Math.random() - 0.5) * 2;
            } else {
                // Плавная волна
                dy = Math.sin(scanState.animTime * 2 + i * 0.3) * 2;
            }
            
            glow = 5;
        }
        else if (type === 'player') {
            const pulse = Math.sin(scanState.animTime * 4); // Медленно
            fill = pulse > 0 ? "#ff1744" : "#b71c1c";
            glow = 10;
        }

        ctx.fillStyle = fill;
        ctx.font = font;
        if (glow > 0) {
            ctx.shadowBlur = glow;
            ctx.shadowColor = fill;
        } else {
            ctx.shadowBlur = 0;
        }
        
        ctx.fillText(char, x + offsetX, y + dy);
        
        const charW = ctx.measureText(char).width + 2; 
        offsetX += charW;
    });
    ctx.shadowBlur = 0;
}

function drawLockInterface(x, y, t) {
    const startSize = 120;
    const finalSize = 40;
    const currentSize = startSize - (startSize - finalSize) * scanState.lockAnim;
    const opacity = scanState.lockAnim;
    
    spCtx.save();
    spCtx.translate(x, y);
    spCtx.rotate(Math.PI * (1 - scanState.lockAnim)); 
    spCtx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
    spCtx.lineWidth = 3;
    spCtx.shadowBlur = 10; spCtx.shadowColor = 'rgba(0, 229, 255, 0.8)';
    
    const s = currentSize; const len = 15;
    spCtx.beginPath(); 
    spCtx.moveTo(-s, -s + len); spCtx.lineTo(-s, -s); spCtx.lineTo(-s + len, -s);
    spCtx.moveTo(s - len, -s); spCtx.lineTo(s, -s); spCtx.lineTo(s, -s + len);
    spCtx.moveTo(-s, s - len); spCtx.lineTo(-s, s); spCtx.lineTo(-s + len, s);
    spCtx.moveTo(s - len, s); spCtx.lineTo(s, s); spCtx.lineTo(s, s - len);
    spCtx.stroke();
    spCtx.restore();
    
    if (scanState.lockAnim > 0.8) {
        if (scanState.labelOffset.x === 0) {
            scanState.labelOffset = getSmartLabelPos(x, y);
        }

        const labelX = x + scanState.labelOffset.x;
        const labelY = y + scanState.labelOffset.y;
        
        spCtx.beginPath();
        spCtx.moveTo(x, y);
        const elbowX = labelX + (scanState.labelOffset.x > 0 ? -15 : 15);
        spCtx.lineTo(elbowX, labelY + 12);
        spCtx.lineTo(labelX, labelY + 12);
        spCtx.strokeStyle = 'rgba(0, 229, 255, 0.8)';
        spCtx.lineWidth = 2;
        spCtx.shadowBlur = 5;
        spCtx.stroke();
        spCtx.shadowBlur = 0;
        
        // Данные
        let line1 = "UNKNOWN";
        let line2 = "";
        
        // РУССКИЙ ТЕКСТ
        if (t.type === 'station') { line1 = "ТОРГОВЫЙ ПОСТ"; } 
        else if (t.type === 'system') { line1 = "ПЛАНЕТАРНАЯ СИСТЕМА"; } 
        else if (t.type === 'black_hole') { line1 = "⚠ ГРАВИТАЦИОННАЯ АНОМАЛИЯ ⚠"; } 
        else if (t.type === 'player') { 
            line1 = "!!! НЕИЗВЕСТНЫЙ СЕТЕВОЙ КОД !!!"; 
            if(t.playerData) line2 = `ID: ${t.playerData.nickname}`;
        }
        else { line1 = "ПУСТОЙ СЕКТОР"; }

        if (t.type !== 'player' && scanState.path.length > 0) {
            line2 = `ПРЫЖКОВ: ${Math.max(1, scanState.path.length - 1)}`;
        }

        // РИСУЕМ СТИЛЬНЫЙ ТЕКСТ
        drawStyledText(spCtx, line1, labelX, labelY, t.type);
        
        if(line2) {
            spCtx.font = "12px Share Tech Mono";
            spCtx.fillStyle = "rgba(255,255,255,0.8)";
            spCtx.fillText(line2, labelX, labelY + 20);
        }
        
        // Кнопка Отмены
        const btnSize = 24;
        const btnX = labelX - btnSize - 10;
        const btnY = labelY;
        
        spCtx.fillStyle = "rgba(30, 0, 0, 0.9)";
        spCtx.strokeStyle = "#ff1744";
        spCtx.lineWidth = 2;
        spCtx.fillRect(btnX, btnY, btnSize, btnSize);
        spCtx.strokeRect(btnX, btnY, btnSize, btnSize);
        
        spCtx.strokeStyle = "#ff1744";
        spCtx.beginPath();
        spCtx.moveTo(btnX + 5, btnY + 5); spCtx.lineTo(btnX + btnSize - 5, btnY + btnSize - 5);
        spCtx.moveTo(btnX + btnSize - 5, btnY + 5); spCtx.lineTo(btnX + 5, btnY + btnSize - 5);
        spCtx.stroke();
    }
}

// --- ЛОГИКА ГЕНЕРАЦИИ ---

window.perform2DScan = function() {
    if (scanState.active) return;
    
    scanState.nodes = [];
    scanState.path = [];
    scanState.lockedTarget = null;
    scanState.radius = BUTTON_RADIUS;
    scanState.active = true;
    scanState.scanned = false;
    
    const ship = new SpectrumNode('ship', 0, 0);
    scanState.centerNode = ship;
    scanState.nodes.push(ship);
    
    if (typeof window.scanForPlayers === 'function') {
        window.scanForPlayers().then(players => {
            players.forEach(p => {
                let x, y;
                const W = 1200; const H = 800; const margin = 50;
                if (Math.random() > 0.5) { 
                    x = (Math.random() - 0.5) * (W - margin*2);
                    y = (Math.random() > 0.5 ? (H/2 - margin) : -(H/2 - margin));
                } else { 
                    x = (Math.random() > 0.5 ? (W/2 - margin) : -(W/2 - margin));
                    y = (Math.random() - 0.5) * (H - margin*2);
                }
                const t = new SpectrumNode('player', x, y);
                t.playerData = p;
                scanState.nodes.push(t);
            });
            generateRandomNodes();
        });
    } else {
        generateRandomNodes(); 
    }
}

function generateRandomNodes() {
    const count = 90; 
    const W = 1200; const H = 800; const Margin = 60;

    for (let i = 0; i < count; i++) {
        const x = (Math.random() - 0.5) * (W - Margin*2);
        const y = (Math.random() - 0.5) * (H - Margin*2);
        
        if (Math.hypot(x, y) < 80) continue; 
        
        let tooClose = false;
        for (let n of scanState.nodes) {
            let limit = 45;
            if (n.type === 'player') limit = PLAYER_SAFE_ZONE; 

            if (Math.hypot(n.x - x, n.y - y) < limit) { 
                tooClose = true; break; 
            }
        }
        if (tooClose) continue;

        let type = 'empty';
        const rand = Math.random();
        // ШАНСЫ (Systems ~2.5%, BH ~1.5%)
        if (rand > 0.985) type = 'black_hole';
        else if (rand > 0.96) type = 'system';
        else if (rand > 0.88) type = 'station';
        
        scanState.nodes.push(new SpectrumNode(type, x, y));
    }
    
    scanState.nodes.forEach(node => {
        scanState.nodes.forEach(other => {
            if (node === other) return;
            const d = Math.hypot(node.x - other.x, node.y - other.y);
            if (node.type === 'player' || other.type === 'player') return;
            if (d < MAX_JUMP_DIST) node.neighbors.push(other);
        });
    });
}

function findPath(start, end) {
    let queue = [[start]];
    let visited = new Set();
    visited.add(start);
    
    while (queue.length > 0) {
        let path = queue.shift();
        let node = path[path.length - 1];
        if (node === end) return path;
        for (let neighbor of node.neighbors) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push([...path, neighbor]);
            }
        }
    }
    return []; 
}

function handleRadarClick(mx, my) {
    const cx = spCanvas.width / 2;
    const cy = spCanvas.height / 2;
    
    if (!scanState.scanned && !scanState.active) {
        if (Math.hypot(mx - cx, my - cy) < BUTTON_RADIUS) {
            perform2DScan();
            return;
        }
    }
    if (!scanState.scanned) return;

    if (scanState.lockedTarget && scanState.lockAnim > 0.8) {
        const t = scanState.lockedTarget;
        const tx = cx + t.x;
        const ty = cy + t.y;
        const lx = tx + scanState.labelOffset.x;
        const ly = ty + scanState.labelOffset.y;
        
        const btnX = lx - 35; const btnY = ly;
        if (mx >= btnX && mx <= btnX + 30 && my >= btnY && my <= btnY + 30) {
            window.clear3DTarget();
            return;
        }
    }
    
    let clicked = null;
    let minDist = 40;
    
    scanState.nodes.forEach(n => {
        if (!n.visible) return;
        if (n.type === 'ship') return;
        const tx = cx + n.x;
        const ty = cy + n.y;
        const d = Math.hypot(mx - tx, my - ty);
        if (d < minDist) { minDist = d; clicked = n; }
    });
    
    if (clicked) lockTarget(clicked);
}

function lockTarget(target) {
    scanState.lockedTarget = target;
    scanState.lockAnim = 0;
    scanState.labelOffset = { x: 0, y: 0 }; 
    scanState.pathAnimProgress = 0; 
    
    if (target.type === 'player') {
        scanState.path = [];
        window.activeAutopilotRoute = {
            targetType: 'player',
            jumpsRequired: 1, 
            playerData: target.playerData
        };
    } 
    else {
        scanState.path = findPath(scanState.centerNode, target);
        let jumps = 1;
        if (scanState.path.length > 0) jumps = Math.max(1, scanState.path.length - 1);
        else jumps = 99; 
        
        window.activeAutopilotRoute = {
            targetType: target.type,
            jumpsRequired: jumps,
            playerData: null
        };
    }
}