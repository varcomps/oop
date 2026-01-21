const mapUI = document.getElementById('mapUI');
const jumpBtn = document.getElementById('jumpBtn');
const dockBtn = document.getElementById('dockBtn');
const chargeBar = document.getElementById('chargeBar');
const chargeContainer = document.getElementById('chargeBarContainer');

// ГЛОБАЛЬНАЯ КОНСТАНТА РАЗМЕРА БЛОКА КАРТЫ (для масштаба)
const MAP_BLOCK_SIZE = 6;

const mapShip = { x: 0, y: 0, angle: -Math.PI / 2, vx: 0, vy: 0, thrust: 0.05, rotationSpeed: 0.04, friction: 0.99 };

// Станция теперь проще: координаты + радиус зоны стыковки
let station = { x: 0, y: 0, dockingRadius: 150 }; 
let starSystem = { active: false, starColor: '#fff', planets: [] };
let blackHole = { x: 0, y: 0, radius: 0, diskParticles: [] }; 

// Данные для ВНУТРЕННЕЙ генерации (когда мы уже внутри)
let stationTiles = []; 
let stationModules = [];
window.stationZones = []; 

let warpFactor = 0, isWarping = false;
const WARP_IDLE=0, WARP_CHARGE=1, WARP_JUMP=2, WARP_COAST=3, WARP_EXIT=4;
let warpState = { phase: WARP_IDLE, timer: 0 };

// --- ШУМ ПЕРЛИНА И ФОН (Оставляем как было, это "каеф") ---
const Noise = {
    p: [],
    init: function() {
        this.p = [];
        for(let i=0; i<256; i++) this.p[i] = Math.floor(Math.random()*256);
        for(let i=0; i<256; i++) {
            const r = Math.floor(Math.random()*256);
            const t = this.p[i]; this.p[i] = this.p[r]; this.p[r] = t;
        }
        this.perm = [];
        for(let i=0; i<512; i++) this.perm[i] = this.p[i & 255];
    },
    fade: function(t) { return t * t * t * (t * (t * 6 - 15) + 10); },
    lerp: function(t, a, b) { return a + t * (b - a); },
    grad: function(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    },
    perlin: function(x, y, z) {
        if(this.p.length === 0) this.init();
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;
        x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
        const u = this.fade(x); const v = this.fade(y); const w = this.fade(z);
        const A = this.perm[X]+Y, AA = this.perm[A]+Z, AB = this.perm[A+1]+Z;
        const B = this.perm[X+1]+Y, BA = this.perm[B]+Z, BB = this.perm[B+1]+Z;
        return this.lerp(w, this.lerp(v, this.lerp(u, this.grad(this.perm[AA], x, y, z),
            this.grad(this.perm[BA], x-1, y, z)),
            this.lerp(u, this.grad(this.perm[AB], x, y-1, z),
            this.grad(this.perm[BB], x-1, y-1, z))),
            this.lerp(v, this.lerp(u, this.grad(this.perm[AA+1], x, y, z-1),
            this.grad(this.perm[BA+1], x-1, y, z-1)),
            this.lerp(u, this.grad(this.perm[AB+1], x, y-1, z-1),
            this.grad(this.perm[BB+1], x-1, y-1, z-1))));
    }
};

let bgLayers = { nebula: [], stars: [], dust: [], theme: {} };

function initSpace() {
    mapShip.x = canvas.width / 2; mapShip.y = canvas.height / 2;
    currentSystemType = 'station';
    
    // БЕЗ ОТСТУПОВ: Станция может быть где угодно
    station.x = Math.random() * canvas.width;
    station.y = Math.random() * canvas.height;
    station.dockingRadius = 200; // Радиус зоны стыковки

    generateDeepSpace();
    generateStation(); // Генерация ВНУТРЕННИХ комнат (для режима STATE_SHIP)
    // generateStationExterior() - УДАЛЕНО
}

