const mapUI = document.getElementById('mapUI');
const jumpBtn = document.getElementById('jumpBtn');
const dockBtn = document.getElementById('dockBtn');
const chargeBar = document.getElementById('chargeBar');
const chargeContainer = document.getElementById('chargeBarContainer');

const MAP_BLOCK_SIZE = 6;
const mapShip = { x: 0, y: 0, angle: -Math.PI / 2, vx: 0, vy: 0, thrust: 0.05, rotationSpeed: 0.04, friction: 0.99 };

// --- ОБЪЕКТЫ КОСМОСА ---
let station = { x: 0, y: 0, dockingRadius: 150, visible: true }; 
let starSystem = { active: false, starType: 'G', starSize: 30, starColor: '#ffcc00', coronaColor: '#ffe57f', planets: [] };
let blackHole = { x: 0, y: 0, radius: 0, diskParticles: [] }; 

let stationTiles = []; 
let stationModules = [];
window.stationZones = []; 

// --- ВАРП ---
let warpFactor = 0, isWarping = false;
const WARP_IDLE=0, WARP_CHARGE=1, WARP_JUMP=2, WARP_COAST=3, WARP_EXIT=4;
let warpState = { phase: WARP_IDLE, timer: 0 };

// --- ГЕНЕРАТОР ЦВЕТОВЫХ ТЕМ ---
const SPACE_THEMES = [
    { name: "Standard Sector", bg: '#050505', colors: ['#ffffff', '#fff8e1', '#b3e5fc'] },
    { name: "Crimson Nebula", bg: '#1a0000', colors: ['#ff1744', '#b71c1c', '#ff8a80'] },
    { name: "Deep Ocean", bg: '#000a12', colors: ['#00e5ff', '#00b0ff', '#80d8ff'] },
    { name: "Toxic Waste", bg: '#0a1a00', colors: ['#76ff03', '#64dd17', '#ccff90'] },
    { name: "Violet Void", bg: '#0a001a', colors: ['#d500f9', '#aa00ff', '#ea80fc'] },
    { name: "Golden Expanse", bg: '#1a1200', colors: ['#ffab00', '#ff6d00', '#ffe57f'] }
];

let bgState = {
    currentThemeIdx: 0,
    nextThemeIdx: 0,
    progress: 0, // 0.0 (old) -> 1.0 (new)
    stars: [],
    nebula: []
};

// --- УТИЛИТЫ ЦВЕТА ---
function hexToRgb(hex) {
    const bigint = parseInt(hex.replace('#', ''), 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + (b | 0)).toString(16).slice(1);
}

function lerpColor(c1, c2, t) {
    const rgb1 = hexToRgb(c1);
    const rgb2 = hexToRgb(c2);
    const r = Math.round(rgb1[0] + (rgb2[0] - rgb1[0]) * t);
    const g = Math.round(rgb1[1] + (rgb2[1] - rgb1[1]) * t);
    const b = Math.round(rgb1[2] + (rgb2[2] - rgb1[2]) * t);
    return rgbToHex(r, g, b);
}

function getInterpolatedPalette(t) {
    const t1 = SPACE_THEMES[bgState.currentThemeIdx];
    const t2 = SPACE_THEMES[bgState.nextThemeIdx];
    
    // Интерполяция фона
    const bg = lerpColor(t1.bg, t2.bg, t);
    
    // Интерполяция массива цветов звезд (берем по модулю, если длины разные)
    const colors = [];
    const len = Math.max(t1.colors.length, t2.colors.length);
    for(let i=0; i<len; i++) {
        const c1 = t1.colors[i % t1.colors.length];
        const c2 = t2.colors[i % t2.colors.length];
        colors.push(lerpColor(c1, c2, t));
    }
    return { bg, colors };
}

