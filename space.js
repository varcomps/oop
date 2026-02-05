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

// --- ЛОГИКА АВТО-ПРЫЖКА ---
let autoJumpState = {
    active: false,
    jumpsLeft: 0,
    finalTargetType: null
};

function startAutoJumpSequence(count, targetType) {
    if (autoJumpState.active) return;
    
    autoJumpState.active = true;
    autoJumpState.jumpsLeft = count;
    autoJumpState.finalTargetType = targetType;
    
    console.log(`Автопилот включен. Прыжков: ${count}, Цель: ${targetType}`);
    executeAutoJumpStep();
}

function executeAutoJumpStep() {
    if (!autoJumpState.active) return;

    // Если прыжков больше 1, значит следующий - промежуточный (пустой)
    if (autoJumpState.jumpsLeft > 1) {
        nextJumpTarget = null; // Пустой сектор
    } else {
        // Последний прыжок - это цель
        nextJumpTarget = autoJumpState.finalTargetType;
    }

    // Запускаем прыжок (флаг isAuto = true)
    initiateHyperJump(true); 
}

// --- УПРАВЛЕНИЕ ВАРПОМ ---
function initiateHyperJump(isAuto = false) {
    // ЗАЩИТА: Если мы не в режиме карты, переключаемся принудительно
    if (currentState !== STATE_MAP) {
        startTransition(STATE_MAP);
        // Ждем завершения перехода, затем запускаем прыжок (через таймер)
        setTimeout(() => initiateHyperJump(isAuto), 1000);
        return;
    }

    if (isWarping) return;
    if (isDocked) { alert("ОТСТЫКУЙТЕСЬ [F]"); return; }

    const fuel = getFuelCount();
    if (fuel < 1) { 
        alert("НЕТ ТОПЛИВА! АВТОПИЛОТ ОТКЛЮЧЕН."); 
        autoJumpState.active = false; 
        return; 
    }
    if (pendingJumpCost > 0 && player.credits < pendingJumpCost) { alert("НЕДОСТАТОЧНО КРЕДИТОВ (SC)!"); return; }

    consumeFuel(1);
    if (pendingJumpCost > 0) { player.credits -= pendingJumpCost; updateCurrencyUI(); }

    // Сброс сканера (безопасная проверка)
    if (typeof spectrumState !== 'undefined') {
        spectrumState.hasScanned = false;
        spectrumState.signals = [];
        spectrumState.lockedIndex = -1;
    }

    // Подготовка перехода темы
    bgState.nextThemeIdx = Math.floor(Math.random() * SPACE_THEMES.length);
    if (bgState.nextThemeIdx === bgState.currentThemeIdx) {
        bgState.nextThemeIdx = (bgState.nextThemeIdx + 1) % SPACE_THEMES.length;
    }
    bgState.progress = 0;

    isWarping = true; 
    warpState.phase = WARP_CHARGE; 
    warpState.timer = 0; 
    warpFactor = 0;
    
    chargeContainer.style.display = 'block'; 
    chargeBar.style.backgroundColor = isAuto ? '#d500f9' : '#00e5ff'; // Фиолетовый бар для авто
    
    const btnText = isAuto ? `АВТОПИЛОТ (${autoJumpState.jumpsLeft})` : "ЗАРЯДКА ДВИГАТЕЛЯ...";
    jumpBtn.disabled = true; 
    jumpBtn.innerHTML = btnText;
    jumpBtn.style.color = isAuto ? "#d500f9" : "#ff5252"; 
    jumpBtn.style.borderColor = "#ff5252";
    isDocked = false; dockBtn.style.display = 'none';
}

