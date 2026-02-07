const mapUI = document.getElementById('mapUI');
const jumpBtn = document.getElementById('jumpBtn');
const dockBtn = document.getElementById('dockBtn');
const chargeBar = document.getElementById('chargeBar');
const chargeContainer = document.getElementById('chargeBarContainer');

const MAP_BLOCK_SIZE = 6;
const mapShip = { x: 0, y: 0, angle: -Math.PI / 2, vx: 0, vy: 0, thrust: 0.05, rotationSpeed: 0.04, friction: 0.99 };

// --- ВАРП ---
let warpFactor = 0, isWarping = false;
const WARP_IDLE=0, WARP_CHARGE=1, WARP_JUMP=2, WARP_COAST=3, WARP_EXIT=4;
let warpState = { phase: WARP_IDLE, timer: 0 };
let btnErrorTimer = 0;

// --- ЛОГИКА АВТО-ПРЫЖКА ---
let autoJumpState = { active: false, jumpsLeft: 0, finalTargetType: null };

function startAutoJumpSequence(count, targetType) {
    if (autoJumpState.active) return;
    
    // ЗАЩИТА ОТ ЗАПУСКА ПРИ СТЫКОВКЕ
    if (isDocked) {
        jumpBtn.innerHTML = "ОТСТЫКУЙТЕСЬ [F]";
        jumpBtn.style.color = "#ff1744";
        btnErrorTimer = 60;
        return;
    }

    const fuel = getFuelCount();
    if (fuel < count) {
        jumpBtn.innerHTML = "ТРЕБУЕТСЯ ТОПЛИВО";
        jumpBtn.style.color = "#ff1744";
        jumpBtn.style.borderColor = "#ff1744";
        btnErrorTimer = 60;
        return;
    }
    autoJumpState.active = true;
    autoJumpState.jumpsLeft = count;
    autoJumpState.finalTargetType = targetType;
    executeAutoJumpStep();
}

function executeAutoJumpStep() {
    if (!autoJumpState.active) return;
    if (autoJumpState.jumpsLeft > 1) nextJumpTarget = null; 
    else nextJumpTarget = autoJumpState.finalTargetType;
    initiateHyperJump(true); 
}

function initiateHyperJump(isAuto = false) {
    if (currentState !== STATE_MAP) {
        startTransition(STATE_MAP);
        setTimeout(() => initiateHyperJump(isAuto), 1000);
        return;
    }
    if (isWarping) return;
    
    // ЗАЩИТА: Нельзя прыгать при стыковке
    if (isDocked) { 
        jumpBtn.innerHTML = "ОТСТЫКУЙТЕСЬ [F]"; jumpBtn.style.color = "#ff1744"; btnErrorTimer = 60; return; 
    }
    
    const fuel = getFuelCount();
    if (fuel < 1) { 
        autoJumpState.active = false; jumpBtn.innerHTML = "НЕТ ТОПЛИВА"; jumpBtn.style.color = "#ff1744"; btnErrorTimer = 60; return; 
    }
    if (pendingJumpCost > 0 && player.credits < pendingJumpCost) { 
        jumpBtn.innerHTML = "НЕТ СРЕДСТВ"; jumpBtn.style.color = "#ff1744"; btnErrorTimer = 60; return; 
    }

    consumeFuel(1);
    if (pendingJumpCost > 0) { player.credits -= pendingJumpCost; updateCurrencyUI(); }
    if (typeof spectrumState !== 'undefined') { spectrumState.hasScanned = false; spectrumState.signals = []; spectrumState.lockedIndex = -1; }

    // ГЕНЕРАЦИЯ НОВОЙ СЛУЧАЙНОЙ ТЕМЫ ДЛЯ СЛЕДУЮЩЕГО СЕКТОРА
    bgState.nextTheme = generateRandomTheme();
    bgState.progress = 0;

    isWarping = true; warpState.phase = WARP_CHARGE; warpState.timer = 0; warpFactor = 0;
    chargeContainer.style.display = 'block'; 
    chargeBar.style.backgroundColor = isAuto ? '#d500f9' : '#00e5ff'; 
    jumpBtn.disabled = true; 
    jumpBtn.innerHTML = isAuto ? `АВТОПИЛОТ (${autoJumpState.jumpsLeft})` : "ЗАРЯДКА ДВИГАТЕЛЯ...";
    jumpBtn.style.color = isAuto ? "#d500f9" : "#ff5252"; 
    jumpBtn.style.borderColor = "#ff5252";
    isDocked = false; dockBtn.style.display = 'none';
}

