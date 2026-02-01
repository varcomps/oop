const buildMenu = document.getElementById('buildMenu');
const hullCountDisplay = document.getElementById('hullCountDisplay');

let shipTiles = [];
let installedModules = [];
let detachedTiles = []; 

// Таймер для анимации ошибки (мигание)
let detachAnimTimer = 0; 

let startGX = 0, startGY = 0;
let isBuildMenuOpen = false;
let selectedBuildItem = null;
let movingOriginalState = null;
let buildRotation = 0;

// Направление взгляда (-1 влево, 1 вправо)
player.facing = 1;

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

function updateBuildUI() {
    if (hullCountDisplay) hullCountDisplay.innerText = `x${player.hullParts}`;
}

// АЛГОРИТМ ПОИСКА КЛАСТЕРОВ
function getShipClusters() {
    const clusters = [];
    const visited = new Set();
    const tiles = [...shipTiles]; 

    for (let i = 0; i < tiles.length; i++) {
        const startNode = tiles[i];
        const key = `${startNode.x},${startNode.y}`;
        
        if (visited.has(key)) continue;

        const currentCluster = [];
        const queue = [startNode];
        visited.add(key);
        currentCluster.push(startNode);

        while (queue.length > 0) {
            const current = queue.shift();
            const neighbors = [
                {x: current.x + 1, y: current.y},
                {x: current.x - 1, y: current.y},
                {x: current.x, y: current.y + 1},
                {x: current.x, y: current.y - 1}
            ];

            neighbors.forEach(n => {
                const nKey = `${n.x},${n.y}`;
                const exists = tiles.some(t => t.x === n.x && t.y === n.y);
                if (exists && !visited.has(nKey)) {
                    visited.add(nKey);
                    queue.push(n);
                    currentCluster.push(n);
                }
            });
        }
        clusters.push(currentCluster);
    }
    clusters.sort((a, b) => b.length - a.length);
    return clusters;
}

function tryToggleBuildMenu() {
    if (transition.active) return false;

    // Элементы UI для переключения
    const hud = document.getElementById('hud-top-left');
    const handle = document.querySelector('.build-handle-strip');

    if (isBuildMenuOpen) {
        const clusters = getShipClusters();
        
        if (clusters.length > 1) {
            detachedTiles = [];
            for (let i = 1; i < clusters.length; i++) {
                detachedTiles.push(...clusters[i]);
            }
            // ЗАПУСКАЕМ ТАЙМЕР ОШИБКИ
            detachAnimTimer = 100; // ~1.5 секунды анимации
            uiHint.innerHTML = "<span style='color:red'>ОШИБКА: РАЗРЫВ КОРПУСА!</span>";
            return false;
        } else {
            detachedTiles = [];
        }
    }

    isBuildMenuOpen = !isBuildMenuOpen;
    
    if (isBuildMenuOpen) { 
        buildMenu.classList.remove('slide-in');
        
        // Входим в режим строительства: СКРЫВАЕМ HUD, ПОКАЗЫВАЕМ РУЧКУ
        if(hud) hud.style.display = 'none';
        if(handle) handle.style.display = 'flex';

        const shipCenterX = (startGX + 2) * TILE_SIZE;
        const shipCenterY = (startGY + 4) * TILE_SIZE;
        viewOffset.x = canvas.width / 2 - shipCenterX; 
        viewOffset.y = canvas.height / 2 - shipCenterY;
        
        updateBuildUI();
        detachedTiles = []; 
        switchTab('structure');
        
        clearCursor(); 
    } else {
        // Выходим из режима строительства: ПОКАЗЫВАЕМ HUD, СКРЫВАЕМ РУЧКУ
        if(hud) hud.style.display = 'flex';
        if(handle) handle.style.display = 'none';

        if (movingOriginalState) { installedModules.push(movingOriginalState); movingOriginalState = null; }
        buildMenu.classList.remove('slide-in');
        clearCursor();
    }
    inputs.up = false; inputs.down = false; inputs.left = false; inputs.right = false;
    return true;
}

