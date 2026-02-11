
/* space_core.js - FIXED: Smooth Autopilot Color Transitions */

const mapUI = document.getElementById('mapUI');
const jumpBtn = document.getElementById('jumpBtn');
const jumpBtnPremium = document.getElementById('jumpBtnPremium'); 
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
let autoJumpState = { active: false, jumpsLeft: 0, finalTargetType: null, usePremium: false, targetPlayerData: null };

function startAutoJumpSequence(count, targetType, usePremium = false, targetPlayerData = null) {
    if (autoJumpState.active) return;
    
    if (isDocked) {
        jumpBtn.innerHTML = "ОТСТЫКУЙТЕСЬ [F]";
        jumpBtn.style.color = "#ff1744";
        btnErrorTimer = 60;
        return;
    }

    // ЛОГИКА ДЛЯ ПРЫЖКА К ИГРОКУ (ТРЕБУЕТСЯ ТОЛЬКО 1 SHIFT FUEL)
    if (targetType === 'player') {
        if (window.getShiftFuelCount() < 1) {
            const btn = jumpBtn;
            const oldText = btn.innerHTML;
            btn.innerHTML = "НУЖЕН SHIFT FUEL";
            btn.style.color = "#ff1744";
            setTimeout(() => { 
                btn.innerHTML = oldText; 
                btn.style.color = "#ff5252"; 
            }, 1500);
            return;
        }
        // Для прыжка к другу всегда фиксируем 1 списание
        count = 1;
    } else {
        const fuelAvailable = usePremium ? window.getPremiumFuelCount() : window.getFuelCount();

        if (fuelAvailable < count) {
            const btn = usePremium ? jumpBtnPremium : jumpBtn;
            if(btn) {
                const oldText = btn.innerHTML;
                btn.innerHTML = "НЕТ ТОПЛИВА";
                btn.style.color = "#ff1744";
                btn.style.borderColor = "#ff1744";
                setTimeout(() => { 
                    btn.innerHTML = oldText; 
                    btn.style.color = usePremium ? "#ffd700" : "#ff5252"; 
                    btn.style.borderColor = usePremium ? "#ffd700" : "#ff5252";
                }, 1500);
            }
            return;
        }
    }

    autoJumpState.active = true;
    autoJumpState.jumpsLeft = count;
    autoJumpState.finalTargetType = targetType;
    autoJumpState.usePremium = usePremium; 
    autoJumpState.targetPlayerData = targetPlayerData; 
    
    initiateHyperJump(true, autoJumpState.usePremium); 
}

function initiateHyperJump(isAuto = false, usePremium = false) {
    if (currentState !== STATE_MAP) {
        startTransition(STATE_MAP);
        setTimeout(() => initiateHyperJump(isAuto, usePremium), 1000);
        return;
    }
    if (isWarping) return;
    
    if (isDocked) { 
        jumpBtn.innerHTML = "ОТСТЫКУЙТЕСЬ"; 
        btnErrorTimer = 60; return; 
    }

    if (!isAuto && window.activeAutopilotRoute) {
        const route = window.activeAutopilotRoute;
        startAutoJumpSequence(route.jumpsRequired, route.targetType, usePremium, route.playerData);
        return;
    }
    
    // ОПРЕДЕЛЯЕМ ТИП ТОПЛИВА ДЛЯ СПИСАНИЯ
    let fuelTypeToConsume = usePremium ? 'premium' : 'normal';
    if (autoJumpState.active && autoJumpState.finalTargetType === 'player') {
        fuelTypeToConsume = 'shift';
    }

    if (!isAuto) {
        let hasFuel = false;
        if (usePremium) {
            if (window.getPremiumFuelCount() >= 1) hasFuel = true;
        } else {
            if (window.getFuelCount() >= 1) hasFuel = true;
        }

        if (!hasFuel) {
            jumpBtn.innerHTML = "НЕТ ТОПЛИВА";
            return;
        }
    }

    if (window.consumeSpecificFuel) {
        window.consumeSpecificFuel(fuelTypeToConsume);
    } else {
        consumeFuel(1);
    }
    
    if (isAuto && autoJumpState.active) {
        autoJumpState.jumpsLeft--;
    }
    
    if (window.handleWarpLeave) window.handleWarpLeave();
    isWarping = true; 
    
    if (window.clearRadioChoices) window.clearRadioChoices();

    warpState.phase = WARP_CHARGE; 
    warpState.timer = 0; 
    warpFactor = 0;
    
    chargeContainer.style.display = 'block';
    
    let barColor = '#00e5ff';
    if (fuelTypeToConsume === 'shift') barColor = '#ff1744';
    else if (usePremium) barColor = '#ffd700';
    else if (isAuto) barColor = '#d500f9';
    
    chargeBar.style.backgroundColor = barColor;
    chargeBar.style.boxShadow = `0 0 15px ${barColor}`;

    jumpBtn.disabled = true; 
    if(jumpBtnPremium) jumpBtnPremium.disabled = true;

    if (isAuto) {
        const btn = usePremium ? jumpBtnPremium : jumpBtn;
        if(btn) btn.innerHTML = `АВТОПИЛОТ: ${autoJumpState.jumpsLeft + 1} >>`; 
    } else {
        jumpBtn.innerHTML = "ЗАРЯДКА...";
    }
    
    warpState.isPremiumJump = usePremium; 
    isDocked = false; 
    dockBtn.style.display = 'none';
}