function updateWarpLogic() {
    // --- ФИЗИКА СИСТЕМЫ (Звезда и Планеты) ---
    if (!isWarping && currentSystemType === 'system' && starSystem.active) {
        
        // 1. ФИЗИКА ЗВЕЗДЫ (ЦЕНТР)
        const sDx = starSystem.starX - mapShip.x;
        const sDy = starSystem.starY - mapShip.y;
        const sDist = Math.hypot(sDx, sDy);
        const starRadius = starSystem.starSize; 
        const shipRadius = 4;
        
        // Гравитация звезды (ОСЛАБЛЕННАЯ, чтобы можно улететь)
        if (sDist < starRadius * 15) { 
            const starG = 3.0; // Слабая тяга
            const force = starG / (sDist * 0.8 + 200); 
            mapShip.vx += (sDx / sDist) * force;
            mapShip.vy += (sDy / sDist) * force;
        }

        // Хитбокс звезды
        if (sDist < starRadius + shipRadius) {
             const nx = sDx / sDist;
             const ny = sDy / sDist;
             
             const overlap = (starRadius + shipRadius) - sDist;
             mapShip.x -= nx * overlap;
             mapShip.y -= ny * overlap;

             const dot = mapShip.vx * nx + mapShip.vy * ny;
             mapShip.vx = (mapShip.vx - 2 * dot * nx) * 0.5;
             mapShip.vy = (mapShip.vy - 2 * dot * ny) * 0.5;
        }

        // 2. ФИЗИКА ПЛАНЕТ (НОРМАЛЬНАЯ)
        starSystem.planets.forEach(p => {
            const pX = starSystem.starX + Math.cos(p.angle) * p.dist;
            const pY = starSystem.starY + Math.sin(p.angle) * p.dist;
            
            const dx = pX - mapShip.x;
            const dy = pY - mapShip.y;
            const dist = Math.hypot(dx, dy);
            
            const planetRadius = p.size;
            const collisionDist = planetRadius + shipRadius;

            // Гравитация планеты (Нормальная)
            const gravityRange = p.size * 15; 
            if (dist < gravityRange) {
                const G = 0.8; 
                const force = (G * p.size) / (dist * dist + 100); 
                mapShip.vx += (dx / dist) * force;
                mapShip.vy += (dy / dist) * force;
            }

            // Хитбокс планеты
            if (dist < collisionDist) {
                const nx = dx / dist;
                const ny = dy / dist;

                const overlap = collisionDist - dist;
                mapShip.x -= nx * overlap;
                mapShip.y -= ny * overlap;

                const dot = mapShip.vx * nx + mapShip.vy * ny;
                const bounce = 0.5;
                mapShip.vx = (mapShip.vx - 2 * dot * nx) * bounce;
                mapShip.vy = (mapShip.vy - 2 * dot * ny) * bounce;
            }
        });
    }

    if (!isWarping) {
        if (isDocked) {
             jumpBtn.innerHTML = "СИСТЕМА: СТЫКОВКА"; jumpBtn.disabled = true; 
             jumpBtn.style.borderColor = "#444"; jumpBtn.style.color = "#555";
        } else {
            const fuel = getFuelCount();
            if (fuel > 0) {
                 jumpBtn.innerHTML = "ГИПЕРПРЫЖОК"; jumpBtn.disabled = false; jumpBtn.style.borderColor = "#ff5252"; jumpBtn.style.color = "#ff5252";
            } else {
                 jumpBtn.innerHTML = "НЕТ ТОПЛИВА"; jumpBtn.disabled = true; jumpBtn.style.removeProperty('border-color');
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
            jumpBtn.innerHTML = "ПРЫЖОК!"; 
        }
    } 
    else if (warpState.phase === WARP_JUMP) {
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
        warpState.timer++; 
        if (warpState.timer === 20) {
            currentSystemType = null; 
            jumpBtn.innerHTML = "В ПУТИ..."; 
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
                generateRealRandomSystem(); 
            } else if (currentSystemType === 'black_hole') {
                generateBlackHole();
            }
            nextJumpTarget = null;
            pendingJumpCost = 0;
            jumpBtn.innerHTML = "ПРИБЫТИЕ..."; 
        }
    } 
    else if (warpState.phase === WARP_EXIT) {
        warpFactor *= 0.90; 
        bgState.progress = Math.min(1.0, bgState.progress + 0.015);

        if (warpFactor < 0.1) {
            warpFactor = 0; 
            isWarping = false;
            
            // Сбрасываем стыковку
            isDocked = false; 
            
            // Сброс сканера (объект может быть пересоздан в spectrum.js, поэтому проверяем)
            if (typeof spectrumState !== 'undefined') {
                spectrumState = {
                    hasScanned: false,
                    signals: [],
                    lockedIndex: -1
                };
            }

            // ЛОГИКА АВТО-ПРЫЖКА
            if (autoJumpState.active) {
                autoJumpState.jumpsLeft--;
                
                if (autoJumpState.jumpsLeft > 0) {
                    // Если прыжки остались, ждем немного и прыгаем снова
                    jumpBtn.innerHTML = `ПОДГОТОВКА ПРЫЖКА (${autoJumpState.jumpsLeft})...`;
                    setTimeout(() => {
                        executeAutoJumpStep();
                    }, 1500); // Пауза 1.5 сек перед следующим прыжком
                } else {
                    // Прилетели!
                    autoJumpState.active = false;
                    jumpBtn.innerHTML = "ПУНКТ НАЗНАЧЕНИЯ";
                    setTimeout(() => { jumpBtn.innerHTML = "ГИПЕРПРЫЖОК"; jumpBtn.disabled = false; }, 2000);
                }
            } else {
                // Обычный выход
                jumpBtn.disabled = false;
                jumpBtn.innerHTML = "ГИПЕРПРЫЖОК"; 
            }
            
            warpState.phase = WARP_IDLE;
            chargeContainer.style.display = 'none'; 
            chargeBar.style.width = '0%'; 
            
            bgState.currentThemeIdx = bgState.nextThemeIdx;
            bgState.progress = 0;

            if(window.updateGlobalPrices) updateGlobalPrices();
            
            if (currentSystemType === 'station' && window.generateStationInventory) {
                if (window.marketState && (!window.marketState.items || window.marketState.items.length === 0)) {
                     if(window.initMarket) initMarket();
                }
                generateStationInventory();
            }
            
            if (mapShip.x < -1000 || mapShip.x > canvas.width + 1000 || mapShip.y < -1000 || mapShip.y > canvas.height + 1000) {
                 mapShip.x = canvas.width/2;
                 mapShip.y = canvas.height/2;
                 mapShip.vx = 0; mapShip.vy = 0;
            }
        }
    }
}

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