// ЛОГИКА АВТОСКРЫТИЯ МЕНЮ
window.addEventListener('mousemove', (e) => {
    if (!isBuildMenuOpen) return;

    // Увеличили зону, чтобы ловить ручку
    if (e.clientX < 45 || (e.clientX < 200 && buildMenu.classList.contains('slide-in'))) {
        buildMenu.classList.add('slide-in');
    } else {
        buildMenu.classList.remove('slide-in');
    }
});


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

function getGridFromMouse() { return { gx: Math.floor((mouseX - viewOffset.x) / TILE_SIZE), gy: Math.floor((mouseY - viewOffset.y) / TILE_SIZE) }; }
function getFloor(gx, gy) { return shipTiles.find(t => t.x === gx && t.y === gy); }
function isTileOccupiedByModule(gx, gy) { return installedModules.some(m => gx >= m.x && gx < m.x + m.w && gy >= m.y && gy < m.y + m.h); }

function getBaseWidth(type) { if(['engine','bridge','storage'].includes(type)) return 2; if(type==='airlock') return 1; return 1; }
function getBaseHeight(type) { if(['engine','bridge','storage'].includes(type)) return 2; if(type==='airlock') return 2; return 1; }

function getModuleWidth(type) { 
    const w = getBaseWidth(type); const h = getBaseHeight(type);
    return buildRotation === 1 ? h : w; 
}
function getModuleHeight(type) { 
    const w = getBaseWidth(type); const h = getBaseHeight(type);
    return buildRotation === 1 ? w : h; 
}

function canBuildFloor(gx, gy) {
    if (getFloor(gx, gy) || isTileOccupiedByModule(gx, gy)) return false;
    return getFloor(gx+1, gy) || getFloor(gx-1, gy) || getFloor(gx, gy+1) || getFloor(gx, gy-1);
}

function canBuildModule(gx, gy, type) {
    const w = getModuleWidth(type); const h = getModuleHeight(type);
    
    // Проверка на пересечение с другими модулями
    for (let i=0; i<w; i++) for (let j=0; j<h; j++) if (isTileOccupiedByModule(gx+i, gy+j)) return false;
    
    // Двигатель (сзади)
    if (type === 'engine') {
        if (buildRotation !== 0) return false;
        if (!getFloor(gx, gy) || !getFloor(gx+1, gy)) return false;
        if (getFloor(gx, gy+1) || getFloor(gx+1, gy+1)) return false;
        return true;
    }

    // Шлюз (Airlock) - ЖЕСТКАЯ ПРОВЕРКА СТЕН
    if (type === 'airlock') {
        // 1. Сам шлюз должен стоять ПОЛНОСТЬЮ НА ПОЛУ
        for (let i=0; i<w; i++) for (let j=0; j<h; j++) if (!getFloor(gx+i, gy+j)) return false;

        let leftSideVoid = true; 
        let rightSideVoid = true;
        let topSideVoid = true;
        let bottomSideVoid = true;

        if (buildRotation === 0) { // Вертикальный (1x2)
            // Проверяем Левую сторону (должны быть ОБЕ клетки пустые)
            if (getFloor(gx-1, gy) || getFloor(gx-1, gy+1)) leftSideVoid = false;
            // Проверяем Правую сторону
            if (getFloor(gx+1, gy) || getFloor(gx+1, gy+1)) rightSideVoid = false;
            
            // Валидно, если ХОТЯ БЫ ОДНА длинная сторона ПОЛНОСТЬЮ выходит в космос
            return leftSideVoid || rightSideVoid;
        } 
        else { // Горизонтальный (2x1)
            // Проверяем Верхнюю сторону
            if (getFloor(gx, gy-1) || getFloor(gx+1, gy-1)) topSideVoid = false;
            // Проверяем Нижнюю сторону
            if (getFloor(gx, gy+1) || getFloor(gx+1, gy+1)) bottomSideVoid = false;
            
            return topSideVoid || bottomSideVoid;
        }
    }

    // Остальные модули - просто на полу
    for (let i=0; i<w; i++) for (let j=0; j<h; j++) if (!getFloor(gx+i, gy+j)) return false;
    return true;
}