function updateWarpLogic() {
    if (btnErrorTimer > 0) { btnErrorTimer--; return; }

    if (!isWarping) {
        if (currentSystemType === 'system') updateSystemPhysics();
        else if (currentSystemType === 'black_hole') updateBlackHolePhysics();
    }

    if (!isWarping) {
        if (isDocked) {
             jumpBtn.innerHTML = "СИСТЕМА: СТЫКОВКА"; jumpBtn.disabled = true; 
             jumpBtn.style.borderColor = "#444"; jumpBtn.style.color = "#555";
             if(jumpBtnPremium) {
                 jumpBtnPremium.disabled = true;
                 jumpBtnPremium.style.borderColor = "#444";
                 jumpBtnPremium.style.color = "#555";
             }
        } else {
            const fuel = getFuelCount();
            const premFuel = window.getPremiumFuelCount ? window.getPremiumFuelCount() : 0;
            const shiftFuel = window.getShiftFuelCount ? window.getShiftFuelCount() : 0;
            
            if (fuel > 0) jumpBtn.disabled = false;
            else { jumpBtn.disabled = true; jumpBtn.style.removeProperty('border-color'); }
            
            if(jumpBtnPremium) {
                if (premFuel > 0) jumpBtnPremium.disabled = false;
                else jumpBtnPremium.disabled = true;
            }

            if (window.activeAutopilotRoute) {
                 const jumps = window.activeAutopilotRoute.jumpsRequired;
                 let target = window.activeAutopilotRoute.targetType;
                 
                 // ЛОГИКА ОТОБРАЖЕНИЯ ПРИ ПРЫЖКЕ К ИГРОКУ
                 if (target === 'player') {
                     if (shiftFuel >= 1) {
                         jumpBtn.innerHTML = `ПЕРЕХОД К ПИЛОТУ`;
                         jumpBtn.style.borderColor = "#ff1744"; jumpBtn.style.color = "#ff1744";
                         jumpBtn.disabled = false;
                     } else {
                         jumpBtn.innerHTML = `НУЖЕН SHIFT FUEL`;
                         jumpBtn.style.borderColor = "#444"; jumpBtn.style.color = "#555";
                         jumpBtn.disabled = true;
                     }
                 } else {
                     if (target === 'station') target = 'СТАНЦИЯ';
                     else if (target === 'system') target = 'СИСТЕМА';
                     else if (target === 'black_hole') target = 'ДЫРА';
                     else target = target.toUpperCase();
                     
                     if (fuel >= jumps) {
                         jumpBtn.innerHTML = `АВТОПИЛОТ: ${target} (${jumps})`;
                         jumpBtn.style.borderColor = "#d500f9"; jumpBtn.style.color = "#ea80fc";
                     } else {
                         jumpBtn.innerHTML = `НУЖНО ТОПЛИВО (${fuel}/${jumps})`;
                         jumpBtn.style.borderColor = "#ff1744"; jumpBtn.style.color = "#ff1744"; jumpBtn.disabled = true;
                     }
                 }

                 if(jumpBtnPremium) {
                     if (premFuel >= jumps) {
                         jumpBtnPremium.innerHTML = `С-ПИЛОТ: ${target}`;
                         jumpBtnPremium.style.borderColor = "#ffd700"; jumpBtnPremium.style.color = "#ffd700";
                     } else {
                         jumpBtnPremium.innerHTML = `НЕТ ТОПЛИВА`;
                         jumpBtnPremium.style.borderColor = "#444"; jumpBtnPremium.style.color = "#555"; jumpBtnPremium.disabled = true;
                     }
                 }
            } else {
                 if (fuel > 0) {
                    jumpBtn.innerHTML = "ГИПЕРПРЫЖОК";
                    jumpBtn.style.borderColor = "#ff5252"; jumpBtn.style.color = "#ff5252";
                 } else {
                    jumpBtn.innerHTML = "НЕТ ТОПЛИВА";
                 }
                 if(jumpBtnPremium) {
                     const sub = jumpBtnPremium.querySelector('.btn-sub');
                     if(sub) { sub.innerText = "СТАБ."; sub.style.color = "#eebb00"; }
                     
                     if(premFuel > 0) {
                         jumpBtnPremium.innerHTML = "SUPER JUMP"; 
                         jumpBtnPremium.style.borderColor = "#ffd700"; jumpBtnPremium.style.color = "#ffd700";
                         if(sub) jumpBtnPremium.appendChild(sub); 
                     } else {
                         jumpBtnPremium.innerHTML = "НЕТ ТОПЛИВА"; 
                         jumpBtnPremium.style.borderColor = "#444"; jumpBtnPremium.style.color = "#555";
                     }
                 }
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
            if (!autoJumpState.active) jumpBtn.innerHTML = "ПРЫЖОК!"; 
        }
    } 
    else if (warpState.phase === WARP_JUMP) {
        warpState.timer++; warpFactor += 2 + (warpFactor * 0.1); 
        bgState.progress = Math.min(0.5, bgState.progress + 0.01);
        if (warpFactor > 150) { 
            warpFactor = 150; 
            warpState.phase = WARP_COAST; 
            warpState.timer = 0; 
        }
    } 
    else if (warpState.phase === WARP_COAST) {
        // --- ИНТЕГРАЦИЯ СЮЖЕТА В ВАРП ---
        
        // 1. Если это начало фазы полета (timer === 1), пробуем запустить сцену
        if (warpState.timer === 1) {
            if (window.StoryManager) {
                // Передаем true, чтобы сказать менеджеру "мы в варпе"
                window.StoryManager.checkTrigger(true); 
            }
        }

        // 2. Если сцена активна, мы ЗАМОРАЖИВАЕМ таймер варпа.
        // Корабль летит бесконечно, пока сцена не закончится.
        if (window.StoryManager && window.StoryManager.isActive()) {
            warpFactor = 150; // Поддерживаем максимальную скорость визуально
            if (!autoJumpState.active) jumpBtn.innerHTML = "ВХОДЯЩИЙ СИГНАЛ...";
            
            // НЕ увеличиваем warpState.timer, чтобы не перейти в WARP_EXIT
            return; 
        }
        
        // ---------------------------------

        warpState.timer++; 
        
        if (warpState.timer === 20) { 
            if (!autoJumpState.active) jumpBtn.innerHTML = "В ПУТИ..."; 
        }
        
        if (warpState.timer > 80) { 
            warpState.phase = WARP_EXIT; 
            warpState.timer = 0; 
            
            // ... (остальной код выхода из варпа без изменений) ...
            if (autoJumpState.active && autoJumpState.jumpsLeft > 0) {
                currentSystemType = null; 
            } 
            else {
                const targetType = autoJumpState.active ? autoJumpState.finalTargetType : (window.nextJumpTarget || 'system');

                if (targetType === 'player' && autoJumpState.targetPlayerData) {
                    if (window.syncWorldWithPlayer) window.syncWorldWithPlayer(autoJumpState.targetPlayerData);
                } 
                else if (targetType === 'station') {
                    currentSystemType = 'station';
                    const padding = 100; 
                    station.x = padding + Math.random() * (canvas.width - padding * 2);
                    station.y = padding + Math.random() * (canvas.height - padding * 2);
                    station.visible = true;
                    if (typeof generateStation === 'function') generateStation();
                }
                else if (targetType === 'system') {
                    currentSystemType = 'system';
                    if (typeof generateRealRandomSystem === 'function') generateRealRandomSystem(); 
                } 
                else if (targetType === 'black_hole') {
                    currentSystemType = 'black_hole';
                    if (typeof generateBlackHole === 'function') generateBlackHole();
                } 
                else {
                    currentSystemType = null; 
                    if (typeof station !== 'undefined') station.visible = false;
                }
            }
            
            if (!autoJumpState.active) {
                bgState.nextTheme = generateRandomTheme();
            }
            
            if (!autoJumpState.active) jumpBtn.innerHTML = "ПРИБЫТИЕ..."; 
        }
    }
    else if (warpState.phase === WARP_EXIT) {
        warpFactor *= 0.90; 
        bgState.progress = Math.min(1.0, bgState.progress + 0.015);
        
        if (warpFactor < 0.1) {
            
            if (autoJumpState.active && autoJumpState.jumpsLeft > 0) {
                if (window.consumeSpecificFuel) {
                    window.consumeSpecificFuel(autoJumpState.usePremium ? 'premium' : 'normal');
                } else {
                    consumeFuel(1);
                }
                
                autoJumpState.jumpsLeft--;
                
                const btn = autoJumpState.usePremium ? jumpBtnPremium : jumpBtn;
                if(btn) btn.innerHTML = `АВТОПИЛОТ: ${autoJumpState.jumpsLeft} >>`;

                warpState.phase = WARP_CHARGE;
                warpState.timer = 0;
                warpFactor = 0;
                chargeBar.style.width = '0%';
                
                // --- ГЛАВНОЕ ИСПРАВЛЕНИЕ ПЛАВНОСТИ ---
                if (autoJumpState.finalTargetType !== 'player') {
                    // ВМЕСТО ЖЕСТКОГО ПРИСВОЕНИЯ nextTheme, МЫ БЕРЕМ ТЕКУЩУЮ ИНТЕРПОЛЯЦИЮ
                    // Это позволяет избежать скачка, если progress не успел дойти до 1.0
                    bgState.currentTheme = getInterpolatedPalette(bgState.progress);
                    
                    // Генерируем цель для СЛЕДУЮЩЕГО прыжка
                    bgState.nextTheme = generateRandomTheme(); 
                }
                // Если прыгаем к игроку - не меняем тему, так как синхронизация произойдет позже
                // -------------------------------------
                
                bgState.progress = 0;
                
                return; 
            }

            // Очистка при выходе
            if (currentSystemType !== 'system' && typeof resetStarSystem === 'function') {
                resetStarSystem();
            }
            if (currentSystemType !== 'black_hole') {
                if (typeof blackHole !== 'undefined') blackHole.radius = 0; 
            }
            if (currentSystemType !== 'station') {
                if (typeof station !== 'undefined') station.visible = false;
            }

            warpFactor = 0; 
            isWarping = false; 
            isDocked = false; 

            if (window.resetSpectrum) window.resetSpectrum();
            
            if (autoJumpState.active) {
                // Если прыжок был обычным (не к игроку), сбрасываем SystemID на свой
                if (autoJumpState.finalTargetType !== 'player' && window.resetToMySystem) {
                    console.log(">>> [DEBUG] Сброс системы на собственную.");
                    window.resetToMySystem();
                }
                autoJumpState.active = false;
                autoJumpState.targetPlayerData = null;
                window.activeAutopilotRoute = null; 
            }

            jumpBtn.disabled = false; jumpBtn.innerHTML = "ГИПЕРПРЫЖОК"; 
            if(jumpBtnPremium) jumpBtnPremium.disabled = false;

            warpState.phase = WARP_IDLE;
            chargeContainer.style.display = 'none'; chargeBar.style.width = '0%'; 
            
            // Завершаем переход цвета
            bgState.currentTheme = bgState.nextTheme; 
            bgState.progress = 0;

            if(window.updateGlobalPrices) {
                window.updateGlobalPrices(warpState.isPremiumJump);
            }
            
            if (warpState.isPremiumJump) {
                if(uiHint) {
                    const old = uiHint.innerHTML;
                    uiHint.innerHTML = "<span style='color:#ffd700'>РЫНОК СТАБИЛИЗИРОВАН (ЦЕНЫ ЗАМОРОЖЕНЫ)</span>";
                    setTimeout(() => uiHint.innerHTML = old, 3000);
                }
            }

            if (!warpState.isPremiumJump && window.checkIncomingTransmission) {
                window.checkIncomingTransmission();
            }

            if (currentSystemType === 'station' && window.generateStationInventory) {
                if (window.marketState && (!window.marketState.items || window.marketState.items.length === 0)) {
                    if(window.initMarket) initMarket();
                    generateStationInventory();
                }
                else {
                     generateStationInventory();
                }
            }
            
            if (mapShip.x < -1000 || mapShip.x > canvas.width + 1000 || mapShip.y < -1000 || mapShip.y > canvas.height + 1000) {
                 mapShip.x = canvas.width/2; mapShip.y = canvas.height/2; mapShip.vx = 0; mapShip.vy = 0;
            }
            
            if (window.saveGameData) window.saveGameData();
        }
    }
}

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function rgbToHex(r, g, b) { return "#" + ((1 << 24) + (r << 16) + (g << 8) + (b | 0)).toString(16).slice(1); }
function hexToRgb(hex) { const bigint = parseInt(hex.replace('#', ''), 16); return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255]; }
function lerpColor(c1, c2, t) {
    const rgb1 = hexToRgb(c1); const rgb2 = hexToRgb(c2);
    const r = Math.round(rgb1[0] + (rgb2[0] - rgb1[0]) * t);
    const g = Math.round(rgb1[1] + (rgb2[1] - rgb1[1]) * t);
    const b = Math.round(rgb1[2] + (rgb2[2] - rgb1[2]) * t);
    return rgbToHex(r, g, b);
}
function generateRandomTheme() {
    const rBg = randInt(0, 20); const gBg = randInt(0, 20); const bBg = randInt(0, 25); 
    const bg = rgbToHex(rBg, gBg, bBg);
    const colors = []; for(let i = 0; i < 3; i++) colors.push(rgbToHex(randInt(50, 255), randInt(50, 255), randInt(50, 255)));
    return { bg, colors };
}