// --- ГЕНЕРАЦИЯ ФОНА (ОСТАВЛЕНО БЕЗ ИЗМЕНЕНИЙ) ---
function generateDeepSpace() {
    Noise.init(); 
    bgLayers.nebula = [];
    bgLayers.stars = [];
    bgLayers.dust = [];

    const themes = [
        { name: "Nebula Core", colors: ['#ff0055', '#7c4dff', '#00e5ff'], density: 1.5 },
        { name: "Void", colors: ['#1a237e', '#000000', '#311b92'], density: 0.3 },
        { name: "Golden Sector", colors: ['#ffab00', '#ff6d00', '#ffd600'], density: 1.0 },
        { name: "Toxic Cloud", colors: ['#00e676', '#76ff03', '#1de9b6'], density: 1.2 },
        { name: "Ice Field", colors: ['#80d8ff', '#ffffff', '#82b1ff'], density: 0.8 }
    ];
    bgLayers.theme = themes[Math.floor(Math.random() * themes.length)];
    const tColor = bgLayers.theme.colors;

    const nebulaCount = 40 * bgLayers.theme.density;
    for(let i = 0; i < nebulaCount; i++) {
        const x = (Math.random() - 0.5) * canvas.width * 4;
        const y = (Math.random() - 0.5) * canvas.height * 4;
        const z = Math.random() * 1500 + 500;
        const noiseVal = Noise.perlin(x * 0.001, y * 0.001, i * 0.1);
        
        bgLayers.nebula.push({
            x: x, y: y, z: z,
            size: 300 + Math.abs(noiseVal) * 500,
            color: tColor[Math.floor(Math.random() * tColor.length)],
            alpha: 0.05 + Math.abs(noiseVal) * 0.15,
            shape: Math.random()
        });
    }

    const starBaseCount = 1500;
    for(let i = 0; i < starBaseCount; i++) {
        const x = (Math.random() - 0.5) * canvas.width * 3;
        const y = (Math.random() - 0.5) * canvas.height * 3;
        const z = Math.random() * 2000 + 10;
        const n = Noise.perlin(x * 0.002, y * 0.002, 50);
        let threshold = 0.2 - (bgLayers.theme.density * 0.2); 
        if (n > threshold) {
            bgLayers.stars.push({
                x: x, y: y, z: z,
                size: Math.random() * 2 + (n * 2),
                color: Math.random() > 0.9 ? tColor[0] : '#ffffff',
                brightness: Math.random()
            });
        }
    }

    for(let i=0; i<300; i++) {
        bgLayers.dust.push({
            x: (Math.random() - 0.5) * canvas.width * 2,
            y: (Math.random() - 0.5) * canvas.height * 2,
            z: Math.random() * 1000 + 10,
            size: Math.random() * 1,
            color: '#ffffff',
            alpha: Math.random() * 0.5
        });
    }
}

function generateSystem() {
    starSystem.active = true;
    const colors = ['#ffcc00', '#2979ff', '#ff5252', '#ffffff'];
    starSystem.starColor = colors[Math.floor(Math.random() * colors.length)];
    starSystem.starX = Math.random() * (canvas.width * 0.6) + canvas.width * 0.2;
    starSystem.starY = Math.random() * (canvas.height * 0.6) + canvas.height * 0.2;
    
    starSystem.planets = [];
    const planetCount = Math.floor(Math.random() * 4) + 1;
    for(let i=0; i<planetCount; i++) {
        starSystem.planets.push({
            dist: 100 + i * 60,
            angle: Math.random() * Math.PI * 2,
            speed: (Math.random() * 0.01 + 0.005) * (Math.random() > 0.5 ? 1 : -1),
            size: Math.random() * 8 + 4,
            color: `hsl(${Math.random()*360}, 70%, 50%)`
        });
    }
}

function generateBlackHole() {
    blackHole.x = canvas.width / 2;
    blackHole.y = canvas.height / 2;
    blackHole.radius = 40;
    blackHole.diskParticles = [];

    for(let i=0; i<300; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 60 + Math.random() * 120; 
        blackHole.diskParticles.push({
            angle: angle,
            dist: dist,
            speed: (500 / (dist * dist)) * 0.5,
            size: Math.random() * 3 + 1,
            color: Math.random() > 0.5 ? '#7c4dff' : '#00e5ff',
            alpha: Math.random() * 0.8 + 0.2
        });
    }
}