// --- ИНИЦИАЛИЗАЦИЯ ---
function initSpace() {
    mapShip.x = canvas.width / 2; mapShip.y = canvas.height / 2;
    currentSystemType = 'station';
    
    // Инициализация звезд
    bgState.stars = [];
    for(let i=0; i<1000; i++) {
        bgState.stars.push({
            x: (Math.random() - 0.5) * canvas.width * 3,
            y: (Math.random() - 0.5) * canvas.height * 3,
            z: Math.random() * 2000 + 10,
            size: Math.random() * 1.5 + 0.5,
            colorIdx: Math.floor(Math.random() * 3) // Индекс цвета в палитре
        });
    }

    // Инициализация туманностей
    bgState.nebula = [];
    for(let i=0; i<20; i++) {
        bgState.nebula.push({
            x: (Math.random() - 0.5) * canvas.width * 4,
            y: (Math.random() - 0.5) * canvas.height * 4,
            z: Math.random() * 1500 + 500,
            size: 400 + Math.random() * 600,
            colorIdx: Math.floor(Math.random() * 3)
        });
    }

    station.x = Math.random() * canvas.width;
    station.y = Math.random() * canvas.height;
    generateStation(); 
    if(window.initMarket) initMarket(); 
    if(window.generateStationInventory) generateStationInventory(); 
}

// --- ГЕНЕРАТОР СИСТЕМ ---
const STAR_TYPES = [
    { type: 'M', color: '#ff5252', corona: '#ff8a80', sizeMult: 0.8, name: "Red Dwarf" },
    { type: 'K', color: '#ff9800', corona: '#ffcc80', sizeMult: 0.9, name: "Orange Giant" },
    { type: 'G', color: '#ffeb3b', corona: '#fff59d', sizeMult: 1.0, name: "Yellow Star" },
    { type: 'F', color: '#fff9c4', corona: '#ffffff', sizeMult: 1.1, name: "White-Yellow" },
    { type: 'A', color: '#e0f7fa', corona: '#ffffff', sizeMult: 1.2, name: "Blue-White" },
    { type: 'B', color: '#40c4ff', corona: '#80d8ff', sizeMult: 1.5, name: "Blue Giant" },
    { type: 'N', color: '#b388ff', corona: '#651fff', sizeMult: 0.4, name: "Neutron Star" }
];

function generateRealRandomSystem() {
    starSystem.active = true;
    
    // 1. Выбор типа звезды
    const starData = STAR_TYPES[Math.floor(Math.random() * STAR_TYPES.length)];
    starSystem.starColor = starData.color;
    starSystem.coronaColor = starData.corona;
    starSystem.starSize = 30 * starData.sizeMult + (Math.random() * 10);
    starSystem.starX = Math.random() * (canvas.width * 0.6) + canvas.width * 0.2;
    starSystem.starY = Math.random() * (canvas.height * 0.6) + canvas.height * 0.2;
    
    // 2. Генерация планет
    starSystem.planets = [];
    const planetCount = Math.floor(Math.random() * 6) + 1; // 1-6 планет
    let currentDist = 80 + starSystem.starSize; // Мин. дистанция

    for(let i=0; i<planetCount; i++) {
        currentDist += 40 + Math.random() * 60;
        
        let pColor;
        const rand = Math.random();
        
        // Логика типа планеты в зависимости от расстояния
        if (currentDist < 200) {
            // Близко к звезде: Лава или Камень
            pColor = rand > 0.5 ? '#d84315' : '#8d6e63'; 
        } else if (currentDist > 400) {
            // Далеко: Лед или Газовый гигант
            pColor = rand > 0.6 ? '#81d4fa' : '#3f51b5'; 
        } else {
            // Обитаемая зона: Терра или Пустыня
            pColor = rand > 0.7 ? '#4caf50' : '#ffcc80'; 
        }

        starSystem.planets.push({
            dist: currentDist,
            angle: Math.random() * Math.PI * 2,
            speed: (0.002 + Math.random() * 0.008) * (Math.random() > 0.5 ? 1 : -1),
            size: 5 + Math.random() * 8,
            color: pColor,
            hasRing: Math.random() > 0.8
        });
    }
}