function attemptBuild() {
    if (currentState !== STATE_SHIP || !isBuildMenuOpen || transition.active) return;
    const { gx, gy } = getGridFromMouse();
    if (gx < 0 || gx >= TARGET_COLS || gy < 0 || gy >= TARGET_ROWS) return;

    if (selectedBuildItem) {
        if (selectedBuildItem === 'basic') { 
            if (canBuildFloor(gx, gy)) {
                if (player.hullParts > 0) {
                    shipTiles.push({x: gx, y: gy});
                    player.hullParts--;
                    updateBuildUI();
                    detachedTiles = []; 
                }
            } 
        } 
        else {
            if (canBuildModule(gx, gy, selectedBuildItem)) {
                installedModules.push({ type: selectedBuildItem, x: gx, y: gy, w: getModuleWidth(selectedBuildItem), h: getModuleHeight(selectedBuildItem) });
                movingOriginalState = null; clearCursor();
            }
        }
    }
}

function attemptDelete() {
    if (currentState !== STATE_SHIP || !isBuildMenuOpen || transition.active) return;
    const { gx, gy } = getGridFromMouse();
    
    if (selectedBuildItem === 'basic' || selectedBuildItem === null) {
        const floor = getFloor(gx, gy);
        if (floor && !isTileOccupiedByModule(gx, gy)) {
            const idx = shipTiles.findIndex(t => t.x === gx && t.y === gy);
            if (idx !== -1) {
                shipTiles.splice(idx, 1);
                player.hullParts++; 
                updateBuildUI();
                detachedTiles = []; 
            }
        }
    }
}

function drawDiagonalStripes(x, y, alpha) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, TILE_SIZE, TILE_SIZE);
    ctx.clip(); 

    ctx.strokeStyle = `rgba(255, 0, 0, ${alpha})`;
    ctx.lineWidth = 4;
    
    for (let i = -TILE_SIZE; i < TILE_SIZE * 2; i += 15) {
        ctx.beginPath();
        ctx.moveTo(x + i, y - 10);
        ctx.lineTo(x + i + TILE_SIZE, y + TILE_SIZE + 10);
        ctx.stroke();
    }
    ctx.restore();
}

// НОВАЯ ФУНКЦИЯ ДЛЯ ТЕЛЕПОРТАЦИИ К ШЛЮЗУ ИЗ АНГАРА
function teleportPlayerToInterior() {
    const airlock = installedModules.find(m => m.type === 'airlock');
    if (!airlock) return;

    const w = airlock.w;
    const h = airlock.h;
    let targetX = airlock.x;
    let targetY = airlock.y;

    // Определяем, с какой стороны пол (внутри корабля), а с какой - космос
    // Вертикальный шлюз (1x2)
    if (w === 1 && h === 2) {
        if (getFloor(airlock.x - 1, airlock.y)) {
            targetX = airlock.x - 1; // Пол слева
        } else {
            targetX = airlock.x + 1; // Пол справа
        }
    } 
    // Горизонтальный шлюз (2x1)
    else {
        if (getFloor(airlock.x, airlock.y - 1)) {
            targetY = airlock.y - 1; // Пол сверху
        } else {
            targetY = airlock.y + 1; // Пол снизу
        }
    }

    // Ставим игрока в центр найденной клетки пола
    player.x = (targetX + 0.5) * TILE_SIZE;
    player.y = (targetY + 0.5) * TILE_SIZE;
}

canvas.addEventListener('mousedown', (e) => {
    if (currentState === STATE_SHIP && isBuildMenuOpen) {
        if (e.button === 0) { 
            isMouseDown = true; 
            
            if (selectedBuildItem) {
                attemptBuild(); 
            } else {
                const { gx, gy } = getGridFromMouse();
                
                const modIndex = installedModules.findIndex(m => 
                    gx >= m.x && gx < m.x + m.w && 
                    gy >= m.y && gy < m.y + m.h
                );

                if (modIndex !== -1) {
                    const mod = installedModules[modIndex];
                    movingOriginalState = { ...mod }; 
                    installedModules.splice(modIndex, 1);
                    selectedBuildItem = mod.type;
                    
                    // СОХРАНЕНИЕ ПОВОРОТА:
                    // Если ширина модуля не совпадает с базовой, значит он был повернут
                    if (mod.w !== getBaseWidth(mod.type)) {
                        buildRotation = 1;
                    } else {
                        buildRotation = 0;
                    }
                }
            }
        }
        if (e.button === 2) { 
            if (typeof isRightMouseDown !== 'undefined') isRightMouseDown = true;
            attemptDelete(); 
        }
    }
});

canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault(); 
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

    // АНИМАЦИЯ ОШИБКИ
    if (detachAnimTimer > 0) {
        detachAnimTimer--;
        
        let intensity = (Math.sin(detachAnimTimer * 0.3) + 1) / 2; 
        let fade = detachAnimTimer / 100;
        let alpha = intensity * fade * 0.8 + 0.2; 

        if (detachedTiles.length > 0) {
            detachedTiles.forEach(t => {
                drawDiagonalStripes(t.x * TILE_SIZE, t.y * TILE_SIZE, alpha);
                ctx.strokeStyle = `rgba(255, 0, 0, ${fade})`;
                ctx.lineWidth = 2;
                ctx.strokeRect(t.x * TILE_SIZE, t.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            });
        }
        
        if (detachAnimTimer === 0) detachedTiles = []; 
    }

    // --- ФИКС БРОНИ ---
    ctx.fillStyle = '#37474f'; 
    const hullThick = TILE_SIZE * 0.35;
    
    shipTiles.forEach(t => {
        const x = t.x * TILE_SIZE, y = t.y * TILE_SIZE;
        const noTop = !getFloor(t.x, t.y - 1);
        const noBottom = !getFloor(t.x, t.y + 1);
        const noLeft = !getFloor(t.x - 1, t.y);
        const noRight = !getFloor(t.x + 1, t.y);

        if (noTop) ctx.fillRect(x - 0.5, y - hullThick, TILE_SIZE + 1, hullThick + 0.5);
        if (noBottom) ctx.fillRect(x - 0.5, y + TILE_SIZE - 0.5, TILE_SIZE + 1, hullThick + 0.5);
        if (noLeft) ctx.fillRect(x - hullThick, y - 0.5, hullThick + 0.5, TILE_SIZE + 1);
        if (noRight) ctx.fillRect(x + TILE_SIZE - 0.5, y - 0.5, hullThick + 0.5, TILE_SIZE + 1);

        if (noTop && noLeft) ctx.fillRect(x - hullThick, y - hullThick, hullThick + 1, hullThick + 1);
        if (noTop && noRight) ctx.fillRect(x + TILE_SIZE - 0.5, y - hullThick, hullThick + 0.5, hullThick + 1);
        if (noBottom && noLeft) ctx.fillRect(x - hullThick, y + TILE_SIZE - 0.5, hullThick + 1, hullThick + 0.5);
        if (noBottom && noRight) ctx.fillRect(x + TILE_SIZE - 0.5, y + TILE_SIZE - 0.5, hullThick + 0.5, hullThick + 0.5);
    });

    ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.beginPath(); shipTiles.forEach(t => ctx.strokeRect(t.x * TILE_SIZE, t.y * TILE_SIZE, TILE_SIZE, TILE_SIZE)); ctx.stroke();
    
    installedModules.forEach(mod => {
        if (mod.type === 'engine') drawEngine(mod.x, mod.y, mod.w, mod.h);
        if (mod.type === 'bridge') drawCaptainBridge(mod.x, mod.y, mod.w, mod.h);
        if (mod.type === 'storage') drawStorageUnit(mod.x, mod.y, mod.w, mod.h);
        if (mod.type === 'airlock') drawAirlock(mod.x, mod.y, mod.w, mod.h);
    });
    
    if (!isBuildMenuOpen) drawPlayer();

    if (isBuildMenuOpen) {
        const { gx, gy } = getGridFromMouse();
        
        if (selectedBuildItem) {
            let valid = false, w=1, h=1;
            if (gx >= 0 && gx < TARGET_COLS && gy >= 0 && gy < TARGET_ROWS) {
                if (selectedBuildItem === 'basic') valid = canBuildFloor(gx, gy) && player.hullParts > 0;
                else { valid = canBuildModule(gx, gy, selectedBuildItem); w = getModuleWidth(selectedBuildItem); h = getModuleHeight(selectedBuildItem); }
            }
            ctx.strokeStyle = valid ? '#29b6f6' : '#ef5350'; ctx.fillStyle = valid ? 'rgba(41, 182, 246, 0.3)' : 'rgba(239, 83, 80, 0.3)';
            ctx.lineWidth = 2; ctx.fillRect(gx*TILE_SIZE, gy*TILE_SIZE, w*TILE_SIZE, h*TILE_SIZE); ctx.strokeRect(gx*TILE_SIZE, gy*TILE_SIZE, w*TILE_SIZE, h*TILE_SIZE);
        }
    }
}

