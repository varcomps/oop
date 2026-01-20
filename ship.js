const buildMenu = document.getElementById('buildMenu');

let shipTiles = [];
let installedModules = [];
let startGX = 0, startGY = 0;

let isBuildMenuOpen = false;
let selectedBuildItem = null;
let movingOriginalState = null;
let buildRotation = 0;

function initShip() {
    startGX = Math.floor(TARGET_COLS / 2) - 2; 
    startGY = Math.floor(TARGET_ROWS / 2) - 4; 

    shipTiles = []; installedModules = [];
    
    for (let x = 0; x < 4; x++) {
        for (let y = 0; y < 8; y++) {
            shipTiles.push({x: startGX + x, y: startGY + y});
        }
    }
    
    const airlockFloorX = startGX - 1;
    const airlockFloorY = startGY + 3;
    shipTiles.push({x: airlockFloorX, y: airlockFloorY});
    shipTiles.push({x: airlockFloorX, y: airlockFloorY + 1});

    installedModules.push({ type: 'engine', x: startGX + 1, y: startGY + 7, w: 2, h: 2 });
    installedModules.push({ type: 'storage', x: startGX + 1, y: startGY + 4, w: 2, h: 2 });
    installedModules.push({ type: 'bridge', x: startGX + 1, y: startGY + 1, w: 2, h: 2 });
    installedModules.push({ type: 'airlock', x: airlockFloorX, y: airlockFloorY, w: 1, h: 2 });

    player.x = (startGX + 2) * TILE_SIZE; player.y = (startGY + 3) * TILE_SIZE;
}

function toggleBuildMenu() {
    if (currentState !== STATE_SHIP || transition.active) return;
    isBuildMenuOpen = !isBuildMenuOpen;
    if (isBuildMenuOpen) { 
        buildMenu.style.display = 'flex'; uiHint.classList.add('shifted'); 
        const shipCenterX = (startGX + 2) * TILE_SIZE;
        const shipCenterY = (startGY + 4) * TILE_SIZE;
        viewOffset.x = canvas.width / 2 - shipCenterX;
        viewOffset.y = canvas.height / 2 - shipCenterY;
    } else {
        if (movingOriginalState) { installedModules.push(movingOriginalState); movingOriginalState = null; }
        isBuildMenuOpen = false; buildMenu.style.display = 'none'; uiHint.classList.remove('shifted'); clearCursor();
    }
    inputs.up = false; inputs.down = false; inputs.left = false; inputs.right = false;
}

function clearCursor() { selectedBuildItem = null; document.querySelectorAll('.module-item').forEach(b => b.classList.remove('active')); }
function switchTab(category) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('.category-group').forEach(group => group.classList.remove('visible'));
    document.getElementById('cat-' + category).classList.add('visible');
}
function selectModule(type) {
    if (movingOriginalState) { installedModules.push(movingOriginalState); movingOriginalState = null; }
    selectedBuildItem = type; 
    buildRotation = 0;
    document.querySelectorAll('.module-item').forEach(b => b.classList.remove('active'));
    if (event && event.currentTarget) event.currentTarget.classList.add('active');
}

// Функции строительства
function getGridFromMouse() { return { gx: Math.floor((mouseX - viewOffset.x) / TILE_SIZE), gy: Math.floor((mouseY - viewOffset.y) / TILE_SIZE) }; }
function getFloor(gx, gy) { return shipTiles.find(t => t.x === gx && t.y === gy); }
function isTileOccupiedByModule(gx, gy) { return installedModules.some(m => gx >= m.x && gx < m.x + m.w && gy >= m.y && gy < m.y + m.h); }
function getModuleWidth(type) { let w=2, h=1; if(['engine','bridge','storage'].includes(type)) {w=2;h=2;} else if(type==='airlock'){w=1;h=2;} else {w=1;h=1;} return buildRotation===1 ? h : w; }
function getModuleHeight(type) { let w=2, h=1; if(['engine','bridge','storage'].includes(type)) {w=2;h=2;} else if(type==='airlock'){w=1;h=2;} else {w=1;h=1;} return buildRotation===1 ? w : h; }