function generateBlackHole() {
    blackHole.x = canvas.width / 2;
    blackHole.y = canvas.height / 2;
    blackHole.radius = 35 + Math.random() * 20;
    blackHole.diskParticles = [];

    const pCount = 200 + Math.random() * 200;
    for(let i=0; i<pCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = blackHole.radius * 2 + Math.random() * 150; 
        blackHole.diskParticles.push({
            angle: angle,
            dist: dist,
            speed: (600 / (dist * dist)) * (0.5 + Math.random()*0.2),
            size: Math.random() * 2 + 1,
            color: Math.random() > 0.5 ? '#e040fb' : '#7c4dff',
            alpha: Math.random() * 0.7 + 0.3
        });
    }
}

// Генерация станции (старая логика, работает норм)
function generateStation() {
    stationTiles = []; stationModules = []; window.stationZones = [];
    const fillRect = (rx, ry, rw, rh) => {
        for(let x=0; x<rw; x++) for(let y=0; y<rh; y++) { stationTiles.push({x: rx + x, y: ry + y}); }
        return {x: rx, y: ry, w: rw, h: rh, cx: rx + Math.floor(rw/2), cy: ry + Math.floor(rh/2)};
    };
    const hangarW = 32, hangarH = 18;
    const hangar = fillRect(0, 0, hangarW, hangarH);
    window.stationZones.push({ name: "ГЛАВНЫЙ АНГАР", x: hangar.x, y: hangar.y, w: hangar.w, h: hangar.h });
    let sides = [0, 1, 2, 3]; sides.sort(() => Math.random() - 0.5);
    const engSide = sides.pop(); const hubSide = sides.pop();
    const createRoom = (source, side, rw, rh, name, corrLen=3) => {
        let rx, ry, cx, cy, cw, ch;
        if (side === 0) { rx = source.x + Math.floor((source.w - rw) / 2); ry = source.y - rh - corrLen; cx = source.x + Math.floor(source.w/2) - 2; cy = source.y - corrLen; cw = 4; ch = corrLen; } 
        else if (side === 1) { rx = source.x + source.w + corrLen; ry = source.y + Math.floor((source.h - rh) / 2); cx = source.x + source.w; cy = source.y + Math.floor(source.h/2) - 2; cw = corrLen; ch = 4; } 
        else if (side === 2) { rx = source.x + Math.floor((source.w - rw) / 2); ry = source.y + source.h + corrLen; cx = source.x + Math.floor(source.w/2) - 2; cy = source.y + source.h; cw = 4; ch = corrLen; } 
        else { rx = source.x - rw - corrLen; ry = source.y + Math.floor((source.h - rh) / 2); cx = source.x - corrLen; cy = source.y + Math.floor(source.h/2) - 2; cw = corrLen; ch = 4; }
        fillRect(cx, cy, cw, ch); const room = fillRect(rx, ry, rw, rh);
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

    let marketSides = [0, 1, 2, 3].filter(s => s !== hubRoom.entranceSide && s !== reactorSide);
    if (marketSides.length > 0) {
        const marketSide = marketSides[Math.floor(Math.random() * marketSides.length)];
        const marketRoom = createRoom(hubRoom, marketSide, 12, 10, "ТОРГОВЫЙ СКЛАД");
        stationModules.push({ type: 'commodities_terminal', x: marketRoom.cx - 1, y: marketRoom.cy - 1, w: 2, h: 2 });
    }
}

// --- УПРАВЛЕНИЕ ВАРПОМ ---
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

    // Подготовка перехода темы
    bgState.nextThemeIdx = Math.floor(Math.random() * SPACE_THEMES.length);
    // Гарантируем смену темы
    if (bgState.nextThemeIdx === bgState.currentThemeIdx) {
        bgState.nextThemeIdx = (bgState.nextThemeIdx + 1) % SPACE_THEMES.length;
    }
    bgState.progress = 0;

    isWarping = true; 
    warpState.phase = WARP_CHARGE; 
    warpState.timer = 0; 
    warpFactor = 0;
    
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
        warpState.timer++; warpFactor = (warpState.timer / 100) * 1; 
        chargeBar.style.width = (warpState.timer)+'%';
        if (warpState.timer >= 100) { 
            warpState.phase = WARP_JUMP; 
            warpState.timer = 0; 
            jumpBtn.innerHTML = "ENGAGING!"; 
        }
    } 
    else if (warpState.phase === WARP_JUMP) {
        // Разгон и начало смены цвета (0 -> 0.5)
        warpState.timer++; 
        warpFactor += 2 + (warpFactor * 0.1); 
        
        bgState.progress = Math.min(0.5, bgState.progress + 0.01);

        if (warpFactor > 150) { 
            warpFactor = 150; 
            warpState.phase = WARP_COAST; 
            warpState.timer = 0; 
        }
    } 
    else if (warpState.phase === WARP_COAST) {
        // Туннель
        warpState.timer++; 
        if (warpState.timer === 20) {
            currentSystemType = null; 
            jumpBtn.innerHTML = "TRAVERSING..."; 
        }

        if (warpState.timer > 80) { 
            warpState.phase = WARP_EXIT; 
            warpState.timer = 0; 

            // Генерация нового контента
            currentSystemType = nextJumpTarget;
            if (currentSystemType === 'station') {
                station.x = Math.random() * canvas.width;
                station.y = Math.random() * canvas.height;
                station.visible = true;
                generateStation();
            } else if (currentSystemType === 'system') {
                generateRealRandomSystem(); // Новая генерация
            } else if (currentSystemType === 'black_hole') {
                generateBlackHole();
            }
            nextJumpTarget = null;
            pendingJumpCost = 0;
            jumpBtn.innerHTML = "ARRIVING..."; 
        }
    } 
    else if (warpState.phase === WARP_EXIT) {
        // Торможение и завершение смены цвета (0.5 -> 1.0)
        warpFactor *= 0.90; 
        
        bgState.progress = Math.min(1.0, bgState.progress + 0.015);

        if (warpFactor < 0.1) {
            warpFactor = 0; 
            isWarping = false; 
            warpState.phase = WARP_IDLE;
            chargeContainer.style.display = 'none'; 
            chargeBar.style.width = '0%'; 
            jumpBtn.disabled = false;
            
            // Фиксация новой темы
            bgState.currentThemeIdx = bgState.nextThemeIdx;
            bgState.progress = 0;

            if(window.updateGlobalPrices) updateGlobalPrices();
            if (currentSystemType === 'station' && window.generateStationInventory) {
                generateStationInventory();
            }
        }
    }
}

