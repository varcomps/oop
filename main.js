/* main.js - Полная версия с блокировкой ввода */

// Глобальный флаг правой кнопки (для перетаскивания удаления)
let isRightMouseDown = false;

function initGame() {
    resize();
    updateCurrencyUI();
    // УДАЛЕНО: initShip(); // Теперь вызывается только внутри loadGameData
    initSpace();
    if (window.initSpectrum) initSpectrum(); 
    if (window.renderStorageGrid) window.renderStorageGrid();
    
    if (window.initMultiplayer) initMultiplayer();
    
    const hud = document.getElementById('hud-top-left');
    if(hud) hud.style.display = 'none';
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const scaleX = canvas.width / TARGET_COLS;
    const scaleY = canvas.height / TARGET_ROWS;
    TILE_SIZE = Math.min(scaleX, scaleY);
    
    // Проверяем новые слои фона вместо старого массива stars
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
    
    uiHint.style.display = 'block';
    update(); 
}

function startTransition(toState) {
    if (transition.active) return;
    transition.active = true; transition.alpha = 0; transition.direction = 1; transition.targetState = toState;
    
    // Закрываем все окна при переходе
    if (isBuildMenuOpen) tryToggleBuildMenu(); 
    if (isStorageOpen) toggleStorage(false);
    if (isSpectrumOpen && window.toggleSpectrum) toggleSpectrum(false);
    if (isMarketOpen && window.toggleMarket) toggleMarket(false);
    
    // Закрываем радио при переходе
    if (typeof isRadioOpen !== 'undefined' && isRadioOpen) toggleRadio(false);

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

    const airlock = installedModules.find(m => m.type === 'airlock');

    // --- ЛОГИКА ВХОДА В АНГАР (СТЫКОВКА С КАРТЫ) ---
    if (currentState === STATE_HANGAR && oldState === STATE_MAP) {
        // Если выбран конкретный ангар при стыковке
        if (window.targetHangar) {
            const h = window.targetHangar;
            // Центрируем корабль в ангаре
            // x + половина ширины ангара - примерно половина ширины корабля (чтобы было красиво)
            const centerX = (h.x + h.w / 2) * TILE_SIZE;
            const centerY = (h.y + h.h / 2) * TILE_SIZE;
            
            player.x = centerX - (1 * TILE_SIZE); // Смещение, чтобы корабль был по центру визуально
            player.y = centerY - (1 * TILE_SIZE);
            
            // Сбрасываем инерцию
            if (typeof mapShip !== 'undefined') { mapShip.vx = 0; mapShip.vy = 0; }
        } 
        else {
            // Фолбек на 0,0 если ангар не выбран
            player.x = 10 * TILE_SIZE; 
            player.y = 8 * TILE_SIZE;
        }
    }

    // --- 1. ВЫХОД ИЗ КОРАБЛЯ ПЕШКОМ (На станцию) ---
    else if (currentState === STATE_HANGAR && oldState === STATE_SHIP) {
        if (airlock) { 
             const isVertical = (airlock.w === 1 && airlock.h === 2);
             let spawnX = 0;
             let spawnY = 0;

             if (isVertical) {
                 const floorLeft = getFloor(airlock.x - 1, airlock.y) || getFloor(airlock.x - 1, airlock.y + 1);
                 if (floorLeft) spawnX = airlock.x + 1; else spawnX = airlock.x - 1;
                 player.x = (spawnX + 0.5) * TILE_SIZE;      
                 player.y = (airlock.y + 1.0) * TILE_SIZE;   
             } else {
                 const floorTop = getFloor(airlock.x, airlock.y - 1) || getFloor(airlock.x + 1, airlock.y - 1);
                 if (floorTop) spawnY = airlock.y + 1; else spawnY = airlock.y - 1;
                 player.x = (airlock.x + 1.0) * TILE_SIZE;   
                 player.y = (spawnY + 0.5) * TILE_SIZE;      
             }
        }
    } 
    // --- 2. ВХОД В КОРАБЛЬ (С платформы станции) ---
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

/* В main.js - Обновление функции isWalkable */

function isWalkable(px, py) {
    const gx = Math.floor(px / TILE_SIZE); 
    const gy = Math.floor(py / TILE_SIZE);
    const mod = installedModules.find(m => gx >= m.x && gx < m.x + m.w && gy >= m.y && gy < m.y + m.h);
    
    if (mod && mod.type === 'airlock') return false; 
    
    if (typeof mpState !== 'undefined' && mpState.remotePlayers) {
        for (let uid in mpState.remotePlayers) {
            const p = mpState.remotePlayers[uid];
            if (currentState === STATE_HANGAR) {
                // --- ПРОВЕРКА: Хитбокс только если игрок пристыкован (режим 1 или 3) ---
                if (p.locationMode === 1 || p.locationMode === 3) {
                    // 1. Коллизия с корпусом чужого корабля
                    if (p.shipStructure && p.shipStructure.tiles) {
                        if (p.shipStructure.tiles.some(t => t.x === gx && t.y === gy)) return false;
                    }
                    // 2. Коллизия с самим персонажем друга
                    const distToPlayer = Math.hypot(px - p.stationPos.x, py - p.stationPos.y);
                    if (distToPlayer < TILE_SIZE * 0.4) return false;
                }
            }
        }
    }
    // ... остальная часть функции без изменений
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
        // Блокируем движение, если открыто любое UI
        const isAnyUIOpen = isBuildMenuOpen || isStorageOpen || isSpectrumOpen || isMarketOpen || 
                    (typeof isRadioOpen !== 'undefined' && isRadioOpen) || window.isCraftingOpen;
        
        // --- ВАЖНОЕ ИЗМЕНЕНИЕ: БЛОКИРОВКА ПРИ ВВОДЕ ТЕКСТА ---
        const isTyping = document.activeElement && document.activeElement.tagName === 'INPUT';
        
        if (!isAnyUIOpen && !isTyping) {
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
            if (interactables.bridge.active) hintText = "<span class='hl'>[ E ]</span> МОСТИК <span class='hl'>[ M ]</span> СПЕКТР <span class='hl'>[ R ]</span> СВЯЗЬ";
            else if (interactables.storage.active) hintText = "<span class='hl'>[ E ]</span> ГРУЗОВОЙ ОТСЕК";
            else if (interactables.airlock.active && isDocked) hintText = "<span class='hl'>[ E ]</span> ВЫХОД НА СТАНЦИЮ";
            else if (interactables.airlock.active && !isDocked) hintText = "<span style='color:red'>ШЛЮЗ ЗАБЛОКИРОВАН (НЕТ СТЫКОВКИ)</span>";
            
            if (!isAnyUIOpen) uiHint.innerHTML = hintText; else uiHint.innerHTML = "";
            } else {
            // --- РЕЖИМ АНГАРА / СТАНЦИИ ---
            const airlock = installedModules.find(m => m.type === 'airlock');
            let nearShip = airlock && Math.hypot(player.x - (airlock.x + airlock.w/2) * TILE_SIZE, player.y - (airlock.y + airlock.h/2) * TILE_SIZE) < TILE_SIZE * 2.5;
            
            const trade = stationModules.find(m => m.type === 'trade_post');
            interactables.tradePost.active = trade && Math.hypot(player.x - (trade.x + trade.w/2) * TILE_SIZE, player.y - (trade.y + trade.h/2) * TILE_SIZE) < TILE_SIZE * 2;
            
            const eng = stationModules.find(m => m.type === 'engineering_terminal');
            interactables.engineering.active = eng && Math.hypot(player.x - (eng.x + eng.w/2) * TILE_SIZE, player.y - (eng.y + eng.h/2) * TILE_SIZE) < TILE_SIZE * 2;
            
            const comm = stationModules.find(m => m.type === 'commodities_terminal');
            interactables.commodities.active = comm && Math.hypot(player.x - (comm.x + comm.w/2) * TILE_SIZE, player.y - (comm.y + comm.h/2) * TILE_SIZE) < TILE_SIZE * 2;

            // КРАФТ (Инициализация)
            const craft = stationModules.find(m => m.type === 'crafting_terminal');
            interactables.crafting = interactables.crafting || { active: false }; // Защита от undefined
            interactables.crafting.active = craft && Math.hypot(player.x - (craft.x + craft.w/2) * TILE_SIZE, player.y - (craft.y + craft.h/2) * TILE_SIZE) < TILE_SIZE * 2;

            // ОБМЕН (Инициализация) - ВАЖНО! Эту часть вы могли пропустить
            const exch = stationModules.find(m => m.type === 'exchange_post');
            interactables.exchange = interactables.exchange || { active: false }; // Создаем объект, если его нет
            interactables.exchange.active = exch && Math.hypot(player.x - (exch.x + exch.w/2) * TILE_SIZE, player.y - (exch.y + exch.h/2) * TILE_SIZE) < TILE_SIZE * 2;

            if (!isAnyUIOpen) {
                if (nearShip) uiHint.innerHTML = "<span class='hl'>[ E ]</span> ВЕРНУТЬСЯ НА КОРАБЛЬ";
                else if (interactables.tradePost.active) uiHint.innerHTML = "<span class='hl'>[ E ]</span> ТОРГОВЛЯ";
                else if (interactables.engineering.active) uiHint.innerHTML = "<span class='hl'>[ E ]</span> ИНЖЕНЕРНЫЙ ТЕРМИНАЛ";
                else if (interactables.commodities.active) uiHint.innerHTML = "<span class='hl'>[ E ]</span> ТОВАРНЫЙ РЫНОК";
                else if (interactables.crafting.active) uiHint.innerHTML = "<span class='hl'>[ E ]</span> ВЕРСТАК";
                else if (interactables.exchange.active) uiHint.innerHTML = "<span class='hl'>[ E ]</span> ОБМЕН ПРЕДМЕТАМИ";
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
        
        if (window.updateBlackHolePhysics) window.updateBlackHolePhysics(); 

        const isTyping = document.activeElement && document.activeElement.tagName === 'INPUT';
        
        // Блокируем управление кораблем на карте, если открыто радио ИЛИ идет ввод текста
        if (!isWarping && !isDocked && (!window.isRadioOpen) && !isTyping) { 
            if (inputs.left) mapShip.angle -= mapShip.rotationSpeed;
            if (inputs.right) mapShip.angle += mapShip.rotationSpeed;
            if (inputs.up) { mapShip.vx += Math.cos(mapShip.angle) * mapShip.thrust; mapShip.vy += Math.sin(mapShip.angle) * mapShip.thrust; }
            if (inputs.down) { mapShip.vx *= 0.9; mapShip.vy *= 0.9; }
        }
        mapShip.vx *= mapShip.friction; mapShip.vy *= mapShip.friction;
        mapShip.x += mapShip.vx; mapShip.y += mapShip.vy;
        
        if (mapShip.x < 0) { mapShip.x = 0; mapShip.vx = -mapShip.vx * 0.5; }
        if (mapShip.x > canvas.width) { mapShip.x = canvas.width; mapShip.vx = -mapShip.vx * 0.5; }
        if (mapShip.y < 0) { mapShip.y = 0; mapShip.vy = -mapShip.vy * 0.5; }
        if (mapShip.y > canvas.height) { mapShip.y = canvas.height; mapShip.vy = -mapShip.vy * 0.5; }

        const inZone = window.isShipInDockingZone ? window.isShipInDockingZone() : false;

        let infoText = "";
        let infoClass = "sector-normal";

        if (isWarping) {
            infoText = "HYPERSPACE TRAVERSAL...";
        } else {
            if (currentSystemType === 'station') {
                infoText = "TRADE OUTPOST SECTOR";
            } else if (currentSystemType === 'system') {
                infoText = "UNCHARTED STAR SYSTEM";
            } else if (currentSystemType === 'black_hole') {
                infoText = "⚠ GRAVITATIONAL SINGULARITY DETECTED ⚠";
                infoClass = "sector-danger";
            } else {
                infoText = "DEEP SPACE";
            }
        }

        if (isDocked) {
            dockBtn.style.display = 'block'; dockBtn.innerText = "UNDOCK [F]"; dockBtn.style.color = "#ff5252"; dockBtn.style.borderColor = "#ff5252";
            uiHint.className = 'sector-normal';
            uiHint.innerHTML = "STATUS: DOCKED";
        } else if (currentSystemType === 'station' && inZone && !isWarping) {
            dockBtn.style.display = 'block'; dockBtn.innerText = "DOCK [F]"; dockBtn.style.color = "#00e5ff"; dockBtn.style.borderColor = "#00e5ff";
            uiHint.className = 'sector-normal';
            uiHint.innerHTML = "DOCKING AVAILABLE";
        } else {
            dockBtn.style.display = 'none';
            uiHint.className = infoClass;
            uiHint.innerHTML = infoText;
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (currentState === STATE_MENU) {
         if (window.drawSpaceBackground) drawSpaceBackground(false);
         else {
             ctx.fillStyle = "#000"; ctx.fillRect(0,0,canvas.width, canvas.height);
         }
    }
    else if (currentState === STATE_SHIP) { 
        ctx.save(); ctx.translate(viewOffset.x, viewOffset.y); drawInterior(); ctx.restore(); 
    }
    else if (currentState === STATE_HANGAR) { 
        ctx.save(); ctx.translate(viewOffset.x, viewOffset.y); drawHangar(); 
        
        // --- ОТРИСОВКА ИГРОКОВ В АНГАРЕ ---
        if (window.drawRemotePlayers) window.drawRemotePlayers(ctx, STATE_HANGAR, viewOffset, TILE_SIZE);
        // ----------------------------------
        
        ctx.restore(); 
    }
    else { 
        drawMap(); 
        
        // --- ОТРИСОВКА ИГРОКОВ НА КАРТЕ ---
        // Для карты offset не нужен (или уже учтен в drawRemotePlayers через translate)
        if (window.drawRemotePlayers && !isWarping) window.drawRemotePlayers(ctx, STATE_MAP, viewOffset, TILE_SIZE);
        // ----------------------------------
    }

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
    // ЕСЛИ ВВОДИМ ТЕКСТ В INPUT - ИГНОРИРУЕМ ИГРОВЫЕ КЛАВИШИ
    if (document.activeElement && document.activeElement.tagName === 'INPUT') {
        if (e.code === 'Escape') {
            document.activeElement.blur(); // Снимаем фокус по ESC
        }
        return; 
    }

    if (transition.active) return;
    if (currentState === STATE_MENU) return;
    
    // --- ОБРАБОТКА БЛОКИРУЮЩИХ ОКОН ---
    
    // 1. Радио
    if (typeof isRadioOpen !== 'undefined' && isRadioOpen) {
        if (e.code === 'Escape' || e.code === 'KeyR') toggleRadio(false);
        return; 
    }

    // 2. Склад
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

    // 3. Спектр
    if (isSpectrumOpen) {
        if (e.code === 'Escape' || e.code === 'KeyM') { toggleSpectrum(false); return; }
        return; 
    }

    // 4. Рынок
    if (isMarketOpen) {
        if (e.code === 'Escape' || e.code === 'KeyE') { toggleMarket(false); return; }
        return; 
    }

    // 5. Крафт (Верстак)
    if (typeof isCraftingOpen !== 'undefined' && isCraftingOpen) {
        if (e.code === 'Escape' || e.code === 'KeyE') { window.toggleCrafting(false); return; }
        return;
    }

    // 6. Обмен (Trade) - НОВОЕ
    if (typeof isTradeActive !== 'undefined' && isTradeActive) {
        if (e.code === 'Escape') { window.closeTradeSession(); return; }
        return;
    }

    // 7. Меню строительства (Escape закрывает его)
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
    
    // --- ГЛОБАЛЬНЫЕ КЛАВИШИ ---

    // Стыковка (только на карте)
    if (e.code === 'KeyF' && currentState === STATE_MAP && dockBtn.style.display === 'block') { handleDockingInteraction(); return; }

    // Клавиша R (Радио ИЛИ Поворот)
    if (e.code === 'KeyR') {
        // Приоритет 1: Вращение в режиме строительства
        if (isBuildMenuOpen) { 
            if (selectedBuildItem && selectedBuildItem !== 'basic' && selectedBuildItem !== 'engine') {
                buildRotation = buildRotation === 0 ? 1 : 0; 
            }
            return;
        }
        
        // Приоритет 2: Открытие Радио
        if (typeof toggleRadio === 'function') {
            // На карте - открываем всегда
            if (currentState === STATE_MAP) {
                toggleRadio(true);
                return;
            }
            // В корабле - только если активен мостик
            if (currentState === STATE_SHIP) {
                if (interactables.bridge.active) {
                    toggleRadio(true);
                } else {
                    // Подсказка об ошибке
                    uiHint.innerHTML = "<span style='color:red'>ОШИБКА: НЕТ СВЯЗИ. ИСПОЛЬЗУЙТЕ ТЕРМИНАЛ МОСТИКА.</span>";
                    setTimeout(() => { if(!isRadioOpen && !isBuildMenuOpen) uiHint.innerHTML = ""; }, 1500);
                }
                return;
            }
        }
    }

    // --- УПРАВЛЕНИЕ И ВЗАИМОДЕЙСТВИЕ ---

    switch(e.code) {
        case 'KeyW': inputs.up = true; break;
        case 'KeyS': inputs.down = true; break;
        case 'KeyA': inputs.left = true; break;
        case 'KeyD': inputs.right = true; break;
        
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
            } 
            else if (currentState === STATE_MAP && !isWarping) { 
                startTransition(STATE_SHIP); 
            } 
            else if (currentState === STATE_HANGAR) {
                 const airlock = installedModules.find(m => m.type === 'airlock');
                 if (airlock && Math.hypot(player.x - (airlock.x+airlock.w/2)*TILE_SIZE, player.y - (airlock.y+airlock.h/2)*TILE_SIZE) < TILE_SIZE*2.5) startTransition(STATE_SHIP);
                 
                 if (interactables.tradePost.active) toggleStorage(true, true);
                 if (interactables.commodities.active) toggleMarket(true);
                 if (interactables.engineering.active) {
                     currentState = STATE_SHIP; 
                     tryToggleBuildMenu(); 
                 }
                 if (interactables.crafting && interactables.crafting.active) {
                    if (window.toggleCrafting) window.toggleCrafting(true);
                 }
                 
                 // --- НОВОЕ: ОТКРЫТИЕ ОБМЕНА ---
                 if (interactables.exchange && interactables.exchange.active) {
                    if (window.tryOpenTrade) window.tryOpenTrade();
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

// --- ОТРИСОВКА ---

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
        if (mod.type === 'crafting_terminal') {
            const x = mod.x * TILE_SIZE; const y = mod.y * TILE_SIZE; const w = mod.w * TILE_SIZE; const h = mod.h * TILE_SIZE;
            ctx.fillStyle = '#212121'; ctx.fillRect(x, y, w, h);
            // Визуальный стиль: Оранжево-красный (ржавый/индустриальный)
            ctx.strokeStyle = (interactables.crafting && interactables.crafting.active) ? '#ff7043' : '#d84315'; 
            ctx.lineWidth = 2; 
            ctx.strokeRect(x,y,w,h);
            
            ctx.font = "bold 12px Orbitron"; ctx.fillStyle = "#ff5722"; ctx.textAlign = "center";
            ctx.fillText("CRAFT", x + w/2, y + h/2 - 5); 
            ctx.fillText("UNIT", x + w/2, y + h/2 + 15);
        }
        if (mod.type === 'exchange_post') {
            const x = mod.x * TILE_SIZE; const y = mod.y * TILE_SIZE; const w = mod.w * TILE_SIZE; const h = mod.h * TILE_SIZE;
            ctx.fillStyle = '#212121'; ctx.fillRect(x, y, w, h);
            // Визуальный стиль: Желто-пунктирный
            ctx.strokeStyle = (interactables.exchange && interactables.exchange.active) ? '#ffab00' : '#ff6f00'; 
            ctx.lineWidth = 2; 
            ctx.setLineDash([5, 5]); // Пунктирная обводка
            ctx.strokeRect(x,y,w,h);
            ctx.setLineDash([]); // Сброс
            
            ctx.font = "bold 10px Orbitron"; ctx.fillStyle = "#ffab00"; ctx.textAlign = "center";
            ctx.fillText("P2P", x + w/2, y + h/2 - 5); 
            ctx.fillText("TRADE", x + w/2, y + h/2 + 15);
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
