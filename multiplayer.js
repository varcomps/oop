/* multiplayer.js - FINAL VERSION: Fixed Warp-Out Animation */

const mpState = {
    currentSystemId: null, // ID системы, где мы находимся
    remotePlayers: {},     // Данные других игроков
    isHost: true,          // Являюсь ли я хостом
    updateInterval: null,
    firstLoad: true,       // Флаг первой загрузки
    myLastPos: null        // Для запоминания позиции перед прыжком
};

// --- ИНИЦИАЛИЗАЦИЯ ---
function initMultiplayer() {
    if (!firebase.auth().currentUser) return;
    
    mpState.currentSystemId = firebase.auth().currentUser.uid;
    mpState.firstLoad = true;
    
    if (mpState.updateInterval) clearInterval(mpState.updateInterval);
    mpState.updateInterval = setInterval(sendMyStatus, 1000); 
    
    subscribeToCurrentSystem();
}

// --- ОТПРАВКА ДАННЫХ ---
function sendMyStatus() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    // Если мы в процессе варпа, обычные обновления не шлем, 
    // НО handleWarpLeave отправит специальный статус сам.
    if (typeof isWarping !== 'undefined' && isWarping) return;

    const nickElem = document.getElementById('nicknameDisplay');
    const myNick = nickElem ? nickElem.innerText : 'Unknown';

    // Сохраняем позицию локально
    const currentMapX = typeof mapShip !== 'undefined' ? Math.round(mapShip.x) : 0;
    const currentMapY = typeof mapShip !== 'undefined' ? Math.round(mapShip.y) : 0;
    const currentAngle = typeof mapShip !== 'undefined' ? mapShip.angle : 0;

    mpState.myLastPos = { x: currentMapX, y: currentMapY, angle: currentAngle };

    const data = {
        nickname: myNick,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        currentSystemId: mpState.currentSystemId,
        locationMode: currentState,
        isMoving: !!(inputs.up || inputs.down || inputs.left || inputs.right),
        isWarpingOut: false, // Мы в обычном состоянии
        
        shipStructure: {
            tiles: window.shipTiles || [],
            modules: window.installedModules || []
        },
        
        mapPos: mpState.myLastPos,
        
        stationPos: {
            x: Math.round(player.x),
            y: Math.round(player.y),
            facing: player.facing || 1
        },
        
        worldSignature: {
            systemType: currentSystemType,
            theme: bgState.currentTheme,
            station: { x: station.x, y: station.y }
        }
    };

    if (mpState.isHost && window.getMarketSaveData) {
        data.marketData = window.getMarketSaveData();
    }

    firebase.database().ref('online_players/' + user.uid).set(data);
}

// Обновление рынка
window.broadcastMarketUpdate = function() {
    const user = firebase.auth().currentUser;
    if (!user || !mpState.currentSystemId) return;
    firebase.database().ref('online_players/' + mpState.currentSystemId + '/marketData').update({
        stock: marketState.stationStock
    });
};

// --- ПОДПИСКА И ПОЛУЧЕНИЕ ДАННЫХ ---
let playersRef = null;