// --- ОТРИСОВКА ФОНА ---
function drawSpaceBackground(isMap) {
    // Получаем текущую палитру (интерполированную)
    const palette = getInterpolatedPalette(bgState.progress);
    
    // Заливка фона
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2; 
    const cy = canvas.height / 2;
    let shiftX = 0, shiftY = 0;
    if (isMap) { shiftX = (mapShip.x - cx) * 0.4; shiftY = (mapShip.y - cy) * 0.4; }

    ctx.globalCompositeOperation = 'lighter';
    
    // ТУМАННОСТИ
    bgState.nebula.forEach(n => {
        n.z -= warpFactor * 1.5; 
        if (n.z <= 0) n.z += 2000;

        const scale = 800 / n.z;
        const screenX = (n.x - shiftX) * scale + cx; 
        const screenY = (n.y - shiftY) * scale + cy;
        const size = n.size * scale;
        
        if (size > 0 && n.z > 10 && screenX > -size && screenX < canvas.width + size && screenY > -size && screenY < canvas.height + size) {
            const grad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, size);
            // Берем цвет из интерполированной палитры по индексу частицы
            const color = palette.colors[n.colorIdx % palette.colors.length];
            
            grad.addColorStop(0, color); 
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            
            let warpDim = Math.max(0.1, 1 - (warpFactor / 100));
            ctx.fillStyle = grad; 
            ctx.globalAlpha = 0.15 * warpDim; 
            ctx.beginPath(); ctx.arc(screenX, screenY, size, 0, Math.PI*2); ctx.fill();
        }
    });
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;

    // ЗВЕЗДЫ
    ctx.lineCap = 'round';
    bgState.stars.forEach(s => {
        s.z -= warpFactor; 
        if (s.z <= 0) {
            s.z += 2000;
            if (isWarping) {
                 s.x = (Math.random() - 0.5) * canvas.width * 4; 
                 s.y = (Math.random() - 0.5) * canvas.height * 4;
            }
        } 

        const scale = 800 / s.z;
        const starShiftX = isMap ? (mapShip.x - cx) * 0.6 : 0; 
        const starShiftY = isMap ? (mapShip.y - cy) * 0.6 : 0;
        
        const headX = (s.x - starShiftX) * scale + cx; 
        const headY = (s.y - starShiftY) * scale + cy;

        const tailZ = s.z + Math.max(1, warpFactor * 5); 
        const tailScale = 800 / tailZ;
        const tailX = (s.x - starShiftX) * tailScale + cx; 
        const tailY = (s.y - starShiftY) * tailScale + cy;
        
        const size = Math.max(0.5, s.size * scale);
        
        // Цвет звезды тоже интерполируется
        const color = palette.colors[s.colorIdx % palette.colors.length];

        if (headX < -100 || headX > canvas.width + 100 || headY < -100 || headY > canvas.height + 100) return;

        ctx.beginPath();
        // В варпе рисуем линии, в простое - точки
        if (Math.abs(headX - tailX) < 1.5 && Math.abs(headY - tailY) < 1.5) { 
            ctx.fillStyle = color; 
            ctx.globalAlpha = Math.min(1, scale + 0.3); 
            ctx.arc(headX, headY, size, 0, Math.PI*2); 
            ctx.fill();
        } 
        else { 
            ctx.strokeStyle = color; 
            ctx.lineWidth = size; 
            ctx.globalAlpha = Math.min(1, scale); 
            ctx.moveTo(headX, headY); 
            ctx.lineTo(tailX, tailY); 
            ctx.stroke();
        }
    });

    ctx.globalAlpha = 1; ctx.lineCap = 'butt';
}

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
    let objAlpha = 1;

    if (isWarping) {
        if (warpState.phase === WARP_JUMP || warpState.phase === WARP_COAST) {
             parallaxScale = 1 + (warpFactor / 20); 
             objAlpha = Math.max(0, 1 - (warpFactor / 60));
             if (objAlpha > 0.01) isActive = true;
        } 
        else if (warpState.phase === WARP_EXIT) {
             parallaxScale = 1 - (warpFactor / 150); 
             if (parallaxScale < 0) parallaxScale = 0;
             isActive = true;
             objAlpha = 1; 
        }
        else { isActive = true; } 
    } else { isActive = true; }

    if (isActive && currentSystemType) {
        ctx.globalAlpha = objAlpha; 

        if (currentSystemType === 'station') {
            const sX = cx + (station.x - cx) * parallaxScale;
            const sY = cy + (station.y - cy) * parallaxScale;
            
            if (parallaxScale > 0.05 && parallaxScale < 8) {
                ctx.save();
                ctx.translate(sX, sY);
                ctx.scale(parallaxScale, parallaxScale);

                // --- НОВЫЙ ВИЗУАЛ СТАНЦИИ ---
                // Медленное вращение станции
                ctx.rotate(time * 0.05);

                // Кольцо зоны стыковки (еле заметное)
                ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
                ctx.lineWidth = 1;
                ctx.setLineDash([5, 15]);
                ctx.beginPath(); 
                ctx.arc(0, 0, station.dockingRadius, 0, Math.PI * 2); 
                ctx.stroke();
                ctx.setLineDash([]);

                // Центральное ядро
                ctx.fillStyle = '#263238'; // Темный металл
                ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#455a64';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Вращающиеся рукава (3 штуки)
                const arms = 3;
                for(let i=0; i<arms; i++) {
                    ctx.save();
                    ctx.rotate((Math.PI*2 / arms) * i);
                    
                    // Соединительная балка
                    ctx.fillStyle = '#37474f';
                    ctx.fillRect(-3, 10, 6, 25);
                    
                    // Модуль на конце (солнечная панель/док)
                    ctx.fillStyle = '#1a2327';
                    ctx.strokeStyle = '#00bcd4'; // Акцент циана (неон)
                    ctx.lineWidth = 1;
                    ctx.fillRect(-8, 35, 16, 10);
                    ctx.strokeRect(-8, 35, 16, 10);

                    // Огоньки
                    ctx.fillStyle = Math.sin(time * 2 + i) > 0 ? '#00e676' : '#1b5e20';
                    ctx.beginPath(); ctx.arc(0, 32, 1.5, 0, Math.PI*2); ctx.fill();

                    ctx.restore();
                }

                // Центральный маяк (Мигающий)
                ctx.fillStyle = `rgba(0, 229, 255, ${0.5 + Math.sin(time*3)*0.4})`;
                ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill();

                ctx.restore();
            }
        }
        else if (currentSystemType === 'system') {
            const starScreenX = cx + (starSystem.starX - cx) * parallaxScale;
            const starScreenY = cy + (starSystem.starY - cy) * parallaxScale;
            
            if (parallaxScale > 0.05 && parallaxScale < 8) {
                ctx.save(); ctx.translate(starScreenX, starScreenY);
                const starSize = starSystem.starSize * parallaxScale;
                
                // Корона
                ctx.shadowBlur = 60 * parallaxScale; ctx.shadowColor = starSystem.coronaColor;
                ctx.fillStyle = starSystem.coronaColor;
                ctx.beginPath(); ctx.arc(0, 0, starSize * 1.2, 0, Math.PI*2); ctx.fill();
                
                // Ядро
                ctx.shadowBlur = 20 * parallaxScale; ctx.shadowColor = starSystem.starColor;
                ctx.fillStyle = starSystem.starColor;
                ctx.beginPath(); ctx.arc(0, 0, starSize, 0, Math.PI*2); ctx.fill();
                ctx.shadowBlur = 0;
                
                // Планеты
                starSystem.planets.forEach(p => {
                    const screenDist = p.dist * parallaxScale; const planetSize = p.size * parallaxScale;
                    p.angle += p.speed; const px = Math.cos(p.angle) * screenDist; const py = Math.sin(p.angle) * screenDist;
                    
                    if (parallaxScale < 5) { 
                        ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1 * parallaxScale; 
                        ctx.beginPath(); ctx.arc(0,0, screenDist, 0,Math.PI*2); ctx.stroke(); 
                    }
                    
                    ctx.fillStyle = p.color; 
                    ctx.beginPath(); ctx.arc(px, py, planetSize, 0, Math.PI*2); ctx.fill();
                    
                    // Кольца
                    if (p.hasRing) {
                        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2 * parallaxScale;
                        ctx.beginPath(); 
                        ctx.ellipse(px, py, planetSize * 2, planetSize * 0.5, p.angle, 0, Math.PI*2);
                        ctx.stroke();
                    }
                });
                ctx.restore();
            }
        }
        else if (currentSystemType === 'black_hole') {
            const bhX = cx + (blackHole.x - cx) * parallaxScale;
            const bhY = cy + (blackHole.y - cy) * parallaxScale;
            const scale = parallaxScale;
            
            if (scale > 0.05 && scale < 8) {
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
            }
        }
        ctx.globalAlpha = 1; 
    }

    ctx.save(); ctx.translate(mapShip.x, mapShip.y); ctx.rotate(mapShip.angle);
    if (warpState.phase === WARP_CHARGE) { const shake = warpFactor * 2; ctx.translate(Math.random() * shake - shake / 2, Math.random() * shake - shake / 2); }
    if (isWarping && warpFactor > 1) ctx.scale(1, 1 + warpFactor / 50);
    
    ctx.shadowBlur = 10; ctx.shadowColor = '#00e676'; ctx.fillStyle = '#00e676'; 
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, 5); ctx.lineTo(-3, 0); ctx.lineTo(-6, -5); ctx.fill(); ctx.shadowBlur = 0;
    
    if (inputs.up && !isWarping && !isDocked) { 
        ctx.fillStyle = '#ffb74d'; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-12, 4); ctx.lineTo(-12, -4); ctx.fill(); 
    }
    ctx.restore();
}