function drawHangar() {
    ctx.fillStyle = '#050505'; ctx.fillRect(player.x - canvas.width, player.y - canvas.height, canvas.width*2, canvas.height*2);
    
    ctx.fillStyle = '#18181a'; stationTiles.forEach(t => { ctx.fillRect(t.x * TILE_SIZE, t.y * TILE_SIZE, TILE_SIZE, TILE_SIZE); });
    ctx.strokeStyle = '#25252a'; ctx.lineWidth = 1; ctx.beginPath(); stationTiles.forEach(t => { ctx.rect(t.x * TILE_SIZE, t.y * TILE_SIZE, TILE_SIZE, TILE_SIZE); }); ctx.stroke();
    
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

    stationModules.forEach(mod => {
        if (mod.type === 'trade_post') {
            const x = mod.x * TILE_SIZE; const y = mod.y * TILE_SIZE; const w = mod.w * TILE_SIZE; const h = mod.h * TILE_SIZE;
            ctx.fillStyle = '#212121'; ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = interactables.tradePost.active ? '#00e5ff' : '#00bfa5'; ctx.lineWidth = 2; ctx.strokeRect(x,y,w,h);
            
            ctx.font = "bold 12px Orbitron"; ctx.fillStyle = "#00bfa5"; ctx.textAlign = "center";
            ctx.fillText("FUEL", x + w/2, y + h/2 - 5); ctx.fillText("TERM", x + w/2, y + h/2 + 15);
        }
        if (mod.type === 'engineering_terminal') {
            const x = mod.x * TILE_SIZE; const y = mod.y * TILE_SIZE; const w = mod.w * TILE_SIZE; const h = mod.h * TILE_SIZE;
            ctx.fillStyle = '#212121'; ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = interactables.engineering.active ? '#ffca28' : '#ffa000'; ctx.lineWidth = 2; ctx.strokeRect(x,y,w,h);
            
            ctx.font = "bold 12px Orbitron"; ctx.fillStyle = "#ffa000"; ctx.textAlign = "center";
            ctx.fillText("ENG", x + w/2, y + h/2 - 5); ctx.fillText("STATION", x + w/2, y + h/2 + 15);
        }
        if (mod.type === 'commodities_terminal') {
            const x = mod.x * TILE_SIZE; const y = mod.y * TILE_SIZE; const w = mod.w * TILE_SIZE; const h = mod.h * TILE_SIZE;
            ctx.fillStyle = '#212121'; ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = interactables.commodities.active ? '#d500f9' : '#aa00ff'; ctx.lineWidth = 2; ctx.strokeRect(x,y,w,h);
            
            ctx.font = "bold 12px Orbitron"; ctx.fillStyle = "#e040fb"; ctx.textAlign = "center";
            ctx.fillText("MARKET", x + w/2, y + h/2 - 5); ctx.fillText("ACCESS", x + w/2, y + h/2 + 15);
        }
    });
    
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
    const cx = player.x;
    const cy = player.y;
    const scale = TILE_SIZE / 50; 

    // Логика направления для псевдо-3D (отзеркаливание)
    if (inputs.left) player.facing = -1;
    if (inputs.right) player.facing = 1;

    // Анимация подпрыгивания (bobbing)
    const isMoving = (inputs.up || inputs.down || inputs.left || inputs.right);
    const bob = isMoving ? Math.sin(time * 15) * 2 * scale : 0;

    ctx.save();
    ctx.translate(cx, cy);

    // Тень (статичная, не прыгает)
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 15 * scale, 12 * scale, 6 * scale, 0, 0, Math.PI*2);
    ctx.fill();

    // Применяем отзеркаливание
    ctx.scale(player.facing, 1);
    ctx.translate(0, bob); // Подпрыгивание всего тела

    // --- ТЕЛО (Скафандр) ---
    // Ноги (просто овалы, имитирующие ботинки)
    ctx.fillStyle = '#263238'; // Темные ботинки
    ctx.beginPath();
    // Задняя нога (немного смещена при движении)
    const legOffset = isMoving ? Math.sin(time * 15) * 5 * scale : 0;
    ctx.ellipse(-6 * scale - legOffset, 12 * scale, 5 * scale, 4 * scale, 0, 0, Math.PI*2);
    ctx.fill();
    // Передняя нога
    ctx.beginPath();
    ctx.ellipse(6 * scale + legOffset, 12 * scale, 5 * scale, 4 * scale, 0, 0, Math.PI*2);
    ctx.fill();

    // Торс (квадратный бронежилет)
    ctx.fillStyle = '#37474f'; 
    ctx.fillRect(-9 * scale, -8 * scale, 18 * scale, 20 * scale);
    
    // Пояс / детали
    ctx.fillStyle = '#455a64';
    ctx.fillRect(-9 * scale, 8 * scale, 18 * scale, 4 * scale);
    
    // Нагрудник (цвет игрока)
    ctx.fillStyle = player.color; // Используем цвет игрока (зеленый по умолчанию)
    ctx.fillRect(-7 * scale, -6 * scale, 14 * scale, 10 * scale);

    // --- ГОЛОВА (Шлем) ---
    // Большой круглый шлем "Among Us" / "Astroneer" стиля
    ctx.fillStyle = '#eceff1'; // Белый шлем
    ctx.beginPath();
    ctx.arc(0, -12 * scale, 11 * scale, 0, Math.PI*2);
    ctx.fill();

    // Визор (Стекло)
    const visorColor = '#4fc3f7'; // Голубое стекло
    ctx.fillStyle = visorColor;
    ctx.beginPath();
    // Рисуем скругленный прямоугольник для визора
    ctx.roundRect(-8 * scale, -16 * scale, 18 * scale, 10 * scale, 4 * scale); 
    ctx.fill();

    // Блик на стекле
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(4 * scale, -14 * scale, 3 * scale, 1.5 * scale, -0.3, 0, Math.PI*2);
    ctx.fill();

    // --- РУКИ ---
    // Просто кружочки по бокам (Rayman style или просто руки в боки)
    ctx.fillStyle = '#37474f';
    ctx.beginPath();
    ctx.arc(-11 * scale, 0, 4 * scale, 0, Math.PI*2); // Задняя рука
    ctx.fill();
    ctx.beginPath();
    ctx.arc(10 * scale, 0, 4 * scale, 0, Math.PI*2); // Передняя рука
    ctx.fill();

    // --- РЮКЗАК (Джетпак) ---
    // Виден немного сзади
    ctx.fillStyle = '#546e7a';
    ctx.fillRect(-14 * scale, -8 * scale, 5 * scale, 16 * scale);

    ctx.restore();
}