function canBuildFloor(gx, gy) {
    if (getFloor(gx, gy) || isTileOccupiedByModule(gx, gy)) return false;
    return getFloor(gx+1, gy) || getFloor(gx-1, gy) || getFloor(gx, gy+1) || getFloor(gx, gy-1);
}
function canBuildModule(gx, gy, type) {
    const w = getModuleWidth(type); const h = getModuleHeight(type);
    for (let i=0; i<w; i++) for (let j=0; j<h; j++) if (isTileOccupiedByModule(gx+i, gy+j)) return false;
    if (type === 'engine') {
        if (buildRotation !== 0) return false;
        if (!getFloor(gx, gy) || !getFloor(gx+1, gy)) return false;
        if (getFloor(gx, gy+1) || getFloor(gx+1, gy+1)) return false;
        return true;
    }
    for (let i=0; i<w; i++) for (let j=0; j<h; j++) if (!getFloor(gx+i, gy+j)) return false;
    return true;
}

function attemptBuild() {
    if (currentState !== STATE_SHIP || !isBuildMenuOpen || transition.active) return;
    const { gx, gy } = getGridFromMouse();
    if (gx < 0 || gx >= TARGET_COLS || gy < 0 || gy >= TARGET_ROWS) return;

    if (selectedBuildItem) {
        if (selectedBuildItem === 'basic') { if (canBuildFloor(gx, gy)) shipTiles.push({x: gx, y: gy}); } 
        else {
            if (canBuildModule(gx, gy, selectedBuildItem)) {
                installedModules.push({ type: selectedBuildItem, x: gx, y: gy, w: getModuleWidth(selectedBuildItem), h: getModuleHeight(selectedBuildItem) });
                movingOriginalState = null; clearCursor();
            }
        }
    }
}

// Обработчик клика в режиме строительства
canvas.addEventListener('mousedown', () => {
    isMouseDown = true;
    if (currentState === STATE_SHIP && isBuildMenuOpen) {
        if (selectedBuildItem) { attemptBuild(); return; }
        const { gx, gy } = getGridFromMouse();
        const idx = installedModules.findIndex(m => gx >= m.x && gx < m.x + m.w && gy >= m.y && gy < m.y + m.h);
        if (idx !== -1) {
            const mod = installedModules[idx];
            movingOriginalState = mod; installedModules.splice(idx, 1); selectedBuildItem = mod.type;
            if (mod.type === 'engine') buildRotation = 0;
            else { let baseW=1; if(['bridge','storage'].includes(mod.type)) baseW=2; else if(mod.type==='airlock') baseW=1; buildRotation = (mod.w!==baseW)?1:0; }
            document.querySelectorAll('.module-item').forEach(b => b.classList.remove('active'));
        }
    }
});