// --- ГЕНЕРАЦИЯ ВНУТРЕННИХ КОМНАТ (Оставляем для режима ходьбы) ---
function generateStation() {
    stationTiles = []; 
    stationModules = []; 
    window.stationZones = [];
    
    const fillRect = (rx, ry, rw, rh) => {
        for(let x=0; x<rw; x++) for(let y=0; y<rh; y++) {
            stationTiles.push({x: rx + x, y: ry + y});
        }
        return {x: rx, y: ry, w: rw, h: rh, cx: rx + Math.floor(rw/2), cy: ry + Math.floor(rh/2)};
    };

    const hangarW = 32, hangarH = 18;
    const hangar = fillRect(0, 0, hangarW, hangarH);
    window.stationZones.push({ name: "ГЛАВНЫЙ АНГАР", x: hangar.x, y: hangar.y, w: hangar.w, h: hangar.h });

    let sides = [0, 1, 2, 3];
    sides.sort(() => Math.random() - 0.5);
    const engSide = sides.pop();
    const hubSide = sides.pop();

    const createRoom = (source, side, rw, rh, name, corrLen=3) => {
        let rx, ry, cx, cy, cw, ch;
        if (side === 0) {
            rx = source.x + Math.floor((source.w - rw) / 2); ry = source.y - rh - corrLen;
            cx = source.x + Math.floor(source.w/2) - 2; cy = source.y - corrLen; cw = 4; ch = corrLen;
        } else if (side === 1) {
            rx = source.x + source.w + corrLen; ry = source.y + Math.floor((source.h - rh) / 2);
            cx = source.x + source.w; cy = source.y + Math.floor(source.h/2) - 2; cw = corrLen; ch = 4;
        } else if (side === 2) {
            rx = source.x + Math.floor((source.w - rw) / 2); ry = source.y + source.h + corrLen;
            cx = source.x + Math.floor(source.w/2) - 2; cy = source.y + source.h; cw = 4; ch = corrLen;
        } else {
            rx = source.x - rw - corrLen; ry = source.y + Math.floor((source.h - rh) / 2);
            cx = source.x - corrLen; cy = source.y + Math.floor(source.h/2) - 2; cw = corrLen; ch = 4;
        }
        fillRect(cx, cy, cw, ch);
        const room = fillRect(rx, ry, rw, rh);
        window.stationZones.push({ name: name, x: rx, y: ry, w: rw, h: rh });
        return { ...room, entranceSide: (side + 2) % 4 }; 
    };

    const engRoom = createRoom(hangar, engSide, 12, 12, "ИНЖЕНЕРНЫЙ ОТСЕК");
    stationModules.push({ type: 'engineering_terminal', x: engRoom.cx - 1, y: engRoom.cy - 1, w: 2, h: 2 });

    const hubRoom = createRoom(hangar, hubSide, 14, 14, "ЦЕНТРАЛЬНЫЙ ХАБ");
    let reactorSides = [0, 1, 2, 3].filter(s => s !== hubRoom.entranceSide);
    const reactorSide = reactorSides[Math.floor(Math.random() * reactorSides.length)];
    const reactorRoom = createRoom(hubRoom, reactorSide, 10, 10, "РЕАКТОРНАЯ");
    stationModules.push({ type: 'trade_post', x: reactorRoom.cx - 1, y: reactorRoom.cy - 1, w: 2, h: 2 });
}

function initiateHyperJump() {
    if (currentState !== STATE_MAP || isWarping) return;
    if (isDocked) { alert("ОТСТЫКУЙТЕСЬ [F]"); return; }

    const fuel = getFuelCount();
    if (fuel < 1) { alert("NO FUEL!"); return; }
    if (pendingJumpCost > 0 && player.credits < pendingJumpCost) { alert("INSUFFICIENT SC!"); return; }

    consumeFuel(1);
    if (pendingJumpCost > 0) { player.credits -= pendingJumpCost; updateCurrencyUI(); }

    spectrumState.hasScanned = false;
    spectrumState.signals = [];
    spectrumState.lockedIndex = -1;

    isWarping = true; warpState.phase = WARP_CHARGE; warpState.timer = 0; warpFactor = 0;
    chargeContainer.style.display = 'block'; 
    jumpBtn.disabled = true; jumpBtn.innerHTML = "SPOOLING UP...";
    isDocked = false; dockBtn.style.display = 'none';
}

