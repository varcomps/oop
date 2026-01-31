// Глобальный флаг правой кнопки (для перетаскивания удаления)
let isRightMouseDown = false;

function initGame() {
    resize();
    updateCurrencyUI();
    initShip();
    initSpace();
    if (window.initSpectrum) initSpectrum(); 
    const hud = document.getElementById('hud-top-left');
    if(hud) hud.style.display = 'none';
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const scaleX = canvas.width / TARGET_COLS;
    const scaleY = canvas.height / TARGET_ROWS;
    TILE_SIZE = Math.min(scaleX, scaleY);
    
    // ИСПРАВЛЕНИЕ: Проверяем новые слои фона вместо старого массива stars
    if (window.bgLayers && window.bgLayers.stars.length === 0) {
        if (window.generateDeepSpace) generateDeepSpace();
    }
}
window.addEventListener('resize', resize);

function startGame() {
    currentState = STATE_SHIP; resize();
    document.getElementById('mainMenu').classList.add('hidden');
    setTimeout(() => { document.getElementById('mainMenu').style.display = "none"; }, 800);
    const hud = document.getElementById('hud-top-left');
    if(hud) hud.style.display = 'flex';
}

function startTransition(toState) {
    if (transition.active) return;
    transition.active = true; transition.alpha = 0; transition.direction = 1; transition.targetState = toState;
    if (isBuildMenuOpen) tryToggleBuildMenu(); 
    if (isStorageOpen) toggleStorage(false);
    if (isSpectrumOpen && window.toggleSpectrum) toggleSpectrum(false);
    if (isMarketOpen && window.toggleMarket) toggleMarket(false);
    uiHint.style.display = 'none'; inputs.up = false; inputs.down = false; inputs.left = false; inputs.right = false;
}

function performStateSwitch() {
    const oldState = currentState;
    currentState = transition.targetState;
    
    if (currentState === STATE_MAP) mapUI.style.display = 'flex';
    else { 
        mapUI.style.display = 'none'; 
        if (isWarping && warpState.phase !== WARP_EXIT) { 
            isWarping = false; warpFactor = 0; warpState.phase = WARP_IDLE; chargeContainer.style.display = 'none'; 
        } 
    }

    // ЛОГИКА ТЕЛЕПОРТАЦИИ
    const airlock = installedModules.find(m => m.type === 'airlock');

    // --- 1. ВЫХОД ИЗ КОРАБЛЯ (На станцию/в космос) ---
    if (currentState === STATE_HANGAR) {
        if (airlock) { 
             const isVertical = (airlock.w === 1 && airlock.h === 2);
             let spawnX = 0;
             let spawnY = 0;

             if (isVertical) {
                 // Вертикальный шлюз (1x2):
                 const floorLeft = getFloor(airlock.x - 1, airlock.y) || getFloor(airlock.x - 1, airlock.y + 1);
                 
                 if (floorLeft) {
                     spawnX = airlock.x + 1; // Выход вправо
                 } else {
                     spawnX = airlock.x - 1; // Выход влево
                 }

                 player.x = (spawnX + 0.5) * TILE_SIZE;      
                 player.y = (airlock.y + 1.0) * TILE_SIZE;   
             } 
             else {
                 // Горизонтальный шлюз (2x1):
                 const floorTop = getFloor(airlock.x, airlock.y - 1) || getFloor(airlock.x + 1, airlock.y - 1);
                 
                 if (floorTop) {
                     spawnY = airlock.y + 1; // Выход вниз
                 } else {
                     spawnY = airlock.y - 1; // Выход вверх
                 }

                 player.x = (airlock.x + 1.0) * TILE_SIZE;   
                 player.y = (spawnY + 0.5) * TILE_SIZE;      
             }
        }
    } 
    // --- 2. ВХОД В КОРАБЛЬ ---
    else if (currentState === STATE_SHIP) {
        if (oldState === STATE_HANGAR) {
             if (window.teleportPlayerToInterior) window.teleportPlayerToInterior();
             else if (airlock) {
                 player.x = (airlock.x + 0.5) * TILE_SIZE; 
                 player.y = (airlock.y + 1.5) * TILE_SIZE; 
             }
        }
    }

    if (currentState === STATE_SHIP || currentState === STATE_HANGAR) {
        viewOffset.x = canvas.width / 2 - player.x;
        viewOffset.y = canvas.height / 2 - player.y;
    }
}