function initSpace() {
    mapShip.x = canvas.width / 2; mapShip.y = canvas.height / 2;
    // Старт в пустом секторе
    currentSystemType = null;
    
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

    station.x = -10000;
    station.y = -10000;
    station.visible = false; 
    
    // Инициализация рынка
    if(window.initMarket) initMarket(); 
}

// --- ГЕНЕРАТОР СИСТЕМ ---
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

// Генерация станции (внутренности)
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

// --- НОВАЯ ФИЗИКА ЧЕРНОЙ ДЫРЫ ---
window.updateBlackHolePhysics = function() {
    if (currentSystemType !== 'black_hole' || isWarping) return;

    const dx = blackHole.x - mapShip.x;
    const dy = blackHole.y - mapShip.y;
    const distSq = dx*dx + dy*dy;
    const dist = Math.sqrt(distSq);

    // Радиус гравитационного захвата (например, 700px)
    const gravityRadius = 700;
    
    if (dist < gravityRadius && dist > 1) {
        // Сила притяжения (чем ближе, тем сильнее)
        const gravityStrength = 15.0; 
        const force = gravityStrength / (distSq * 0.005 + 100); 

        mapShip.vx += (dx / dist) * force;
        mapShip.vy += (dy / dist) * force;
    }

    // ГОРИЗОНТ СОБЫТИЙ (ЭКСТРЕННЫЙ ВАРП)
    // Если корабль касается "тела" дыры
    if (dist < blackHole.radius * 1.2) {
        forceEmergencyWarp();
    }
};