let bgState = { currentTheme: generateRandomTheme(), nextTheme: generateRandomTheme(), progress: 0, stars: [], nebula: [] };

function getInterpolatedPalette(t) {
    const t1 = bgState.currentTheme; const t2 = bgState.nextTheme;
    const bg = lerpColor(t1.bg, t2.bg, t);
    const colors = []; const len = Math.max(t1.colors.length, t2.colors.length);
    for(let i = 0; i < len; i++) {
        const c1 = t1.colors[i % t1.colors.length]; const c2 = t2.colors[i % t2.colors.length];
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

    // Рассчитываем параметры эффекта выхода из варпа
    if (isWarping) {
        if (warpState.phase === WARP_JUMP || warpState.phase === WARP_COAST) {
             parallaxScale = 1 + (warpFactor / 20); 
             objAlpha = Math.max(0, 1 - (warpFactor / 60)); 
             if (objAlpha > 0.01) isActive = true;
        } else if (warpState.phase === WARP_EXIT) {
             // Плавное уменьшение масштаба при выходе
             parallaxScale = 1 - (warpFactor / 150); 
             if (parallaxScale < 0) parallaxScale = 0; 
             isActive = true; 
             // Альфа полная, так как мы "прилетели"
             objAlpha = 1; 
        } else isActive = true; 
    } else isActive = true;

    // Отрисовка статических объектов (Станция, Звезды)
    if (isActive && currentSystemType) {
        if (currentSystemType === 'station') renderStation(cx, cy, parallaxScale, objAlpha);
        else if (currentSystemType === 'system') renderSystem(cx, cy, parallaxScale, objAlpha);
        else if (currentSystemType === 'black_hole') renderBlackHole(cx, cy, parallaxScale, objAlpha);
    }

    // --- НОВОЕ: Отрисовка других игроков с учетом варп-эффектов ---
    // Мы передаем objAlpha (прозрачность) и parallaxScale (зум)
    if (window.drawRemotePlayers && isActive) {
        // Для карты offset не нужен, игроки имеют абсолютные координаты
        window.drawRemotePlayers(ctx, 2, {x:0, y:0}, 50, objAlpha, parallaxScale);
    }
    // -------------------------------------------------------------

    ctx.save(); ctx.translate(mapShip.x, mapShip.y); ctx.rotate(mapShip.angle);
    if (warpState.phase === WARP_CHARGE) { const shake = warpFactor * 2; ctx.translate(Math.random() * shake - shake / 2, Math.random() * shake - shake / 2); }
    if (isWarping && warpFactor > 1) ctx.scale(1, 1 + warpFactor / 50);
    ctx.shadowBlur = 10; ctx.shadowColor = '#00e676'; ctx.fillStyle = '#00e676'; 
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, 5); ctx.lineTo(-3, 0); ctx.lineTo(-6, -5); ctx.fill(); ctx.shadowBlur = 0;
    if (inputs.up && !isWarping && !isDocked) { ctx.fillStyle = '#ffb74d'; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-12, 4); ctx.lineTo(-12, -4); ctx.fill(); }
    ctx.restore();
}