function drawStorageUnit(gx, gy, wTiles, hTiles) {
    const x = gx * TILE_SIZE; 
    const y = gy * TILE_SIZE; 
    const w = wTiles * TILE_SIZE; 
    const h = hTiles * TILE_SIZE;
    
    // -- ОСНОВА (Сейф) --
    // Темный тяжелый металл
    ctx.fillStyle = '#101214'; 
    ctx.fillRect(x, y, w, h);
    
    // Бронированные пластины
    ctx.fillStyle = '#263238';
    const border = 4;
    ctx.fillRect(x, y, w, border); // Верх
    ctx.fillRect(x, y + h - border, w, border); // Низ
    ctx.fillRect(x, y, border, h); // Лево
    ctx.fillRect(x + w - border, y, border, h); // Право

    // Лицевая панель (рифленая)
    ctx.fillStyle = '#1c2126';
    const innerPad = 10;
    ctx.fillRect(x + innerPad, y + innerPad, w - innerPad*2, h - innerPad*2);
    
    // Замки/Ручки
    ctx.fillStyle = '#455a64';
    ctx.fillRect(x + w/2 - 2, y + innerPad + 5, 4, h - innerPad*2 - 10);
    
    // Индикатор (красный/зеленый)
    ctx.fillStyle = interactables.storage.active ? '#00e676' : '#ff1744';
    ctx.beginPath(); ctx.arc(x + w - 15, y + 15, 3, 0, Math.PI*2); ctx.fill();

    // -- ГОЛОГРАММА (появляется при активации) --
    if (interactables.storage.active) {
        // Базовый альфа-канал для пульсации
        const alpha = (Math.sin(time * 3) + 1) / 2 * 0.3 + 0.2;
        
        ctx.save();
        ctx.strokeStyle = `rgba(0, 229, 255, ${alpha + 0.2})`;
        ctx.fillStyle = `rgba(0, 229, 255, ${alpha * 0.3})`;
        ctx.lineWidth = 1.5;
        
        const cx = x + w/2;
        const cy = y + h/2;
        const lift = Math.sin(time * 1.5) * 4; // Плавное парение вверх-вниз

        // Квадрат 1: Самый большой, вращается медленно
        ctx.save();
        ctx.translate(cx, cy - 20 + lift);
        ctx.rotate(time * 0.5);
        const sz1 = TILE_SIZE * 0.7;
        ctx.beginPath(); ctx.rect(-sz1/2, -sz1/2, sz1, sz1); ctx.stroke();
        // Уголки
        ctx.fillStyle = '#00e5ff';
        ctx.fillRect(-sz1/2 - 2, -sz1/2 - 2, 4, 4);
        ctx.fillRect(sz1/2 - 2, sz1/2 - 2, 4, 4);
        ctx.fillRect(-sz1/2 - 2, sz1/2 - 2, 4, 4);
        ctx.fillRect(sz1/2 - 2, -sz1/2 - 2, 4, 4);
        ctx.restore();

        // Квадрат 2: Поменьше, вращается быстрее в другую сторону
        ctx.save();
        ctx.translate(cx, cy - 35 + lift);
        ctx.rotate(-time * 1.2);
        const sz2 = TILE_SIZE * 0.45;
        ctx.strokeStyle = `rgba(0, 229, 255, ${alpha + 0.4})`; // Ярче
        ctx.beginPath(); ctx.rect(-sz2/2, -sz2/2, sz2, sz2); ctx.stroke(); ctx.fill();
        ctx.restore();

        // Квадрат 3: Статичный, верхний "экран"
        ctx.save();
        ctx.translate(cx, cy - 50 + lift);
        const sz3 = TILE_SIZE * 0.2;
        ctx.fillStyle = '#00e5ff';
        ctx.beginPath(); ctx.rect(-sz3/2, -sz3/2, sz3, sz3); ctx.fill();
        ctx.restore();

        // Лучи проектора снизу
        ctx.beginPath();
        ctx.strokeStyle = `rgba(0, 229, 255, 0.1)`;
        ctx.moveTo(x + 20, y + 20); ctx.lineTo(cx, cy - 20 + lift);
        ctx.moveTo(x + w - 20, y + 20); ctx.lineTo(cx, cy - 20 + lift);
        ctx.stroke();

        ctx.restore();
    }
}