function updateWarpLogic() {
    if (btnErrorTimer > 0) { btnErrorTimer--; return; }

    // ФИЗИКА ТЕКУЩЕЙ СИСТЕМЫ
    if (!isWarping) {
        if (currentSystemType === 'system') updateSystemPhysics();
        else if (currentSystemType === 'black_hole') updateBlackHolePhysics();
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

    // ЛОГИКА ФАЗ ВАРПА
    if (warpState.phase === WARP_CHARGE) {
        warpState.timer++; warpFactor = (warpState.timer / 100) * 1; 
        chargeBar.style.width = (warpState.timer)+'%';
        if (warpState.timer >= 100) { warpState.phase = WARP_JUMP; warpState.timer = 0; jumpBtn.innerHTML = "ПРЫЖОК!"; }
    } 
    else if (warpState.phase === WARP_JUMP) {
        warpState.timer++; warpFactor += 2 + (warpFactor * 0.1); 
        bgState.progress = Math.min(0.5, bgState.progress + 0.01);
        if (warpFactor > 150) { warpFactor = 150; warpState.phase = WARP_COAST; warpState.timer = 0; }
    } 
    else if (warpState.phase === WARP_COAST) {
        warpState.timer++; 
        if (warpState.timer === 20) { currentSystemType = null; jumpBtn.innerHTML = "В ПУТИ..."; }
        if (warpState.timer > 80) { 
            warpState.phase = WARP_EXIT; warpState.timer = 0; 
            currentSystemType = nextJumpTarget;
            
            // ГЕНЕРАЦИЯ НОВОЙ ЛОКАЦИИ
            if (currentSystemType === 'station') {
                station.x = Math.random() * canvas.width; station.y = Math.random() * canvas.height; station.visible = true;
                generateStation();
            } else if (currentSystemType === 'system') {
                generateRealRandomSystem(); 
            } else if (currentSystemType === 'black_hole') {
                generateBlackHole();
            }
            nextJumpTarget = null; pendingJumpCost = 0; jumpBtn.innerHTML = "ПРИБЫТИЕ..."; 
        }
    } 
    else if (warpState.phase === WARP_EXIT) {
        warpFactor *= 0.90; bgState.progress = Math.min(1.0, bgState.progress + 0.015);
        if (warpFactor < 0.1) {
            warpFactor = 0; isWarping = false; isDocked = false; 
            if (window.resetSpectrum) window.resetSpectrum();

            if (autoJumpState.active) {
                autoJumpState.jumpsLeft--;
                if (autoJumpState.jumpsLeft > 0) {
                    jumpBtn.innerHTML = `ПОДГОТОВКА ПРЫЖКА (${autoJumpState.jumpsLeft})...`;
                    setTimeout(() => executeAutoJumpStep(), 1500);
                } else {
                    autoJumpState.active = false; jumpBtn.innerHTML = "ПУНКТ НАЗНАЧЕНИЯ";
                    setTimeout(() => { jumpBtn.innerHTML = "ГИПЕРПРЫЖОК"; jumpBtn.disabled = false; }, 2000);
                }
            } else {
                jumpBtn.disabled = false; jumpBtn.innerHTML = "ГИПЕРПРЫЖОК"; 
            }
            
            warpState.phase = WARP_IDLE;
            chargeContainer.style.display = 'none'; chargeBar.style.width = '0%'; 
            
            // ФИКСАЦИЯ НОВОЙ ТЕМЫ КАК ТЕКУЩЕЙ
            bgState.currentTheme = bgState.nextTheme; 
            bgState.progress = 0;

            if(window.updateGlobalPrices) updateGlobalPrices();
            if (currentSystemType === 'station' && window.generateStationInventory) {
                if (window.marketState && (!window.marketState.items || window.marketState.items.length === 0)) if(window.initMarket) initMarket();
                generateStationInventory();
            }
            
            // Телепорт в центр если улетели далеко
            if (mapShip.x < -1000 || mapShip.x > canvas.width + 1000 || mapShip.y < -1000 || mapShip.y > canvas.height + 1000) {
                 mapShip.x = canvas.width/2; mapShip.y = canvas.height/2; mapShip.vx = 0; mapShip.vy = 0;
            }
        }
    }
}

// --- СЛУЧАЙНАЯ ГЕНЕРАЦИЯ ФОНА ---

// Вспомогательная функция для случайного числа в диапазоне
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Преобразование RGB в HEX
function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + (b | 0)).toString(16).slice(1);
}