function subscribeToCurrentSystem() {
    if (playersRef) playersRef.off();

    playersRef = firebase.database().ref('online_players');
    playersRef.on('value', (snapshot) => {
        const all = snapshot.val();
        
        // Если все вышли
        if (!all) {
            Object.keys(mpState.remotePlayers).forEach(uid => {
                if (!mpState.remotePlayers[uid].isLeaving) {
                    mpState.remotePlayers[uid].isLeaving = true;
                    mpState.remotePlayers[uid].departureAnim = 0;
                }
            });
            mpState.firstLoad = false;
            return;
        }

        const myUid = firebase.auth().currentUser.uid;
        const now = Date.now();
        const activeUids = new Set();

        // 1. РЫНОК
        const hostData = all[mpState.currentSystemId];
        if (hostData && hostData.marketData) {
            if (hostData.marketData.stock) marketState.stationStock = hostData.marketData.stock;
            if (!mpState.isHost && hostData.marketData.items) marketState.items = hostData.marketData.items;

            if (typeof isMarketOpen !== 'undefined' && isMarketOpen) {
                if (typeof renderMarketList === 'function') renderMarketList();
                if (marketState.selectedId) {
                    const item = marketState.items.find(i => i.id === marketState.selectedId);
                    if (item && typeof updateTradePanel === 'function') updateTradePanel(item);
                }
            }
        }

        // 2. ИГРОКИ
        Object.keys(all).forEach(uid => {
            if (uid === myUid) return;
            
            const p = all[uid];
            if (now - p.timestamp > 15000) return; // Таймаут

            if (p.currentSystemId === mpState.currentSystemId) {
                activeUids.add(uid);
                
                // Проверяем статус "Улетает" из базы
                const isRemoteWarpingOut = p.isWarpingOut === true;

                if (!mpState.remotePlayers[uid]) {
                    // --- НОВЫЙ ИГРОК ---
                    mpState.remotePlayers[uid] = p;
                    mpState.remotePlayers[uid].arrivalAnim = mpState.firstLoad ? 1 : 0;
                    mpState.remotePlayers[uid].isLeaving = isRemoteWarpingOut;
                    if (isRemoteWarpingOut) mpState.remotePlayers[uid].departureAnim = 0;

                } else {
                    // --- ОБНОВЛЕНИЕ ---
                    const oldP = mpState.remotePlayers[uid];
                    
                    // Если вдруг сервер говорит "он улетает", а у нас еще нет -> запускаем анимацию
                    if (isRemoteWarpingOut && !oldP.isLeaving) {
                        oldP.isLeaving = true;
                        oldP.departureAnim = 0;
                    }

                    // Обновляем данные, сохраняя анимации
                    mpState.remotePlayers[uid] = {
                        ...p,
                        arrivalAnim: oldP.arrivalAnim !== undefined ? oldP.arrivalAnim : 1,
                        departureAnim: oldP.departureAnim !== undefined ? oldP.departureAnim : 0,
                        isLeaving: oldP.isLeaving || isRemoteWarpingOut // Если локально уже улетает или сервер сказал
                    };
                }
            }
        });

        // 3. УДАЛЕННЫЕ (Кого нет в базе, но были у нас)
        Object.keys(mpState.remotePlayers).forEach(uid => {
            if (!activeUids.has(uid)) {
                if (!mpState.remotePlayers[uid].isLeaving) {
                    mpState.remotePlayers[uid].isLeaving = true;
                    mpState.remotePlayers[uid].departureAnim = 0;
                }
            }
        });

        mpState.firstLoad = false;
    });
}

window.scanForPlayers = async function() {
    try {
        const snapshot = await firebase.database().ref('online_players').once('value');
        const all = snapshot.val();
        const targets = [];
        if (!all) return [];
        const myUid = firebase.auth().currentUser.uid;
        const now = Date.now();
        Object.keys(all).forEach(uid => {
            if (uid === myUid) return;
            const p = all[uid];
            if (now - p.timestamp < 30000) {
                targets.push({ uid: uid, nickname: p.nickname, worldData: p.worldSignature });
            }
        });
        return targets;
    } catch (e) {
        return [];
    }
};

// --- ВАЖНО: ПЕРЕОПРЕДЕЛЕНИЕ ЛОГИКИ УХОДА В ВАРП ---

window.handleWarpLeave = function() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    console.log(">>> [MP] Initiating Warp Sequence...");

    // 1. ВМЕСТО УДАЛЕНИЯ -> ОБНОВЛЯЕМ СТАТУС НА "WARPING OUT"
    // Это заставит другие клиенты проиграть анимацию улета
    const updates = {};
    // Используем последние координаты, чтобы прыжок был из правильной точки
    if (mpState.myLastPos) {
        updates['mapPos'] = mpState.myLastPos;
    }
    updates['isWarpingOut'] = true;
    updates['timestamp'] = firebase.database.ServerValue.TIMESTAMP;
    
    firebase.database().ref('online_players/' + user.uid).update(updates);

    // 2. ОТЛОЖЕННОЕ УДАЛЕНИЕ И СМЕНА ID
    // Мы даем 3 секунды другим клиентам, чтобы они увидели анимацию,
    // пока мы сами видим экран зарядки/прыжка.
    setTimeout(() => {
        console.log(">>> [MP] Warp Sequence Complete. Cleaning up...");
        
        // Теперь реально удаляем старую запись
        firebase.database().ref('online_players/' + user.uid).remove();
        
        // Меняем ID системы
        mpState.currentSystemId = user.uid + "_" + Date.now(); 
        mpState.isHost = true;
        mpState.remotePlayers = {}; 
        mpState.firstLoad = true;
        
        // Переподключаемся
        if (playersRef) { playersRef.off(); playersRef = null; }
        subscribeToCurrentSystem();
        
        if (window.initMarket) window.initMarket();
    }, 2500); // 2.5 секунды задержки перед реальным разрывом связи
};