function updateWarpLogic() {
    if (!isWarping) {
        if (isDocked) {
             jumpBtn.innerHTML = "SYSTEM DOCKED"; jumpBtn.disabled = true; 
             jumpBtn.style.borderColor = "#444"; jumpBtn.style.color = "#555";
        } else {
            const fuel = getFuelCount();
            if (fuel > 0) {
                 jumpBtn.innerHTML = "INITIATE JUMP"; jumpBtn.disabled = false; jumpBtn.style.borderColor = "#ff5252"; jumpBtn.style.color = "#ff5252";
            } else {
                 jumpBtn.innerHTML = "NO FUEL"; jumpBtn.disabled = true; jumpBtn.style.removeProperty('border-color');
            }
        }
        return;
    }

    if (warpState.phase === WARP_CHARGE) {
        warpState.timer++; warpFactor = (warpState.timer / 100) * 2; chargeBar.style.width = (warpState.timer)+'%';
        if (warpState.timer >= 100) { warpState.phase = WARP_JUMP; warpState.timer = 0; jumpBtn.innerHTML = "ENGAGING!"; }
    } else if (warpState.phase === WARP_JUMP) {
        warpState.timer++; warpFactor += 3 + (warpFactor * 0.15); 
        if (warpFactor > 100) { warpFactor = 100; warpState.phase = WARP_COAST; warpState.timer = 0; }
    } else if (warpState.phase === WARP_COAST) {
        warpState.timer++; 
        if (warpState.timer === 15) { 
            generateDeepSpace();
            jumpBtn.innerHTML = "ARRIVING..."; 
            currentSystemType = nextJumpTarget;
            
            if (currentSystemType === 'station') {
                station.x = Math.random() * canvas.width;
                station.y = Math.random() * canvas.height;
                generateStation();
            } else if (currentSystemType === 'system') {
                generateSystem();
            } else if (currentSystemType === 'black_hole') {
                generateBlackHole();
            } else {
                currentSystemType = null; 
            }
            nextJumpTarget = null;
            pendingJumpCost = 0;
        }
        if (warpState.timer > 40) { warpState.phase = WARP_EXIT; warpState.timer = 0; }
    } else if (warpState.phase === WARP_EXIT) {
        warpFactor *= 0.85;
        if (warpFactor < 0.1) {
            warpFactor = 0; isWarping = false; warpState.phase = WARP_IDLE;
            chargeContainer.style.display = 'none'; chargeBar.style.width = '0%'; jumpBtn.disabled = false;
        }
    }
}

// --- НОВАЯ ПРОСТАЯ ПРОВЕРКА СТЫКОВКИ (РАДИУС) ---
window.isShipInDockingZone = function() {
    if (currentSystemType !== 'station') return false;
    const dist = Math.hypot(mapShip.x - station.x, mapShip.y - station.y);
    return dist < station.dockingRadius;
};

function handleDockingInteraction() {
    if (currentState !== STATE_MAP) return;
    if (currentSystemType !== 'station') return; 
    if (isDocked) { isDocked = false; } 
    else {
        if (window.isShipInDockingZone()) { 
            isDocked = true; 
            mapShip.vx = 0; mapShip.vy = 0; 
            startTransition(STATE_SHIP); 
        }
    }
}

