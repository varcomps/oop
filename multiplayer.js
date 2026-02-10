/* multiplayer.js - Полная логика сетевой игры */

const mpState = {
    currentSystemId: null, // ID системы (обычно UID хоста), где мы находимся
    remotePlayers: {},     // Данные других игроков в этой же системе
    isHost: true,          // Являюсь ли я хостом своей системы
    updateInterval: null
};

// Запуск сетевого такта
function initMultiplayer() {
    if (!firebase.auth().currentUser) return;
    
    // По умолчанию мы в своей системе
    mpState.currentSystemId = firebase.auth().currentUser.uid;
    
    // Запускаем отправку данных раз в 1 секунду
    if (mpState.updateInterval) clearInterval(mpState.updateInterval);
    mpState.updateInterval = setInterval(sendMyStatus, 1000); 
    
    // Слушаем игроков в ТОЙ ЖЕ системе, что и мы
    subscribeToCurrentSystem();
}

/* В multiplayer.js -> функция sendMyStatus */
function sendMyStatus() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    if (typeof isWarping !== 'undefined' && isWarping) return;

    const nickElem = document.getElementById('nicknameDisplay');
    const myNick = nickElem ? nickElem.innerText : 'Unknown';

    const data = {
        nickname: myNick,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        currentSystemId: mpState.currentSystemId,
        locationMode: currentState,
        isMoving: !!(inputs.up || inputs.down || inputs.left || inputs.right),
        // ПЕРЕДАЕМ РЕАЛЬНУЮ СТРУКТУРУ КОРАБЛЯ
        shipStructure: {
            tiles: window.shipTiles || [],
            modules: window.installedModules || []
        },
        mapPos: {
            x: typeof mapShip !== 'undefined' ? Math.round(mapShip.x) : 0,
            y: typeof mapShip !== 'undefined' ? Math.round(mapShip.y) : 0,
            angle: typeof mapShip !== 'undefined' ? mapShip.angle : 0
        },
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

    firebase.database().ref('online_players/' + user.uid).set(data);
}

// Подписка на игроков в той же "комнате" (SystemId)
let playersRef = null;
function subscribeToCurrentSystem() {
    if (playersRef) playersRef.off();

    playersRef = firebase.database().ref('online_players');
    playersRef.on('value', (snapshot) => {
        const all = snapshot.val();
        mpState.remotePlayers = {};

        if (!all) return;
        const myUid = firebase.auth().currentUser.uid;

        Object.keys(all).forEach(uid => {
            if (uid === myUid) return; // Себя не рендерим
            
            const p = all[uid];
            // Проверка на "онлайн" (если данные старше 15 секунд - игрок вышел)
            const now = Date.now();
            if (now - p.timestamp > 15000) return;

            // Самое главное: Игрок должен быть в ТОМ ЖЕ SystemId, что и мы
            if (p.currentSystemId === mpState.currentSystemId) {
                mpState.remotePlayers[uid] = p;
            }
        });
    });
}

// Получить список ВСЕХ игроков для сканера (независимо от системы)
window.scanForPlayers = async function() {
    console.log("Запуск сканирования игроков..."); // ЛОГ 1
    
    try {
        const snapshot = await firebase.database().ref('online_players').once('value');
        const all = snapshot.val();
        console.log("Данные из Firebase:", all); // ЛОГ 2
        
        const targets = [];
        if (!all) return [];
        
        const myUid = firebase.auth().currentUser.uid;
        const now = Date.now();

        Object.keys(all).forEach(uid => {
            if (uid === myUid) return; // Пропускаем себя
            
            const p = all[uid];
            const diff = now - p.timestamp;
            
            console.log(`Игрок ${p.nickname}: пинг ${diff}мс`); // ЛОГ 3
            
            // Если игрок был активен менее 30 секунд назад (увеличил тайминг для теста)
            if (diff < 30000) {
                targets.push({
                    uid: uid,
                    nickname: p.nickname,
                    worldData: p.worldSignature
                });
            }
        });
        
        console.log("Найденные цели:", targets); // ЛОГ 4
        return targets;
        
    } catch (e) {
        console.error("Ошибка сканирования:", e);
        return [];
    }
};
/* В multiplayer.js */

window.handleWarpLeave = function() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    console.log(">>> [MP] МГНОВЕННОЕ УДАЛЕНИЕ: Игрок уходит в гиперпрыжок.");
    
    // 1. Физически удаляем запись из таблицы онлайн-игроков
    firebase.database().ref('online_players/' + user.uid).remove();
    
    // 2. Сбрасываем локальное состояние
    mpState.currentSystemId = user.uid;
    mpState.isHost = true;
    mpState.remotePlayers = {};
    
    // 3. Переподписываемся на пустую систему
    subscribeToCurrentSystem();
};
// Функция синхронизации мира при прыжке к игроку
window.syncWorldWithPlayer = function(playerData) {
    if (!playerData || !playerData.worldData) return;
    
    const wd = playerData.worldData;
    currentSystemType = wd.systemType || 'deep_space';
    
    if (wd.theme) {
        const syncedTheme = JSON.parse(JSON.stringify(wd.theme));
        // ИСПРАВЛЕНИЕ: Не меняем currentTheme сразу, чтобы сработал плавный переход (lerp) в конце варпа
        bgState.nextTheme = syncedTheme; 
    }

    if (currentSystemType === 'station' && wd.station) {
        station.x = wd.station.x;
        station.y = wd.station.y;
        station.visible = true;
        if (typeof generateStation === 'function') generateStation();
    } else {
        station.visible = false;
    }

    mpState.currentSystemId = playerData.uid;
    mpState.isHost = false;
    subscribeToCurrentSystem();
};