function drawEngine(gx, gy, wTiles, hTiles) {
    const x = gx * TILE_SIZE; 
    const y = gy * TILE_SIZE; 
    const w = wTiles * TILE_SIZE; 
    const h = hTiles * TILE_SIZE;

    // -- КОРПУС --
    // Массивный, тяжелый блок
    ctx.fillStyle = '#191919'; // Почти черный
    ctx.fillRect(x, y, w, h);
    
    // Боковые усилители (ребристые)
    ctx.fillStyle = '#2d2d2d';
    const sideW = w * 0.15;
    ctx.fillRect(x, y, sideW, h);
    ctx.fillRect(x + w - sideW, y, sideW, h);
    
    // Решетки охлаждения на боках
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    for(let i = y + 5; i < y + h; i += 6) {
        ctx.beginPath(); ctx.moveTo(x + 2, i); ctx.lineTo(x + sideW - 2, i); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + w - sideW + 2, i); ctx.lineTo(x + w - 2, i); ctx.stroke();
    }

    // Центральная часть (Механика)
    const cx = x + w / 2;
    // Трубки
    ctx.strokeStyle = '#546e7a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 10, y + 10); ctx.lineTo(cx - 10, y + h - 20);
    ctx.moveTo(cx + 10, y + 10); ctx.lineTo(cx + 10, y + h - 20);
    ctx.stroke();

    // -- СОПЛО --
    // Сложная форма (Кольца)
    const nozzleY = y + h - TILE_SIZE * 0.4;
    const nozzleMaxW = w * 0.6;
    
    // Внешнее кольцо
    ctx.fillStyle = '#263238';
    ctx.beginPath();
    ctx.ellipse(cx, nozzleY, nozzleMaxW/2, TILE_SIZE * 0.15, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();

    // Внутреннее кольцо (ближе к огню)
    ctx.fillStyle = '#10151a';
    ctx.beginPath();
    ctx.ellipse(cx, nozzleY + 5, nozzleMaxW/2.5, TILE_SIZE * 0.12, 0, 0, Math.PI*2);
    ctx.fill();

    // -- ЯДРО И ВЫХЛОП --
    const pulse = (Math.sin(time * 15) + 1) / 2; // Очень быстрое мерцание

    // Само ядро (внутри корпуса)
    const coreGrad = ctx.createRadialGradient(cx, y + h/2, 5, cx, y + h/2, 25);
    coreGrad.addColorStop(0, '#fff');
    coreGrad.addColorStop(0.4, 'rgba(0, 229, 255, 1)');
    coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = coreGrad;
    // Рисуем свечение через "щели" в центре
    ctx.fillRect(cx - 5, y + 20, 10, h - 50);

    // Плазменный хвост
    const tailW = nozzleMaxW * 0.4;
    const tailLen = TILE_SIZE * (0.8 + pulse * 0.2);
    
    const flameGrad = ctx.createLinearGradient(cx, nozzleY, cx, nozzleY + tailLen);
    flameGrad.addColorStop(0, '#fff');
    flameGrad.addColorStop(0.3, '#00e5ff');
    flameGrad.addColorStop(1, 'rgba(0, 229, 255, 0)');

    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.moveTo(cx - tailW/2, nozzleY + 5);
    ctx.lineTo(cx + tailW/2, nozzleY + 5);
    ctx.lineTo(cx, nozzleY + 5 + tailLen);
    ctx.fill();

    // Искры / Частицы
    ctx.fillStyle = '#fff';
    if (Math.random() > 0.5) ctx.fillRect(cx - 5 + Math.random()*10, nozzleY + 10 + Math.random()*20, 2, 2);

    // Контур всего модуля
    ctx.strokeStyle = '#37474f';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
}

function drawCaptainBridge(gx, gy, wTiles, hTiles) {
    const x = gx * TILE_SIZE; 
    const y = gy * TILE_SIZE; 
    const w = wTiles * TILE_SIZE; 
    const h = hTiles * TILE_SIZE; 
    const cx = x + w / 2; 
    const cy = y + h / 2;
    ctx.fillStyle = '#1a2327'; ctx.fillRect(x, y, w, h); 
    ctx.fillStyle = '#263238'; const consoleThick = TILE_SIZE * 0.2;
    ctx.fillRect(x, y, w, consoleThick); ctx.fillRect(x, y + h - consoleThick, w, consoleThick); 
    ctx.fillRect(x, y, consoleThick, h); ctx.fillRect(x + w - consoleThick, y, consoleThick, h);
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