function forceEmergencyWarp() {
    if (isWarping) return;
    
    // Эффект экстренного прыжка
    const rand = Math.random();
    if (rand < 0.5) nextJumpTarget = 'station';
    else if (rand < 0.9) nextJumpTarget = 'system';
    else nextJumpTarget = 'black_hole';

    pendingJumpCost = 0; 
    
    // Безопасный доступ
    if (typeof spectrumState !== 'undefined') {
        spectrumState.hasScanned = false; 
    }

    isWarping = true;
    warpState.phase = WARP_JUMP; 
    warpState.timer = 0;
    warpFactor = 10; 

    bgState.nextThemeIdx = Math.floor(Math.random() * SPACE_THEMES.length);
    bgState.progress = 0;

    chargeContainer.style.display = 'block'; 
    chargeBar.style.width = '100%';
    chargeBar.style.backgroundColor = '#d500f9'; 
    jumpBtn.disabled = true; 
    jumpBtn.innerHTML = "ЭКСТРЕННЫЙ ПРЫЖОК!";
    jumpBtn.style.color = "#d500f9";
    jumpBtn.style.borderColor = "#d500f9";
    isDocked = false; dockBtn.style.display = 'none';
}

// --- ОТРИСОВКА ФОНА ---
function drawSpaceBackground(isMap) {
    const palette = getInterpolatedPalette(bgState.progress);
    
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2; 
    const cy = canvas.height / 2;
    let shiftX = 0, shiftY = 0;
    if (isMap) { shiftX = (mapShip.x - cx) * 0.4; shiftY = (mapShip.y - cy) * 0.4; }

    ctx.globalCompositeOperation = 'lighter';
    
    bgState.nebula.forEach(n => {
        n.z -= warpFactor * 1.5; 
        if (n.z <= 0) n.z += 2000;

        const scale = 800 / n.z;
        const screenX = (n.x - shiftX) * scale + cx; 
        const screenY = (n.y - shiftY) * scale + cy;
        const size = n.size * scale;
        
        if (size > 0 && n.z > 10 && screenX > -size && screenX < canvas.width + size && screenY > -size && screenY < canvas.height + size) {
            const grad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, size);
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
        const color = palette.colors[s.colorIdx % palette.colors.length];

        if (headX < -100 || headX > canvas.width + 100 || headY < -100 || headY > canvas.height + 100) return;

        ctx.beginPath();
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
                ctx.rotate(time * 0.05);
                
                // УБРАНА ОБВОДКА (stroke) ЗДЕСЬ
                
                ctx.fillStyle = '#263238'; 
                ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#455a64';
                ctx.lineWidth = 2;
                ctx.stroke();
                const arms = 3;
                for(let i=0; i<arms; i++) {
                    ctx.save();
                    ctx.rotate((Math.PI*2 / arms) * i);
                    ctx.fillStyle = '#37474f';
                    ctx.fillRect(-3, 10, 6, 25);
                    ctx.fillStyle = '#1a2327';
                    ctx.strokeStyle = '#00bcd4'; 
                    ctx.lineWidth = 1;
                    ctx.fillRect(-8, 35, 16, 10);
                    ctx.strokeRect(-8, 35, 16, 10);
                    ctx.fillStyle = Math.sin(time * 2 + i) > 0 ? '#00e676' : '#1b5e20';
                    ctx.beginPath(); ctx.arc(0, 32, 1.5, 0, Math.PI*2); ctx.fill();
                    ctx.restore();
                }
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
                ctx.shadowBlur = 60 * parallaxScale; ctx.shadowColor = starSystem.coronaColor;
                ctx.fillStyle = starSystem.coronaColor;
                ctx.beginPath(); ctx.arc(0, 0, starSize * 1.2, 0, Math.PI*2); ctx.fill();
                ctx.shadowBlur = 20 * parallaxScale; ctx.shadowColor = starSystem.starColor;
                ctx.fillStyle = starSystem.starColor;
                ctx.beginPath(); ctx.arc(0, 0, starSize, 0, Math.PI*2); ctx.fill();
                ctx.shadowBlur = 0;
                starSystem.planets.forEach(p => {
                    const screenDist = p.dist * parallaxScale; const planetSize = p.size * parallaxScale;
                    p.angle += p.speed; const px = Math.cos(p.angle) * screenDist; const py = Math.sin(p.angle) * screenDist;
                    if (parallaxScale < 5) { 
                        ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1 * parallaxScale; 
                        ctx.beginPath(); ctx.arc(0,0, screenDist, 0,Math.PI*2); ctx.stroke(); 
                    }
                    ctx.fillStyle = p.color; 
                    ctx.beginPath(); ctx.arc(px, py, planetSize, 0, Math.PI*2); ctx.fill();
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