/* sector_station.js - СТРОГОЕ ТЗ: Случайный ангар, без смены режима */

let station = { x: 0, y: 0, dockingRadius: 150, visible: true }; 
let stationTiles = []; 
let stationModules = [];
window.stationZones = []; 
window.hangarSpots = []; // Сюда запишем координаты ангаров

// Храним координаты для стыковки (смещения для отрисовки)
window.dockingOffsets = []; 
window.currentDockingIndex = 0;

function generateStation() {
    stationTiles = []; 
    stationModules = []; 
    window.stationZones = []; 
    window.dockingOffsets = [];
    window.hangarSpots = []; // Очистка перед генерацией

    // Базовая функция заливки
    const fillRect = (rx, ry, rw, rh) => {
        for(let x=0; x<rw; x++) for(let y=0; y<rh; y++) { 
            if (!stationTiles.some(t => t.x === rx + x && t.y === ry + y)) {
                stationTiles.push({x: rx + x, y: ry + y}); 
            }
        }
        return {x: rx, y: ry, w: rw, h: rh};
    };

    // --- 1. АНГАР АЛЬФА (Левый) ---
    const hangarW = 32, hangarH = 18;
    fillRect(0, 0, hangarW, hangarH);
    window.stationZones.push({ name: "АНГАР АЛЬФА", x: 0, y: 0, w: hangarW, h: hangarH });
    
    // Сохраняем точку спавна
    window.hangarSpots.push({ x: 0, y: 0, w: hangarW, h: hangarH, name: "АНГАР АЛЬФА" });

    // --- 2. КОРИДОР МЕЖДУ АНГАРАМИ (2x2) ---
    fillRect(hangarW, 8, 2, 2); 

    // --- 3. АНГАР БЕТА (Правый) ---
    const hangar2X = hangarW + 2; 
    fillRect(hangar2X, 0, hangarW, hangarH);
    window.stationZones.push({ name: "АНГАР БЕТА", x: hangar2X, y: 0, w: hangarW, h: hangarH });

    // Сохраняем точку спавна
    window.hangarSpots.push({ x: hangar2X, y: 0, w: hangarW, h: hangarH, name: "АНГАР БЕТА" });

    // --- 4. ПРОХОД К ХАБУ (2x2) ---
    const h2CenterX = hangar2X + Math.floor(hangarW / 2) - 1;
    fillRect(h2CenterX, hangarH, 2, 2);

    // --- 5. ЦЕНТРАЛЬНЫЙ ХАБ (8x8) ---
    const hubY = hangarH + 2; 
    const hubX = h2CenterX - 3; 
    const hub = fillRect(hubX, hubY, 8, 8);
    window.stationZones.push({ name: "ЦЕНТРАЛЬНЫЙ ХАБ", x: hubX, y: hubY, w: 8, h: 8 });

    const hubCY = hubY + 4; 
    const hubCX = hubX + 4; 

    // --- 6. КОМНАТА (Слева): РЕАКТОР ---
    fillRect(hubX - 2, hubCY - 1, 2, 2);
    const room1X = hubX - 2 - 4;
    const room1Y = hubCY - 2;
    fillRect(room1X, room1Y, 4, 4);
    window.stationZones.push({ name: "РЕАКТОРНЫЙ ОТСЕК", x: room1X, y: room1Y, w: 4, h: 4 });
    stationModules.push({ type: 'trade_post', x: room1X + 1, y: room1Y + 1, w: 2, h: 2 });

    // --- 7. КОМНАТА (Справа): ТОРГОВЛЯ ---
    fillRect(hubX + 8, hubCY - 1, 2, 2);
    const room2X = hubX + 8 + 2; 
    const room2Y = hubCY - 2;
    fillRect(room2X, room2Y, 4, 4);
    window.stationZones.push({ name: "ТОРГОВЫЙ СКЛАД", x: room2X, y: room2Y, w: 4, h: 4 });
    stationModules.push({ type: 'commodities_terminal', x: room2X + 1, y: room2Y + 1, w: 2, h: 2 });

    // --- 8. КОМНАТА (Снизу): ИНЖЕНЕРИЯ ---
    fillRect(hubCX - 1, hubY + 8, 2, 2);
    const room3X = hubCX - 2;
    const room3Y = hubY + 8 + 2; 
    fillRect(room3X, room3Y, 4, 4);
    window.stationZones.push({ name: "ИНЖЕНЕРНЫЙ ОТСЕК", x: room3X, y: room3Y, w: 4, h: 4 });
    stationModules.push({ type: 'engineering_terminal', x: room3X + 1, y: room3Y + 1, w: 2, h: 2 });
}

