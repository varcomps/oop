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

function sendMyStatus() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    // СТРОГО: Если мы в варпе, мы ВООБЩЕ не отправляем данные в online_players
    // Это предотвращает появление игрока в списках во время полета
    if (typeof isWarping !== 'undefined' && isWarping) return;

    const nickElem = document.getElementById('nicknameDisplay');
    const myNick = nickElem ? nickElem.innerText : 'Unknown';

    const data = {
        nickname: myNick,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        currentSystemId: mpState.currentSystemId,
        locationMode: currentState,
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

    // 1. Копируем тип системы
    currentSystemType = wd.systemType || 'deep_space';
    
    // 2. Копируем цвета (Theme)
    if (wd.theme) {
        // Используем JSON.parse/stringify для глубокого копирования
        const syncedTheme = JSON.parse(JSON.stringify(wd.theme));
        bgState.currentTheme = syncedTheme;
        bgState.nextTheme = syncedTheme; // Приравниваем, чтобы не было перехода (lerp)
        bgState.progress = 0;
    }

    // 3. Копируем станцию
    if (currentSystemType === 'station' && wd.station) {
        station.x = wd.station.x;
        station.y = wd.station.y;
        station.visible = true;
        // Перегенерируем структуру станции локально (визуально будет похожа)
        if (typeof generateStation === 'function') generateStation();
    } else {
        station.visible = false;
    }

    // 4. Устанавливаем SystemID равным UID того игрока (мы теперь в его системе)
    mpState.currentSystemId = playerData.uid;
    mpState.isHost = false;
    
    // Обновляем подписку, чтобы видеть его и других гостей
    subscribeToCurrentSystem();
    
    console.log(`JUMPED TO PLAYER SYSTEM: ${playerData.nickname} (ID: ${mpState.currentSystemId})`);
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
window.drawRemotePlayers = function(ctx, currentMode, viewOffset, tileSize) {
    if (!mpState.remotePlayers) return;

    Object.values(mpState.remotePlayers).forEach(p => {
        // Рендер на КАРТЕ (STATE_MAP = 2)
        if (currentMode === 2 && p.locationMode === 2) { 
            const rx = p.mapPos.x;
            const ry = p.mapPos.y;
            
            ctx.save();
            ctx.translate(rx, ry);
            ctx.rotate(p.mapPos.angle);
            
            // Рисуем треугольник (корабль друга)
            ctx.fillStyle = '#ff1744'; // Красный корабль
            ctx.shadowBlur = 10; ctx.shadowColor = '#ff1744';
            ctx.beginPath(); 
            ctx.moveTo(10, 0); ctx.lineTo(-8, 6); ctx.lineTo(-4, 0); ctx.lineTo(-8, -6); 
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();

            // Никнейм
            ctx.fillStyle = '#ff1744';
            ctx.font = "10px Orbitron";
            ctx.textAlign = "center";
            ctx.fillText(p.nickname, rx, ry - 15);
        }
        
        // Рендер на СТАНЦИИ / В АНГАРЕ (STATE_HANGAR = 3)
        if (currentMode === 3 && p.locationMode === 3) {
            // viewOffset уже применен к контексту в main.js перед вызовом этой функции
            // поэтому рисуем просто по координатам мира
            
            const rx = p.stationPos.x;
            const ry = p.stationPos.y;
            const scale = tileSize / 50;

            // Простая отрисовка персонажа (красный силуэт)
            ctx.save();
            ctx.translate(rx, ry);
            ctx.scale(p.stationPos.facing, 1);
            
            ctx.fillStyle = 'rgba(255, 23, 68, 0.8)'; // Полупрозрачный красный
            
            // Тело
            ctx.fillRect(-6 * scale, -8 * scale, 12 * scale, 16 * scale);
            // Голова
            ctx.beginPath(); ctx.arc(0, -10 * scale, 5 * scale, 0, Math.PI*2); ctx.fill();
            
            ctx.restore();

            // Никнейм над головой
            ctx.fillStyle = '#ff1744';
            ctx.font = "bold 10px Arial";
            ctx.textAlign = "center";
            ctx.fillText(p.nickname, rx, ry - 25 * scale);
        }
    });
};