window.syncWorldWithPlayer = function(playerData) {
    if (!playerData || !playerData.uid) return;
    firebase.database().ref('online_players/' + playerData.uid + '/currentSystemId').once('value').then(snap => {
        const targetId = snap.val() || playerData.uid;
        const wd = playerData.worldData;
        currentSystemType = wd.systemType || 'deep_space';
        if (wd && wd.theme) bgState.nextTheme = JSON.parse(JSON.stringify(wd.theme)); 
        if (currentSystemType === 'station' && wd.station) {
            station.x = wd.station.x; station.y = wd.station.y; station.visible = true;
            if (typeof generateStation === 'function') generateStation();
        } else {
            station.visible = false;
        }
        mpState.currentSystemId = targetId;
        mpState.isHost = false;
        mpState.remotePlayers = {}; 
        mpState.firstLoad = true;
        subscribeToCurrentSystem();
    });
};

// --- ОТРИСОВКА ---

window.drawRemotePlayers = function(ctx, currentMode, viewOffset, tileSize, globalAlpha = 1, parallaxScale = 1) {
    const uids = Object.keys(mpState.remotePlayers);
    if (uids.length === 0) return;

    uids.forEach(uid => {
        const p = mpState.remotePlayers[uid];

        // АНИМАЦИЯ ВЛЕТА (Если не улетает)
        let isArriving = false;
        if (!p.isLeaving && p.arrivalAnim < 1) {
            p.arrivalAnim += 0.04;
            if (p.arrivalAnim > 1) p.arrivalAnim = 1;
            isArriving = true;
        }

        // АНИМАЦИЯ УЛЕТА (Гиперпрыжок)
        let isDeparting = false;
        if (p.isLeaving) {
            isDeparting = true;
            p.departureAnim += 0.03; // Чуть медленнее, чтобы было видно ускорение
            
            // Удаляем объект после завершения анимации
            if (p.departureAnim >= 1) {
                delete mpState.remotePlayers[uid];
                return; 
            }
        }

        if (currentMode === 2 && p.mapPos) { 
            let renderX = p.mapPos.x;
            let renderY = p.mapPos.y;
            let stretchScale = 1;

            if (isArriving) {
                // ПРИЛЕТ: Торможение
                const t = 1 - Math.pow(1 - p.arrivalAnim, 3);
                const startX = p.mapPos.x - Math.cos(p.mapPos.angle) * 1200;
                const startY = p.mapPos.y - Math.sin(p.mapPos.angle) * 1200;
                renderX = startX + (p.mapPos.x - startX) * t;
                renderY = startY + (p.mapPos.y - startY) * t;
                stretchScale = 1 + (1 - t) * 15; 
            } 
            else if (isDeparting) {
                // УЛЕТ: Ускорение вперед
                const t = Math.pow(p.departureAnim, 3); // Экспоненциальный разгон
                
                // Летит ВПЕРЕД по своему курсу на 2000 пикселей
                const endX = p.mapPos.x + Math.cos(p.mapPos.angle) * 2000;
                const endY = p.mapPos.y + Math.sin(p.mapPos.angle) * 2000;
                
                renderX = p.mapPos.x + (endX - p.mapPos.x) * t;
                renderY = p.mapPos.y + (endY - p.mapPos.y) * t;
                
                // Растягивание
                stretchScale = 1 + t * 30; 
            }

            // ПРИМЕНЕНИЕ ПАРАЛЛАКСА
            // Это нужно, чтобы если МЫ (наблюдатель) варпаем, другие игроки тоже исчезали плавно
            const cx = ctx.canvas.width / 2;
            const cy = ctx.canvas.height / 2;
            const screenX = cx + (renderX - cx) * parallaxScale;
            const screenY = cy + (renderY - cy) * parallaxScale;

            ctx.save();
            ctx.globalAlpha = globalAlpha; 
            
            ctx.translate(screenX, screenY);
            ctx.rotate(p.mapPos.angle);
            ctx.scale(stretchScale * parallaxScale, parallaxScale); 

            // Корабль
            ctx.shadowBlur = 10; ctx.shadowColor = '#ff1744';
            ctx.fillStyle = '#ff1744'; 
            ctx.beginPath(); 
            ctx.moveTo(10, 0); ctx.lineTo(-8, 6); ctx.lineTo(-4, 0); ctx.lineTo(-8, -6); 
            ctx.fill();

            // Эффекты двигателя
            if (isArriving) {
                ctx.fillStyle = 'rgba(255, 23, 68, 0.4)';
                ctx.fillRect(-60, -2, 50, 4);
            }
            if (isDeparting) {
                ctx.fillStyle = 'rgba(255, 23, 68, 0.8)';
                // Шлейф растет при разгоне
                ctx.fillRect(-40 - (p.departureAnim * 50), -3, 30 + (p.departureAnim * 100), 6);
            }

            ctx.restore();
            
            if (globalAlpha > 0.5 && !isDeparting) {
                ctx.save();
                ctx.globalAlpha = globalAlpha;
                ctx.fillStyle = '#ff1744';
                ctx.font = "10px Orbitron"; ctx.textAlign = "center";
                ctx.fillText(p.nickname, screenX, screenY - 20 * parallaxScale);
                ctx.restore();
            }
        }
        
        if (currentMode === 3 && (p.locationMode === 3 || p.locationMode === 1) && !isDeparting) {
            const rx = p.stationPos.x;
            const ry = p.stationPos.y;
            const scale = tileSize / 50;
            
            if (p.shipStructure) {
                ctx.save();
                ctx.fillStyle = '#455a64'; 
                p.shipStructure.tiles.forEach(t => { ctx.fillRect(t.x * tileSize, t.y * tileSize, tileSize, tileSize); });
                ctx.strokeStyle = '#78909c'; ctx.lineWidth = 3; ctx.beginPath();
                const friendHasFloor = (gx, gy) => p.shipStructure.tiles.some(t => t.x === gx && t.y === gy);
                p.shipStructure.tiles.forEach(t => {
                    const x = t.x * tileSize; const y = t.y * tileSize;
                    if (!friendHasFloor(t.x, t.y - 1)) { ctx.moveTo(x, y); ctx.lineTo(x + tileSize, y); }
                    if (!friendHasFloor(t.x, t.y + 1)) { ctx.moveTo(x, y + tileSize); ctx.lineTo(x + tileSize, y + tileSize); }
                    if (!friendHasFloor(t.x - 1, t.y)) { ctx.moveTo(x, y); ctx.lineTo(x, y + tileSize); }
                    if (!friendHasFloor(t.x + 1, t.y)) { ctx.moveTo(x + tileSize, y); ctx.lineTo(x + tileSize, y + tileSize); }
                });
                ctx.stroke();
                p.shipStructure.modules.forEach(mod => {
                    const mx = mod.x * tileSize; const my = mod.y * tileSize;
                    const mw = mod.w * tileSize; const mh = mod.h * tileSize;
                    if (mod.type === 'engine') {
                        ctx.fillStyle = 'rgba(0, 229, 255, 0.8)'; ctx.shadowBlur = 15; ctx.shadowColor = '#00e5ff'; 
                        ctx.fillRect(mx + 5, my + mh - tileSize + 5, mw - 10, tileSize - 10); ctx.shadowBlur = 0;
                    }
                    if (mod.type === 'airlock') {
                        ctx.fillStyle = '#37474f'; ctx.fillRect(mx + 5, my + 5, mw - 10, mh - 10); 
                        ctx.fillStyle = '#d32f2f'; ctx.beginPath(); ctx.arc(mx + mw/2, my + mh/2, 4, 0, Math.PI*2); ctx.fill();
                    }
                });
                ctx.restore();
            }

            const bob = (p.isMoving) ? Math.sin(Date.now() * 0.01) * 2 * scale : 0;
            ctx.save();
            ctx.translate(rx, ry);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath(); ctx.ellipse(0, 15 * scale, 12 * scale, 6 * scale, 0, 0, Math.PI*2); ctx.fill();
            ctx.scale(p.stationPos.facing || 1, 1);
            ctx.translate(0, bob);
            ctx.fillStyle = '#263238'; ctx.beginPath(); ctx.ellipse(-6 * scale, 12 * scale, 5 * scale, 4 * scale, 0, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(6 * scale, 12 * scale, 5 * scale, 4 * scale, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#37474f'; ctx.fillRect(-9 * scale, -8 * scale, 18 * scale, 20 * scale);
            ctx.fillStyle = '#ff1744'; ctx.fillRect(-7 * scale, -6 * scale, 14 * scale, 10 * scale);
            ctx.fillStyle = '#eceff1'; ctx.beginPath(); ctx.arc(0, -12 * scale, 11 * scale, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#4fc3f7'; ctx.beginPath(); 
            if (ctx.roundRect) ctx.roundRect(-8 * scale, -16 * scale, 18 * scale, 10 * scale, 4 * scale); 
            else ctx.rect(-8 * scale, -16 * scale, 18 * scale, 10 * scale);
            ctx.fill();
            ctx.restore();
            ctx.fillStyle = '#fff'; ctx.font = "bold 12px Roboto"; ctx.textAlign = "center";
            ctx.shadowBlur = 4; ctx.shadowColor = "#000";
            ctx.fillText(p.nickname, rx, ry - 30 * scale);
            ctx.shadowBlur = 0;
        }
    });
};