// Сброс системы на свою (при обычном варпе в никуда)
window.resetToMySystem = function() {
    const user = firebase.auth().currentUser;
    if (user) {
        mpState.currentSystemId = user.uid;
        mpState.isHost = true;
        subscribeToCurrentSystem();
    }
};

// Отрисовка других игроков (вызывается в main.js)
/* multiplayer.js - Обновленная отрисовка для коопа */

/* В multiplayer.js -> функция drawRemotePlayers */
window.drawRemotePlayers = function(ctx, currentMode, viewOffset, tileSize) {
    if (!mpState.remotePlayers) return;

    Object.values(mpState.remotePlayers).forEach(p => {
        // --- 1. КАРТА (Показываем друга ВСЕГДА, если мы на карте) ---
        if (currentMode === 2 && p.mapPos) { 
            const rx = p.mapPos.x;
            const ry = p.mapPos.y;
            ctx.save();
            ctx.translate(rx, ry);
            ctx.rotate(p.mapPos.angle);
            ctx.shadowBlur = 10; ctx.shadowColor = '#ff1744';
            ctx.fillStyle = '#ff1744'; 
            ctx.beginPath(); 
            ctx.moveTo(10, 0); ctx.lineTo(-8, 6); ctx.lineTo(-4, 0); ctx.lineTo(-8, -6); 
            ctx.fill();
            ctx.restore();
            ctx.fillStyle = '#ff1744';
            ctx.font = "10px Orbitron"; ctx.textAlign = "center";
            ctx.fillText(p.nickname, rx, ry - 18);
        }
        
        // --- 2. АНГАР (Персонаж + МОНОЛИТНЫЙ КОРАБЛЬ) ---
        // Показываем, если мы в ангаре, а друг в ангаре ИЛИ внутри корабля
        if (currentMode === 3 && (p.locationMode === 3 || p.locationMode === 1)) {
            const rx = p.stationPos.x;
            const ry = p.stationPos.y;
            const scale = tileSize / 50;
            
            // РИСУЕМ КОРАБЛЬ ДРУГА (Твой скрипт из drawHangar)
            if (p.shipStructure) {
                ctx.save();
                // 1. ПОЛ
                ctx.fillStyle = '#455a64'; 
                p.shipStructure.tiles.forEach(t => {
                    ctx.fillRect(t.x * tileSize, t.y * tileSize, tileSize, tileSize);
                });

                // 2. ОБВОДКА (КРЫША / МОНОЛИТ)
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

                // 3. ТОЛЬКО ВНЕШНИЕ МОДУЛИ (Двигатель и Шлюз)
                p.shipStructure.modules.forEach(mod => {
                    const mx = mod.x * tileSize; const my = mod.y * tileSize;
                    const mw = mod.w * tileSize; const mh = mod.h * tileSize;
                    
                    if (mod.type === 'engine') {
                        ctx.fillStyle = 'rgba(0, 229, 255, 0.8)'; ctx.shadowBlur = 15; ctx.shadowColor = '#00e5ff'; 
                        ctx.fillRect(mx + 5, my + mh - tileSize + 5, mw - 10, tileSize - 10); ctx.shadowBlur = 0;
                    }
                    if (mod.type === 'airlock') {
                        ctx.fillStyle = '#37474f'; ctx.fillRect(mx + 5, my + 5, mw - 10, mh - 10); 
                        // Для чужого корабля рисуем просто индикатор
                        ctx.fillStyle = '#d32f2f'; ctx.beginPath(); ctx.arc(mx + mw/2, my + mh/2, 4, 0, Math.PI*2); ctx.fill();
                    }
                });
                ctx.restore();
            }

            // РИСУЕМ ПЕРСОНАЖА ПОВЕРХ
            const bob = (p.isMoving) ? Math.sin(Date.now() * 0.01) * 2 * scale : 0;
            ctx.save();
            ctx.translate(rx, ry);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath(); ctx.ellipse(0, 15 * scale, 12 * scale, 6 * scale, 0, 0, Math.PI*2); ctx.fill();
            ctx.scale(p.stationPos.facing || 1, 1);
            ctx.translate(0, bob);
            ctx.fillStyle = '#263238'; 
            ctx.beginPath(); ctx.ellipse(-6 * scale, 12 * scale, 5 * scale, 4 * scale, 0, 0, Math.PI*2); ctx.fill();
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