function drawInterior() {
    if (isBuildMenuOpen) {
        ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.beginPath();
        for (let x = 0; x <= TARGET_COLS; x++) { ctx.moveTo(x*TILE_SIZE, 0); ctx.lineTo(x*TILE_SIZE, TARGET_ROWS*TILE_SIZE); }
        for (let y = 0; y <= TARGET_ROWS; y++) { ctx.moveTo(0, y*TILE_SIZE); ctx.lineTo(TARGET_COLS*TILE_SIZE, y*TILE_SIZE); }
        ctx.stroke(); ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 2; ctx.strokeRect(0, 0, TARGET_COLS*TILE_SIZE, TARGET_ROWS*TILE_SIZE);
    }

    // Пол
    ctx.fillStyle = '#262626'; 
    shipTiles.forEach(t => ctx.fillRect(t.x * TILE_SIZE, t.y * TILE_SIZE, TILE_SIZE, TILE_SIZE));

    // --- ФИКС БРОНИ (СТЕНЫ И УГЛЫ) ---
    ctx.fillStyle = '#37474f'; 
    const hullThick = TILE_SIZE * 0.35;
    
    shipTiles.forEach(t => {
        const x = t.x * TILE_SIZE, y = t.y * TILE_SIZE;
        // Проверяем наличие соседей
        const noTop = !getFloor(t.x, t.y - 1);
        const noBottom = !getFloor(t.x, t.y + 1);
        const noLeft = !getFloor(t.x - 1, t.y);
        const noRight = !getFloor(t.x + 1, t.y);

        // Прямые стены
        if (noTop) ctx.fillRect(x - 0.5, y - hullThick, TILE_SIZE + 1, hullThick + 0.5);
        if (noBottom) ctx.fillRect(x - 0.5, y + TILE_SIZE - 0.5, TILE_SIZE + 1, hullThick + 0.5);
        if (noLeft) ctx.fillRect(x - hullThick, y - 0.5, hullThick + 0.5, TILE_SIZE + 1);
        if (noRight) ctx.fillRect(x + TILE_SIZE - 0.5, y - 0.5, hullThick + 0.5, TILE_SIZE + 1);

        // УГЛЫ
        if (noTop && noLeft) ctx.fillRect(x - hullThick, y - hullThick, hullThick + 1, hullThick + 1);
        if (noTop && noRight) ctx.fillRect(x + TILE_SIZE - 0.5, y - hullThick, hullThick + 0.5, hullThick + 1);
        if (noBottom && noLeft) ctx.fillRect(x - hullThick, y + TILE_SIZE - 0.5, hullThick + 1, hullThick + 0.5);
        if (noBottom && noRight) ctx.fillRect(x + TILE_SIZE - 0.5, y + TILE_SIZE - 0.5, hullThick + 0.5, hullThick + 0.5);
    });

    ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.beginPath(); shipTiles.forEach(t => ctx.strokeRect(t.x * TILE_SIZE, t.y * TILE_SIZE, TILE_SIZE, TILE_SIZE)); ctx.stroke();
    
    // Отрисовка модулей
    installedModules.forEach(mod => {
        if (mod.type === 'engine') drawEngine(mod.x, mod.y, mod.w, mod.h);
        if (mod.type === 'bridge') drawCaptainBridge(mod.x, mod.y, mod.w, mod.h);
        if (mod.type === 'storage') drawStorageUnit(mod.x, mod.y, mod.w, mod.h);
        if (mod.type === 'airlock') drawAirlock(mod.x, mod.y, mod.w, mod.h);
    });
    
    drawPlayer();

    // Курсор строительства
    if (isBuildMenuOpen && selectedBuildItem) {
        const { gx, gy } = getGridFromMouse();
        let valid = false, w=1, h=1;
        if (gx >= 0 && gx < TARGET_COLS && gy >= 0 && gy < TARGET_ROWS) {
            if (selectedBuildItem === 'basic') valid = canBuildFloor(gx, gy);
            else { valid = canBuildModule(gx, gy, selectedBuildItem); w = getModuleWidth(selectedBuildItem); h = getModuleHeight(selectedBuildItem); }
        }
        ctx.strokeStyle = valid ? '#29b6f6' : '#ef5350'; ctx.fillStyle = valid ? 'rgba(41, 182, 246, 0.3)' : 'rgba(239, 83, 80, 0.3)';
        ctx.lineWidth = 2; ctx.fillRect(gx*TILE_SIZE, gy*TILE_SIZE, w*TILE_SIZE, h*TILE_SIZE); ctx.strokeRect(gx*TILE_SIZE, gy*TILE_SIZE, w*TILE_SIZE, h*TILE_SIZE);
    }
}