// Парсинг HEX в RGB
function hexToRgb(hex) {
    const bigint = parseInt(hex.replace('#', ''), 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

// Линейная интерполяция цвета
function lerpColor(c1, c2, t) {
    const rgb1 = hexToRgb(c1);
    const rgb2 = hexToRgb(c2);
    const r = Math.round(rgb1[0] + (rgb2[0] - rgb1[0]) * t);
    const g = Math.round(rgb1[1] + (rgb2[1] - rgb1[1]) * t);
    const b = Math.round(rgb1[2] + (rgb2[2] - rgb1[2]) * t);
    return rgbToHex(r, g, b);
}

// Генератор случайной темы
function generateRandomTheme() {
    // Фон всегда темный (значения 0-25) для реалистичности космоса
    // Но с легким оттенком (чуть больше красного, синего или зеленого)
    const rBg = randInt(0, 20);
    const gBg = randInt(0, 20);
    const bBg = randInt(0, 25); 
    const bg = rgbToHex(rBg, gBg, bBg);

    // Цвета звезд/туманностей - яркие и насыщенные (50-255)
    const colors = [];
    for(let i = 0; i < 3; i++) {
        colors.push(rgbToHex(randInt(50, 255), randInt(50, 255), randInt(50, 255)));
    }

    return { bg, colors };
}

// Состояние фона
let bgState = { 
    currentTheme: generateRandomTheme(), 
    nextTheme: generateRandomTheme(), 
    progress: 0, 
    stars: [], 
    nebula: [] 
};

// Функция получения текущей палитры (смешивание между current и next)
function getInterpolatedPalette(t) {
    const t1 = bgState.currentTheme;
    const t2 = bgState.nextTheme;
    
    // Смешиваем фон
    const bg = lerpColor(t1.bg, t2.bg, t);
    
    // Смешиваем цвета звезд (массивы могут быть разной длины, берем макс)
    const colors = [];
    const len = Math.max(t1.colors.length, t2.colors.length);
    for(let i = 0; i < len; i++) {
        const c1 = t1.colors[i % t1.colors.length];
        const c2 = t2.colors[i % t2.colors.length];
        colors.push(lerpColor(c1, c2, t));
    }
    
    return { bg, colors };
}

function initSpace() {
    mapShip.x = canvas.width / 2; mapShip.y = canvas.height / 2;
    currentSystemType = null;
    bgState.stars = [];
    for(let i=0; i<1000; i++) bgState.stars.push({ x: (Math.random()-0.5)*canvas.width*3, y: (Math.random()-0.5)*canvas.height*3, z: Math.random()*2000+10, size: Math.random()*1.5+0.5, colorIdx: Math.floor(Math.random()*3) });
    bgState.nebula = [];
    for(let i=0; i<20; i++) bgState.nebula.push({ x: (Math.random()-0.5)*canvas.width*4, y: (Math.random()-0.5)*canvas.height*4, z: Math.random()*1500+500, size: 400+Math.random()*600, colorIdx: Math.floor(Math.random()*3) });
    station.x = -10000; station.y = -10000; station.visible = false; 
    if(window.initMarket) initMarket(); 
}

function drawSpaceBackground(isMap) {
    const palette = getInterpolatedPalette(bgState.progress);
    ctx.fillStyle = palette.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width / 2, cy = canvas.height / 2;
    let shiftX = 0, shiftY = 0;
    if (isMap) { shiftX = (mapShip.x - cx) * 0.4; shiftY = (mapShip.y - cy) * 0.4; }

    ctx.globalCompositeOperation = 'lighter';
    bgState.nebula.forEach(n => {
        n.z -= warpFactor * 1.5; if (n.z <= 0) n.z += 2000;
        const scale = 800 / n.z;
        const screenX = (n.x - shiftX) * scale + cx, screenY = (n.y - shiftY) * scale + cy;
        const size = n.size * scale;
        if (size > 0 && n.z > 10 && screenX > -size && screenX < canvas.width + size) {
            const grad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, size);
            grad.addColorStop(0, palette.colors[n.colorIdx % palette.colors.length]); grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad; ctx.globalAlpha = 0.15 * Math.max(0.1, 1 - (warpFactor / 100)); 
            ctx.beginPath(); ctx.arc(screenX, screenY, size, 0, Math.PI*2); ctx.fill();
        }
    });
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.lineCap = 'round';
    
    bgState.stars.forEach(s => {
        s.z -= warpFactor; 
        if (s.z <= 0) { s.z += 2000; if (isWarping) { s.x = (Math.random()-0.5)*canvas.width*4; s.y = (Math.random()-0.5)*canvas.height*4; } } 
        const scale = 800 / s.z;
        const starShiftX = isMap ? (mapShip.x - cx) * 0.6 : 0; 
        const starShiftY = isMap ? (mapShip.y - cy) * 0.6 : 0;
        const headX = (s.x - starShiftX) * scale + cx, headY = (s.y - starShiftY) * scale + cy;
        const tailX = (s.x - starShiftX) * (800 / (s.z + Math.max(1, warpFactor * 5))) + cx, tailY = (s.y - starShiftY) * (800 / (s.z + Math.max(1, warpFactor * 5))) + cy;
        if (headX < -100 || headX > canvas.width + 100) return;

        if (Math.abs(headX - tailX) < 1.5 && Math.abs(headY - tailY) < 1.5) { 
            ctx.fillStyle = palette.colors[s.colorIdx % palette.colors.length]; ctx.globalAlpha = Math.min(1, scale + 0.3); 
            ctx.beginPath(); ctx.arc(headX, headY, Math.max(0.5, s.size * scale), 0, Math.PI*2); ctx.fill();
        } else { 
            ctx.strokeStyle = palette.colors[s.colorIdx % palette.colors.length]; ctx.lineWidth = Math.max(0.5, s.size * scale); 
            ctx.globalAlpha = Math.min(1, scale); ctx.beginPath(); ctx.moveTo(headX, headY); ctx.lineTo(tailX, tailY); ctx.stroke();
        }
    });
    ctx.globalAlpha = 1; ctx.lineCap = 'butt';
}

function drawMap() {
    drawSpaceBackground(true);
    const cx = canvas.width / 2, cy = canvas.height / 2;
    let parallaxScale = 1, isActive = false, objAlpha = 1;

    if (isWarping) {
        if (warpState.phase === WARP_JUMP || warpState.phase === WARP_COAST) {
             parallaxScale = 1 + (warpFactor / 20); objAlpha = Math.max(0, 1 - (warpFactor / 60)); if (objAlpha > 0.01) isActive = true;
        } else if (warpState.phase === WARP_EXIT) {
             parallaxScale = 1 - (warpFactor / 150); if (parallaxScale < 0) parallaxScale = 0; isActive = true; objAlpha = 1; 
        } else isActive = true; 
    } else isActive = true;

    if (isActive && currentSystemType) {
        if (currentSystemType === 'station') renderStation(cx, cy, parallaxScale, objAlpha);
        else if (currentSystemType === 'system') renderSystem(cx, cy, parallaxScale, objAlpha);
        else if (currentSystemType === 'black_hole') renderBlackHole(cx, cy, parallaxScale, objAlpha);
    }

    ctx.save(); ctx.translate(mapShip.x, mapShip.y); ctx.rotate(mapShip.angle);
    if (warpState.phase === WARP_CHARGE) { const shake = warpFactor * 2; ctx.translate(Math.random() * shake - shake / 2, Math.random() * shake - shake / 2); }
    if (isWarping && warpFactor > 1) ctx.scale(1, 1 + warpFactor / 50);
    ctx.shadowBlur = 10; ctx.shadowColor = '#00e676'; ctx.fillStyle = '#00e676'; 
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, 5); ctx.lineTo(-3, 0); ctx.lineTo(-6, -5); ctx.fill(); ctx.shadowBlur = 0;
    if (inputs.up && !isWarping && !isDocked) { ctx.fillStyle = '#ffb74d'; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-12, 4); ctx.lineTo(-12, -4); ctx.fill(); }
    ctx.restore();
}