function drawMap() {
    drawSpaceBackground(true);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    let parallaxScale = 1;
    let isActive = false; 

    if (isWarping) {
        if (warpState.phase === WARP_EXIT) {
            const depth = 1 + (warpFactor * 0.2); parallaxScale = 1 / depth; isActive = true;
        } else {
            parallaxScale = 1 + (warpFactor * 0.2); if (parallaxScale < 20) isActive = true; 
        }
    } else { isActive = true; }

    if (isActive) {
        if (currentSystemType === 'station') {
            const sX = cx + (station.x - cx) * parallaxScale;
            const sY = cy + (station.y - cy) * parallaxScale;
            ctx.save(); 
            ctx.translate(sX, sY); 
            ctx.scale(parallaxScale, parallaxScale);

            // --- НОВЫЙ СХЕМАТИЧНЫЙ РЕНДЕР СТАНЦИИ ---
            
            // 1. Зона стыковки (Круг с пунктиром)
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 10]);
            
            // Легкая анимация вращения зоны
            ctx.save();
            ctx.rotate(time * 0.05);
            ctx.beginPath();
            ctx.arc(0, 0, station.dockingRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            ctx.setLineDash([]);

            // 2. Иконка станции (Ромб/Тактический символ)
            ctx.shadowBlur = 10; ctx.shadowColor = '#00e5ff';
            ctx.fillStyle = '#000';
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 3;

            const iconSize = 25;
            ctx.beginPath();
            ctx.moveTo(0, -iconSize);
            ctx.lineTo(iconSize, 0);
            ctx.lineTo(0, iconSize);
            ctx.lineTo(-iconSize, 0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Детали иконки
            ctx.fillStyle = '#00e5ff';
            ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI*2); ctx.fill();
            
            // Текст метки
            ctx.fillStyle = '#00e5ff';
            ctx.font = "12px Orbitron";
            ctx.textAlign = "center";
            ctx.fillText("OUTPOST ALPHA", 0, iconSize + 20);
            ctx.shadowBlur = 0;

            ctx.restore();
        }
        else if (currentSystemType === 'system') {
            const starScreenX = cx + (starSystem.starX - cx) * parallaxScale;
            const starScreenY = cy + (starSystem.starY - cy) * parallaxScale;
            ctx.save(); ctx.translate(starScreenX, starScreenY);
            const starSize = 30 * parallaxScale;
            ctx.shadowBlur = 40 * parallaxScale; ctx.shadowColor = starSystem.starColor;
            ctx.fillStyle = starSystem.starColor;
            ctx.beginPath(); ctx.arc(0, 0, starSize, 0, Math.PI*2); ctx.fill();
            ctx.shadowBlur = 0;
            starSystem.planets.forEach(p => {
                const screenDist = p.dist * parallaxScale; const planetSize = p.size * parallaxScale;
                if (parallaxScale < 5) { ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1 * parallaxScale; ctx.beginPath(); ctx.arc(0,0, screenDist, 0,Math.PI*2); ctx.stroke(); }
                p.angle += p.speed; const px = Math.cos(p.angle) * screenDist; const py = Math.sin(p.angle) * screenDist;
                ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(px, py, planetSize, 0, Math.PI*2); ctx.fill();
            });
            ctx.restore();
        }
        else if (currentSystemType === 'black_hole') {
            const bhX = cx + (blackHole.x - cx) * parallaxScale;
            const bhY = cy + (blackHole.y - cy) * parallaxScale;
            const scale = parallaxScale;
            ctx.save(); ctx.translate(bhX, bhY);
            
            const lensGrad = ctx.createRadialGradient(0, 0, blackHole.radius * scale * 1.5, 0, 0, blackHole.radius * scale * 4);
            lensGrad.addColorStop(0, 'rgba(100, 0, 255, 0.1)'); lensGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = lensGrad; ctx.beginPath(); ctx.arc(0, 0, blackHole.radius * scale * 4, 0, Math.PI*2); ctx.fill();

            blackHole.diskParticles.forEach(p => {
                p.angle += p.speed;
                const px = Math.cos(p.angle) * p.dist * scale;
                const py = Math.sin(p.angle) * (p.dist * 0.4) * scale;
                
                // ИСПРАВЛЕНИЕ: Плавный расчет прозрачности на основе синуса угла
                // sineVal меняется от -1 (сзади) до 1 (спереди)
                const sineVal = Math.sin(p.angle); 
                // Нормализуем в диапазон от 0.3 (самая темная) до 1.0 (самая яркая)
                const depthFactor = 0.3 + 0.35 * (sineVal + 1); 

                ctx.fillStyle = p.color; 
                ctx.globalAlpha = p.alpha * depthFactor;

                ctx.beginPath(); ctx.arc(px, py, p.size * scale, 0, Math.PI*2); ctx.fill();
            });
            ctx.globalAlpha = 1;

            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * scale; ctx.shadowColor = '#fff'; ctx.shadowBlur = 10 * scale;
            ctx.beginPath(); ctx.arc(0, 0, blackHole.radius * scale * 1.1, 0, Math.PI*2); ctx.stroke(); ctx.shadowBlur = 0;
            ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, blackHole.radius * scale, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        }
    }

    ctx.save(); ctx.translate(mapShip.x, mapShip.y); ctx.rotate(mapShip.angle);
    if (warpState.phase === WARP_CHARGE) { const shake = warpFactor * 2; ctx.translate(Math.random() * shake - shake / 2, Math.random() * shake - shake / 2); }
    if (isWarping && warpFactor > 1) ctx.scale(1, 1 + warpFactor / 20);
    
    // --- КОРАБЛЬ ИГРОКА (ТОЖЕ ВЕКТОРНЫЙ/СХЕМАТИЧНЫЙ) ---
    ctx.shadowBlur = 10; ctx.shadowColor = '#00e676';
    ctx.fillStyle = '#00e676'; 
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, 5); ctx.lineTo(-3, 0); ctx.lineTo(-6, -5); ctx.fill();
    ctx.shadowBlur = 0;
    
    // Огонь двигателя
    if (inputs.up && !isWarping && !isDocked) { 
        ctx.fillStyle = '#ffb74d'; 
        ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-12, 4); ctx.lineTo(-12, -4); ctx.fill(); 
    }
    ctx.restore();
}