// --- НОВЫЕ ФУНКЦИИ ДЛЯ ЭКСПОРТА/ИМПОРТА СОСТОЯНИЯ МИРА ---

window.getVisualState = function() {
    let state = {
        systemType: currentSystemType || 'deep_space',
        theme: bgState.currentTheme,
        stationData: {
            x: station.x,
            y: station.y,
            visible: station.visible
        }
    };

    // Если мы на станции, сохраняем рыночные данные
    if (currentSystemType === 'station' && window.getMarketSaveData) {
        state.marketData = window.getMarketSaveData();
    }
    
    // [НОВОЕ] Сохранение звездной системы
    if (currentSystemType === 'system' && window.getSystemSaveData) {
        state.systemData = window.getSystemSaveData();
    }

    // [НОВОЕ] Сохранение черной дыры
    if (currentSystemType === 'black_hole' && window.getAnomalySaveData) {
        state.anomalyData = window.getAnomalySaveData();
    }
    
    return state;
};

/* В файле space_core.js */

window.setVisualState = function(data) {
    if (!data) return;

    if (data.systemType) {
        currentSystemType = data.systemType;
    }

    if (data.theme) {
        bgState.currentTheme = data.theme;
        bgState.nextTheme = data.theme;
        bgState.progress = 0;
    }

    // ВОССТАНОВЛЕНИЕ СТАНЦИИ
    if (data.stationData) {
        station.x = data.stationData.x;
        station.y = data.stationData.y;
        station.visible = data.stationData.visible;
    }

    if (currentSystemType === 'station') {
        if (typeof generateStation === 'function') {
            generateStation(); 
        }
        if (data.marketData && window.restoreMarketSaveData) {
            window.restoreMarketSaveData(data.marketData);
        }
    }

    // [НОВОЕ] ВОССТАНОВЛЕНИЕ ЗВЕЗДНОЙ СИСТЕМЫ
    if (currentSystemType === 'system' && data.systemData && window.restoreSystemSaveData) {
        window.restoreSystemSaveData(data.systemData);
    }

    // [НОВОЕ] ВОССТАНОВЛЕНИЕ ЧЕРНОЙ ДЫРЫ
    if (currentSystemType === 'black_hole' && data.anomalyData && window.restoreAnomalySaveData) {
        window.restoreAnomalySaveData(data.anomalyData);
    }

    if (window.drawSpaceBackground) window.drawSpaceBackground(currentState === STATE_MAP);
};