function isWalkable(px, py) {
    const gx = Math.floor(px / TILE_SIZE); const gy = Math.floor(py / TILE_SIZE);
    const mod = installedModules.find(m => gx >= m.x && gx < m.x + m.w && gy >= m.y && gy < m.y + m.h);
    if (mod && mod.type === 'airlock') return false; 
    
    if (currentState === STATE_HANGAR) {
        const stMod = stationModules.find(m => gx >= m.x && gx < m.x + m.w && gy >= m.y && gy < m.y + m.h);
        if (stMod) return false;
        const shipFloor = getFloor(gx, gy); if (shipFloor) return false; 
        const stationFloor = stationTiles.find(t => t.x === gx && t.y === gy); if (stationFloor) return true;
        return false;
    }
    if (currentState === STATE_SHIP) {
        if (!getFloor(gx, gy)) return false; if (mod) return false; return true;
    }
    return false;
}

function update() {
    time += 0.05;
    if (window.updateSpectrum) updateSpectrum(); 
    
    if (currentState === STATE_MENU) return;

    if (transition.active) {
        transition.alpha += 0.05 * transition.direction;
        if (transition.alpha >= 1 && transition.direction === 1) { transition.alpha = 1; performStateSwitch(); transition.direction = -1; }
        if (transition.alpha <= 0 && transition.direction === -1) { transition.alpha = 0; transition.active = false; uiHint.style.display = 'block'; }
        return;
    }

    if (currentState === STATE_SHIP || currentState === STATE_HANGAR) {
        if (!isBuildMenuOpen) { viewOffset.x = canvas.width / 2 - player.x; viewOffset.y = canvas.height / 2 - player.y; }
        
        let dx = 0, dy = 0; const moveSpeed = player.speed * TILE_SIZE;
        if (!isBuildMenuOpen && !isStorageOpen && !isSpectrumOpen && !isMarketOpen) {
            if (inputs.up) dy = -moveSpeed; if (inputs.down) dy = moveSpeed;
            if (inputs.left) dx = -moveSpeed; if (inputs.right) dx = moveSpeed;
        }
        if (isWalkable(player.x + dx, player.y)) player.x += dx;
        if (isWalkable(player.x, player.y + dy)) player.y += dy;

        if (currentState === STATE_SHIP) {
            const bridge = installedModules.find(m => m.type === 'bridge');
            interactables.bridge.active = bridge && Math.hypot(player.x - (bridge.x + bridge.w/2) * TILE_SIZE, player.y - (bridge.y + bridge.h/2) * TILE_SIZE) < TILE_SIZE * 1.5;
            
            const storage = installedModules.find(m => m.type === 'storage');
            interactables.storage.active = storage && Math.hypot(player.x - (storage.x + storage.w/2) * TILE_SIZE, player.y - (storage.y + storage.h/2) * TILE_SIZE) < TILE_SIZE * 1.5;
            
            const airlock = installedModules.find(m => m.type === 'airlock');
            interactables.airlock.active = airlock && Math.hypot(player.x - (airlock.x + airlock.w/2) * TILE_SIZE, player.y - (airlock.y + airlock.h/2) * TILE_SIZE) < TILE_SIZE * 1.5;

            let hintText = "";
            if (interactables.bridge.active) hintText = "<span class='hl'>[ E ]</span> МОСТИК <span class='hl'>[ M ]</span> СПЕКТР";
            else if (interactables.storage.active) hintText = "<span class='hl'>[ E ]</span> ГРУЗОВОЙ ОТСЕК";
            else if (interactables.airlock.active && isDocked) hintText = "<span class='hl'>[ E ]</span> ВЫХОД НА СТАНЦИЮ";
            else if (interactables.airlock.active && !isDocked) hintText = "<span style='color:red'>ШЛЮЗ ЗАБЛОКИРОВАН (НЕТ СТЫКОВКИ)</span>";
            if (!isBuildMenuOpen && !isStorageOpen && !isSpectrumOpen) uiHint.innerHTML = hintText; else uiHint.innerHTML = "";
        } else {
             const airlock = installedModules.find(m => m.type === 'airlock');
             let nearShip = airlock && Math.hypot(player.x - (airlock.x + airlock.w/2) * TILE_SIZE, player.y - (airlock.y + airlock.h/2) * TILE_SIZE) < TILE_SIZE * 2.5;
             const trade = stationModules.find(m => m.type === 'trade_post');
             interactables.tradePost.active = trade && Math.hypot(player.x - (trade.x + trade.w/2) * TILE_SIZE, player.y - (trade.y + trade.h/2) * TILE_SIZE) < TILE_SIZE * 2;
             
             const eng = stationModules.find(m => m.type === 'engineering_terminal');
             interactables.engineering.active = eng && Math.hypot(player.x - (eng.x + eng.w/2) * TILE_SIZE, player.y - (eng.y + eng.h/2) * TILE_SIZE) < TILE_SIZE * 2;
             
             const comm = stationModules.find(m => m.type === 'commodities_terminal');
             interactables.commodities.active = comm && Math.hypot(player.x - (comm.x + comm.w/2) * TILE_SIZE, player.y - (comm.y + comm.h/2) * TILE_SIZE) < TILE_SIZE * 2;

             if (!isStorageOpen && !isMarketOpen) {
                 if (nearShip) uiHint.innerHTML = "<span class='hl'>[ E ]</span> ВЕРНУТЬСЯ НА КОРАБЛЬ";
                 else if (interactables.tradePost.active) uiHint.innerHTML = "<span class='hl'>[ E ]</span> ТОРГОВЛЯ";
                 else if (interactables.engineering.active) uiHint.innerHTML = "<span class='hl'>[ E ]</span> ИНЖЕНЕРНЫЙ ТЕРМИНАЛ";
                 else if (interactables.commodities.active) uiHint.innerHTML = "<span class='hl'>[ E ]</span> ТОВАРНЫЙ РЫНОК";
                 else {
                     let roomName = "СТАНЦИЯ";
                     const gx = Math.floor(player.x / TILE_SIZE);
                     const gy = Math.floor(player.y / TILE_SIZE);
                     if (window.stationZones) {
                         const zone = window.stationZones.find(z => gx >= z.x && gx < z.x + z.w && gy >= z.y && gy < z.y + z.h);
                         if (zone) roomName = zone.name;
                     }
                     uiHint.innerHTML = roomName;
                 }
             } else uiHint.innerHTML = "";
        }

    } else if (currentState === STATE_MAP) {
        updateWarpLogic();
        if (!isWarping && !isDocked) { 
            if (inputs.left) mapShip.angle -= mapShip.rotationSpeed;
            if (inputs.right) mapShip.angle += mapShip.rotationSpeed;
            if (inputs.up) { mapShip.vx += Math.cos(mapShip.angle) * mapShip.thrust; mapShip.vy += Math.sin(mapShip.angle) * mapShip.thrust; }
            if (inputs.down) { mapShip.vx *= 0.9; mapShip.vy *= 0.9; }
        }
        mapShip.vx *= mapShip.friction; mapShip.vy *= mapShip.friction;
        mapShip.x += mapShip.vx; mapShip.y += mapShip.vy;
        
        // --- ГРАНИЦЫ КАРТЫ (ВЫТАЛКИВАНИЕ) ---
        if (mapShip.x < 0) { mapShip.x = 0; mapShip.vx = -mapShip.vx * 0.5; }
        if (mapShip.x > canvas.width) { mapShip.x = canvas.width; mapShip.vx = -mapShip.vx * 0.5; }
        if (mapShip.y < 0) { mapShip.y = 0; mapShip.vy = -mapShip.vy * 0.5; }
        if (mapShip.y > canvas.height) { mapShip.y = canvas.height; mapShip.vy = -mapShip.vy * 0.5; }

        // --- ИСПРАВЛЕННАЯ ЛОГИКА СТЫКОВКИ ---
        const inZone = window.isShipInDockingZone ? window.isShipInDockingZone() : false;

        if (isDocked) {
            dockBtn.style.display = 'block'; dockBtn.innerText = "UNDOCK [F]"; dockBtn.style.color = "#ff5252"; dockBtn.style.borderColor = "#ff5252";
            uiHint.innerHTML = "в ангаре. <span class='hl'>[ F ]</span> чтобы вылететь";
        } else if (currentSystemType === 'station' && inZone && !isWarping) {
            dockBtn.style.display = 'block'; dockBtn.innerText = "DOCK [F]"; dockBtn.style.color = "#00e5ff"; dockBtn.style.borderColor = "#00e5ff";
            uiHint.innerHTML = "доступна стыковка. <span class='hl'>[ F ]</span> для стыковки";
        } else {
            dockBtn.style.display = 'none';
            if (currentSystemType === null) uiHint.innerHTML = "ПУСТОЙ СЕКТОР";
            else uiHint.innerHTML = "ПОЛЕТ: <span class='hl'>WASD</span> Двигатели, <span class='hl'>[ E ]</span> Встать с кресла <span class='hl'>[ M ]</span> Сканер";
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // ИСПРАВЛЕНИЕ: Вызываем новую функцию для фона меню
    if (currentState === STATE_MENU) {
         if (window.drawSpaceBackground) drawSpaceBackground(false);
         else {
             // Fallback если space.js еще не загрузился
             ctx.fillStyle = "#000"; ctx.fillRect(0,0,canvas.width, canvas.height);
         }
    }
    else if (currentState === STATE_SHIP) { ctx.save(); ctx.translate(viewOffset.x, viewOffset.y); drawInterior(); ctx.restore(); }
    else if (currentState === STATE_HANGAR) { ctx.save(); ctx.translate(viewOffset.x, viewOffset.y); drawHangar(); ctx.restore(); }
    else drawMap();
    if (transition.active) { ctx.fillStyle = `rgba(0, 0, 0, ${transition.alpha})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
}

// ОБРАБОТКА ВВОДА
canvas.addEventListener('mousemove', e => { 
    mouseX = e.clientX; mouseY = e.clientY; 
    
    if (currentState === STATE_SHIP && isBuildMenuOpen) {
        if (isMouseDown && selectedBuildItem === 'basic') attemptBuild();
        if (isRightMouseDown) attemptDelete();
    }
});

canvas.addEventListener('mouseup', () => { isMouseDown = false; isRightMouseDown = false; });
canvas.addEventListener('mouseleave', () => { isMouseDown = false; isRightMouseDown = false; });

window.addEventListener('keydown', (e) => {
    if (transition.active) return;
    if (currentState === STATE_MENU) return;
    
    if (isStorageOpen) {
        if (e.code === 'Escape') {
            if (holdingItemData) {
                if(holdingItemData.restore) placedStorageItems.push(holdingItemData.restore);
                holdingItemData = null; storageGhost.style.display = 'none';
            } else toggleStorage(false);
            return;
        }
        if (e.code === 'KeyE') { toggleStorage(false); return; }
        if (e.code === 'KeyR' && holdingItemData) {
            const temp = holdingItemData.w; holdingItemData.w = holdingItemData.h; holdingItemData.h = temp;
            handleStorageGridHover({ clientX: mouseX, clientY: mouseY }, -1);
        }
        return;
    }

    if (isSpectrumOpen) {
        if (e.code === 'Escape' || e.code === 'KeyM') { toggleSpectrum(false); return; }
        return; 
    }

    if (isMarketOpen) {
        if (e.code === 'Escape' || e.code === 'KeyE') { toggleMarket(false); return; }
        return; 
    }

    if (e.code === 'Escape') {
        if (selectedBuildItem) { if (movingOriginalState) { installedModules.push(movingOriginalState); movingOriginalState = null; } clearCursor(); return; }
        
        if (isBuildMenuOpen) { 
            if (tryToggleBuildMenu()) {
                currentState = STATE_HANGAR; 
                viewOffset.x = canvas.width / 2 - player.x;
                viewOffset.y = canvas.height / 2 - player.y;
            }
            return; 
        }
    }
    
    if (e.code === 'KeyF' && currentState === STATE_MAP && dockBtn.style.display === 'block') { handleDockingInteraction(); return; }
    if (isBuildMenuOpen) { 
        if (e.code === 'KeyR' && selectedBuildItem && selectedBuildItem !== 'basic') { if (selectedBuildItem === 'engine') return; buildRotation = buildRotation === 0 ? 1 : 0; }
        return; 
    }

    switch(e.code) {
        case 'KeyW': case 'ArrowUp': inputs.up = true; break;
        case 'KeyS': case 'ArrowDown': inputs.down = true; break;
        case 'KeyA': case 'ArrowLeft': inputs.left = true; break;
        case 'KeyD': case 'ArrowRight': inputs.right = true; break;
        case 'KeyM': 
            if ((currentState === STATE_SHIP && interactables.bridge.active) || currentState === STATE_MAP) {
                toggleSpectrum(true);
            }
            break;
        case 'KeyE':
            if (currentState === STATE_SHIP) {
                if (interactables.bridge.active) startTransition(STATE_MAP);
                else if (interactables.storage.active) toggleStorage(true, false);
                else if (interactables.airlock.active && isDocked) startTransition(STATE_HANGAR);
            } else if (currentState === STATE_MAP && !isWarping) { 
                startTransition(STATE_SHIP); 
            } else if (currentState === STATE_HANGAR) {
                 const airlock = installedModules.find(m => m.type === 'airlock');
                 if (airlock && Math.hypot(player.x - (airlock.x+airlock.w/2)*TILE_SIZE, player.y - (airlock.y+airlock.h/2)*TILE_SIZE) < TILE_SIZE*2.5) startTransition(STATE_SHIP);
                 if (interactables.tradePost.active) toggleStorage(true, true);
                 if (interactables.commodities.active) toggleMarket(true);
                 if (interactables.engineering.active) {
                     currentState = STATE_SHIP; 
                     tryToggleBuildMenu(); 
                 }
            }
            break;
    }
});

window.addEventListener('keyup', (e) => {
    switch(e.code) {
        case 'KeyW': inputs.up = false; break; case 'KeyS': inputs.down = false; break;
        case 'KeyA': inputs.left = false; break; case 'KeyD': inputs.right = false; break;
    }
});

initGame();
function loop() { update(); draw(); requestAnimationFrame(loop); }
loop();

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