function drawHangar() {
    ctx.fillStyle = '#050505'; ctx.fillRect(player.x - canvas.width, player.y - canvas.height, canvas.width*2, canvas.height*2);
    
    // Пол станции
    ctx.fillStyle = '#18181a'; stationTiles.forEach(t => { ctx.fillRect(t.x * TILE_SIZE, t.y * TILE_SIZE, TILE_SIZE, TILE_SIZE); });
    ctx.strokeStyle = '#25252a'; ctx.lineWidth = 1; ctx.beginPath(); stationTiles.forEach(t => { ctx.rect(t.x * TILE_SIZE, t.y * TILE_SIZE, TILE_SIZE, TILE_SIZE); }); ctx.stroke();
    
    // Неоновая обводка станции
    ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 4; ctx.shadowBlur = 10; ctx.shadowColor = '#00e5ff'; ctx.beginPath();
    const isStationFloor = (x, y) => stationTiles.some(t => t.x === x && t.y === y);
    stationTiles.forEach(t => {
        const x = t.x * TILE_SIZE; const y = t.y * TILE_SIZE;
        if (!isStationFloor(t.x, t.y - 1)) { ctx.moveTo(x, y); ctx.lineTo(x + TILE_SIZE, y); }
        if (!isStationFloor(t.x, t.y + 1)) { ctx.moveTo(x, y + TILE_SIZE); ctx.lineTo(x + TILE_SIZE, y + TILE_SIZE); }
        if (!isStationFloor(t.x - 1, t.y)) { ctx.moveTo(x, y); ctx.lineTo(x, y + TILE_SIZE); }
        if (!isStationFloor(t.x + 1, t.y)) { ctx.moveTo(x + TILE_SIZE, y); ctx.lineTo(x + TILE_SIZE, y + TILE_SIZE); }
    });
    ctx.stroke(); ctx.shadowBlur = 0;

    // ЗДЕСЬ УДАЛЕН КОД ОТРИСОВКИ ТЕКСТА НА ПОЛУ

    stationModules.forEach(mod => {
        if (mod.type === 'trade_post') {
            const x = mod.x * TILE_SIZE; const y = mod.y * TILE_SIZE; const w = mod.w * TILE_SIZE; const h = mod.h * TILE_SIZE;
            ctx.fillStyle = '#212121'; ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = interactables.tradePost.active ? '#00e5ff' : '#00bfa5'; ctx.lineWidth = 2; ctx.strokeRect(x,y,w,h);
            
            // Подпись терминала оставляем, это локальный объект
            ctx.font = "bold 12px Orbitron"; ctx.fillStyle = "#00bfa5"; ctx.textAlign = "center";
            ctx.fillText("FUEL", x + w/2, y + h/2 - 5); ctx.fillText("TERM", x + w/2, y + h/2 + 15);
        }
    });
    
    // Рисуем корабль внутри ангара
    ctx.fillStyle = '#455a64'; shipTiles.forEach(t => { ctx.fillRect(t.x * TILE_SIZE, t.y * TILE_SIZE, TILE_SIZE, TILE_SIZE); });
    ctx.strokeStyle = '#78909c'; ctx.lineWidth = 3; ctx.beginPath();
    shipTiles.forEach(t => {
        const x = t.x * TILE_SIZE; const y = t.y * TILE_SIZE;
        if (!getFloor(t.x, t.y - 1)) { ctx.moveTo(x, y); ctx.lineTo(x + TILE_SIZE, y); }
        if (!getFloor(t.x, t.y + 1)) { ctx.moveTo(x, y + TILE_SIZE); ctx.lineTo(x + TILE_SIZE, y + TILE_SIZE); }
        if (!getFloor(t.x - 1, t.y)) { ctx.moveTo(x, y); ctx.lineTo(x, y + TILE_SIZE); }
        if (!getFloor(t.x + 1, t.y)) { ctx.moveTo(x + TILE_SIZE, y); ctx.lineTo(x + TILE_SIZE, y + TILE_SIZE); }
    });
    ctx.stroke();

    installedModules.filter(m => m.type === 'engine').forEach(mod => {
        const x = mod.x * TILE_SIZE; const y = mod.y * TILE_SIZE; const w = mod.w * TILE_SIZE; const h = mod.h * TILE_SIZE;
        ctx.fillStyle = 'rgba(0, 229, 255, 0.8)'; ctx.shadowBlur = 15; ctx.shadowColor = '#00e5ff'; ctx.fillRect(x + 5, y + h - TILE_SIZE + 5, w - 10, TILE_SIZE - 10); ctx.shadowBlur = 0;
    });
    installedModules.filter(m => m.type === 'airlock').forEach(mod => {
        const x = mod.x * TILE_SIZE; const y = mod.y * TILE_SIZE; const w = mod.w * TILE_SIZE; const h = mod.h * TILE_SIZE;
        ctx.fillStyle = '#37474f'; ctx.fillRect(x + 5, y + 5, w - 10, h - 10); 
        ctx.fillStyle = isDocked ? '#00e676' : '#d32f2f'; ctx.beginPath(); ctx.arc(x + w/2, y + h/2, 4, 0, Math.PI*2); ctx.fill();
    });
    drawPlayer();
}