function drawSpaceBackground(isMap) {
    ctx.fillStyle = '#020204'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width / 2; const cy = canvas.height / 2;
    let shiftX = 0, shiftY = 0;
    if (isMap) { shiftX = (mapShip.x - cx) * 0.4; shiftY = (mapShip.y - cy) * 0.4; }

    ctx.globalCompositeOperation = 'lighter';
    bgLayers.nebula.forEach(n => {
        let z = n.z - warpFactor * 2; if (z <= 0) { z += 2000; }
        const scale = 800 / z;
        const screenX = (n.x - shiftX) * scale + cx; const screenY = (n.y - shiftY) * scale + cy;
        const size = n.size * scale;
        if (size > 0 && screenX > -size && screenX < canvas.width + size && screenY > -size && screenY < canvas.height + size) {
            const grad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, size);
            grad.addColorStop(0, n.color); grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad; ctx.globalAlpha = n.alpha; ctx.beginPath(); ctx.arc(screenX, screenY, size, 0, Math.PI*2); ctx.fill();
        }
    });
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;

    ctx.lineCap = 'round';
    bgLayers.stars.forEach(s => {
        let z = s.z - warpFactor;
        if (z <= 0) { 
            z = 2000; 
            if (isWarping) { s.z = 2000 + warpFactor; s.x = (Math.random() - 0.5) * canvas.width * 3; s.y = (Math.random() - 0.5) * canvas.height * 3; }
        } 
        const scale = 800 / z;
        const starShiftX = isMap ? (mapShip.x - cx) * 0.6 : 0; const starShiftY = isMap ? (mapShip.y - cy) * 0.6 : 0;
        const headX = (s.x - starShiftX) * scale + cx; const headY = (s.y - starShiftY) * scale + cy;
        const tailZ = z + warpFactor * 8; const tailScale = 800 / tailZ;
        const tailX = (s.x - starShiftX) * tailScale + cx; const tailY = (s.y - starShiftY) * tailScale + cy;
        const size = Math.max(0.5, s.size * scale);
        
        if (headX < -50 || headX > canvas.width + 50 || headY < -50 || headY > canvas.height + 50) return;

        ctx.beginPath();
        if (Math.abs(headX - tailX) < 1.0) { 
            ctx.fillStyle = s.color; ctx.globalAlpha = Math.min(1, scale * s.brightness + 0.3); ctx.arc(headX, headY, size, 0, Math.PI*2); ctx.fill();
        } else { 
            ctx.strokeStyle = s.color; ctx.lineWidth = size * 2; ctx.globalAlpha = Math.min(1, scale); ctx.moveTo(headX, headY); ctx.lineTo(tailX, tailY); ctx.stroke();
        }
    });

    if (!isWarping) {
        ctx.fillStyle = '#fff';
        bgLayers.dust.forEach(d => {
             const dustShiftX = isMap ? (mapShip.x - cx) * 0.9 : 0; const dustShiftY = isMap ? (mapShip.y - cy) * 0.9 : 0;
             const scale = 800 / d.z;
             const dx = (d.x - dustShiftX) * scale + cx; const dy = (d.y - dustShiftY) * scale + cy;
             const wrapX = (dx % canvas.width + canvas.width) % canvas.width; const wrapY = (dy % canvas.height + canvas.height) % canvas.height;
             ctx.globalAlpha = d.alpha * 0.5; ctx.fillRect(wrapX, wrapY, d.size, d.size);
        });
    }
    ctx.globalAlpha = 1; ctx.lineCap = 'butt';
}