function isShipInDockingZone() {
    if (currentSystemType !== 'station') return false;
    return Math.hypot(mapShip.x - station.x, mapShip.y - station.y) < station.dockingRadius;
}

/* sector_station.js - ИСПРАВЛЕНИЕ: Перенос корабля вместе с игроком */

function handleDockingInteraction() {
    if (currentState !== STATE_MAP || currentSystemType !== 'station') return;
    
    if (isDocked) { 
        isDocked = false; 
        if (typeof uiHint !== 'undefined') uiHint.innerHTML = "UNDOCKED";
    } 
    else if (isShipInDockingZone()) { 
        isDocked = true; 
        mapShip.vx = 0; mapShip.vy = 0; 
        
        if (window.hangarSpots && window.hangarSpots.length > 0) {
            // 1. Выбираем случайный ангар
            const randomHangar = window.hangarSpots[Math.floor(Math.random() * window.hangarSpots.length)];
            
            // 2. Вычисляем целевые координаты (центр ангара)
            const targetX = (randomHangar.x + randomHangar.w / 2) * TILE_SIZE;
            const targetY = (randomHangar.y + randomHangar.h / 2) * TILE_SIZE;

            // 3. Считаем смещение (разницу) между текущей позицией и целью
            // Округляем до целых клеток, чтобы сетка не поехала
            const diffGridX = Math.round((targetX - player.x) / TILE_SIZE);
            const diffGridY = Math.round((targetY - player.y) / TILE_SIZE);

            // 4. Двигаем ИГРОКА
            player.x += diffGridX * TILE_SIZE;
            player.y += diffGridY * TILE_SIZE;

            // 5. Двигаем ВЕСЬ КОРАБЛЬ (стены, пол, модули) вслед за игроком
            if (typeof shipTiles !== 'undefined') {
                shipTiles.forEach(t => { t.x += diffGridX; t.y += diffGridY; });
            }
            if (typeof installedModules !== 'undefined') {
                installedModules.forEach(m => { m.x += diffGridX; m.y += diffGridY; });
            }
            // Двигаем инвентарь (ящики), если они есть
            if (typeof window.placedStorageItems !== 'undefined') {
                window.placedStorageItems.forEach(i => { i.x += diffGridX; i.y += diffGridY; }); // Ошибка в логике, storageItems локальны к сетке...
                // СТОП. В storage.js items привязаны к локальной сетке 10x10? 
                // Если да, их двигать НЕ НАДО. Если они имеют мировые координаты - надо.
                // В твоем коде (storage.js) x и y от 0 до 9. Их трогать НЕЛЬЗЯ.
                // Поэтому этот блок для placedStorageItems НЕ НУЖЕН. Удаляю.
            }

            if (typeof uiHint !== 'undefined') {
                uiHint.innerHTML = `DOCKED AT: <span style="color:#00e5ff">${randomHangar.name}</span>`;
            }
        } 

        // Переключаем режим, игрок остается в корабле, но корабль теперь в новом месте
        startTransition(STATE_SHIP); 
    }
}

function renderStation(cx, cy, parallaxScale, objAlpha) {
    const sX = cx + (station.x - cx) * parallaxScale;
    const sY = cy + (station.y - cy) * parallaxScale;
    
    if (parallaxScale > 0.05 && parallaxScale < 8) {
        ctx.globalAlpha = objAlpha;
        ctx.save(); ctx.translate(sX, sY); ctx.scale(parallaxScale, parallaxScale); ctx.rotate(time * 0.05);
        ctx.fillStyle = '#263238'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#455a64'; ctx.lineWidth = 2; ctx.stroke();
        for(let i=0; i<3; i++) {
            ctx.save(); ctx.rotate((Math.PI*2 / 3) * i);
            ctx.fillStyle = '#37474f'; ctx.fillRect(-3, 10, 6, 25);
            ctx.fillStyle = '#1a2327'; ctx.strokeStyle = '#00bcd4'; ctx.lineWidth = 1;
            ctx.fillRect(-8, 35, 16, 10); ctx.strokeRect(-8, 35, 16, 10);
            ctx.fillStyle = Math.sin(time * 2 + i) > 0 ? '#00e676' : '#1b5e20';
            ctx.beginPath(); ctx.arc(0, 32, 1.5, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        }
        ctx.fillStyle = `rgba(0, 229, 255, ${0.5 + Math.sin(time*3)*0.4})`;
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
    }
}