function drawPlayer() {
    const pRad = player.radius * TILE_SIZE;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(player.x, player.y + (pRad/2), pRad, pRad * 0.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = player.color; ctx.beginPath(); ctx.arc(player.x, player.y, pRad, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(player.x - pRad*0.3, player.y - pRad*0.3, pRad/3, 0, Math.PI*2); ctx.fill();
}
function drawStorageUnit(gx, gy, wTiles, hTiles) {
    const x = gx * TILE_SIZE; const y = gy * TILE_SIZE; const w = wTiles * TILE_SIZE; const h = hTiles * TILE_SIZE;
    ctx.fillStyle = '#1b1b1b'; ctx.fillRect(x, y, w, h);
    const boxW = (w - 12) / 2; const boxH = (h - 12) / 2;
    for (let i=0; i<2; i++) for (let j=0; j<2; j++) {
        const bx = x + 4 + i*(boxW+4); const by = y + 4 + j*(boxH+4);
        ctx.fillStyle = '#3e2723'; ctx.fillRect(bx, by, boxW, boxH);
        ctx.fillStyle = '#4e342e'; ctx.fillRect(bx+2, by+2, boxW-4, boxH-4);
        ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx+2, by+2); ctx.lineTo(bx+boxW-2, by+boxH-2); ctx.moveTo(bx+boxW-2, by+2); ctx.lineTo(bx+2, by+boxH-2); ctx.stroke();
    }
    ctx.strokeStyle = interactables.storage.active ? '#00e5ff' : '#333'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
}
function drawEngine(gx, gy, wTiles, hTiles) {
    const x = gx * TILE_SIZE; const y = gy * TILE_SIZE; const w = wTiles * TILE_SIZE; const h = hTiles * TILE_SIZE;
    ctx.fillStyle = '#121212'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#1c1c1c'; const ribW = w * 0.15; ctx.fillRect(x, y, ribW, h); ctx.fillRect(x + w - ribW, y, ribW, h);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1; for(let i = y; i < y+h; i+=10) { ctx.beginPath(); ctx.moveTo(x, i); ctx.lineTo(x+ribW, i); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x+w-ribW, i); ctx.lineTo(x+w, i); ctx.stroke(); }
    const coreX = x + ribW; const coreW = w - ribW*2; ctx.fillStyle = '#0d1117'; ctx.fillRect(coreX, y, coreW, h);
    const pulse = (Math.sin(time * 0.5) + 1) / 2;
    const grad = ctx.createLinearGradient(x, y, x, y+h); grad.addColorStop(0, `rgba(0, 100, 255, ${0.4 + pulse*0.2})`); grad.addColorStop(0.5, `rgba(0, 255, 255, ${0.8 + pulse*0.2})`); grad.addColorStop(1, '#fff');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(coreX + 5, y + 10); ctx.lineTo(x + w - ribW - 5, y + 10); ctx.lineTo(x + w - ribW - 10, y + h - 10); ctx.lineTo(coreX + 10, y + h - 10); ctx.fill();
    ctx.strokeStyle = '#546e7a'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
}
function drawCaptainBridge(gx, gy, wTiles, hTiles) {
    const x = gx * TILE_SIZE; 
    const y = gy * TILE_SIZE; 
    const w = wTiles * TILE_SIZE; 
    const h = hTiles * TILE_SIZE; 
    const cx = x + w / 2; 
    const cy = y + h / 2;

    // Фон и консоли
    ctx.fillStyle = '#1a2327'; ctx.fillRect(x, y, w, h); 
    ctx.fillStyle = '#263238'; const consoleThick = TILE_SIZE * 0.2;
    ctx.fillRect(x, y, w, consoleThick); ctx.fillRect(x, y + h - consoleThick, w, consoleThick); 
    ctx.fillRect(x, y, consoleThick, h); ctx.fillRect(x + w - consoleThick, y, consoleThick, h);

    // Декоративные "биты"
    ctx.fillStyle = interactables.bridge.active ? '#00e5ff' : '#00838f'; 
    const bit = TILE_SIZE * 0.24; 
    if (wTiles >= 2) { 
        for (let i = x + bit; i < x + w - bit; i += bit * 1.5) { 
            ctx.fillRect(i, y + TILE_SIZE * 0.04, bit * 0.5, bit * 0.25); 
            ctx.fillRect(i, y + h - TILE_SIZE * 0.16, bit * 0.5, bit * 0.25); 
        } 
    }

    ctx.save(); 
    ctx.translate(cx, cy);
    
    if (interactables.bridge.active) {
        ctx.shadowBlur = 20; ctx.shadowColor = '#00e5ff'; ctx.strokeStyle = '#00e5ff'; ctx.globalAlpha = 0.9;
        ctx.rotate(time * 0.2); 
        
        ctx.beginPath(); ctx.arc(0, 0, TILE_SIZE * 0.8, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, TILE_SIZE * 0.5, 0, Math.PI * 2); ctx.lineWidth = 1; ctx.stroke();
        
        ctx.fillStyle = '#00e5ff'; 
        ctx.beginPath(); 
        ctx.moveTo(0, -TILE_SIZE * 0.3); 
        ctx.lineTo(TILE_SIZE * 0.2, TILE_SIZE * 0.2); 
        ctx.lineTo(0, TILE_SIZE * 0.1); 
        ctx.lineTo(-TILE_SIZE * 0.2, TILE_SIZE * 0.2); 
        ctx.fill();
    } else { 
        ctx.fillStyle = '#37474f'; ctx.beginPath(); ctx.arc(0, 0, TILE_SIZE * 0.3, 0, Math.PI * 2); ctx.fill(); 
        ctx.strokeStyle = '#455a64'; ctx.lineWidth = 2; ctx.stroke(); 
    }
    ctx.restore();
}
function drawAirlock(gx, gy, wTiles, hTiles) {
    const x = gx * TILE_SIZE; const y = gy * TILE_SIZE; const w = wTiles * TILE_SIZE; const h = hTiles * TILE_SIZE;
    ctx.fillStyle = '#546e7a'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#263238'; ctx.fillRect(x+5, y+5, w-10, h-10);
    ctx.fillStyle = isDocked ? '#00e676' : '#d32f2f'; ctx.beginPath(); ctx.arc(x+w/2, y+h/2, 4, 0, Math.PI*2); ctx.fill();
    if (interactables.airlock.active) { ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 2; ctx.strokeRect(x,y,w,h); }
}