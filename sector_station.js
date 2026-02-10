/* sector_station.js - UPDATED: Exchange Post Added */

let station = { x: 0, y: 0, dockingRadius: 150, visible: true }; 
let stationTiles = []; 
let stationModules = [];
window.stationZones = []; 
window.hangarSpots = []; 

// Храним координаты для стыковки
window.dockingOffsets = []; 
window.currentDockingIndex = 0;

function generateStation() {
    stationTiles = []; 
    stationModules = []; 
    window.stationZones = []; 
    window.dockingOffsets = [];
    window.hangarSpots = []; 

    const fillRect = (rx, ry, rw, rh) => {
        for(let x=0; x<rw; x++) for(let y=0; y<rh; y++) { 
            if (!stationTiles.some(t => t.x === rx + x && t.y === ry + y)) {
                stationTiles.push({x: rx + x, y: ry + y}); 
            }
        }
        return {x: rx, y: ry, w: rw, h: rh};
    };

    // --- 1. АНГАР АЛЬФА (Левый) 20x40 ---
    const hangarW = 20, hangarH = 40;
    fillRect(0, 0, hangarW, hangarH);
    window.stationZones.push({ name: "АНГАР АЛЬФА", x: 0, y: 0, w: hangarW, h: hangarH });
    window.hangarSpots.push({ x: 0, y: 0, w: hangarW, h: hangarH, name: "АНГАР АЛЬФА" });

    // --- 2. ЦЕНТРАЛЬНЫЙ КОРИДОР (Соединитель ангаров) ---
    // Делаем отступ между ангарами в 20 клеток, чтобы влезли комнаты хаба
    const gapSize = 20; 
    const hangar2X = hangarW + gapSize; 
    
    // Соединяем ангары широким проходом (на высоте y=20)
    fillRect(hangarW, 20, gapSize, 10); 

    // --- 3. АНГАР БЕТА (Правый) 20x40 ---
    fillRect(hangar2X, 0, hangarW, hangarH);
    window.stationZones.push({ name: "АНГАР БЕТА", x: hangar2X, y: 0, w: hangarW, h: hangarH });
    window.hangarSpots.push({ x: hangar2X, y: 0, w: hangarW, h: hangarH, name: "АНГАР БЕТА" });

    // --- 4. ПРОХОД ВВЕРХ К ХАБУ ---
    const centerX = hangarW + (gapSize / 2); // Центр конструкции (30)
    // Коридор вверх от основного прохода
    fillRect(centerX - 2, 8, 4, 12);

    // --- 5. ЦЕНТРАЛЬНЫЙ ХАБ (8x8) ---
    const hubW = 8;
    const hubX = centerX - (hubW / 2); // 30 - 4 = 26
    const hubY = 0; // На уровне верха ангаров
    fillRect(hubX, hubY, hubW, 8);
    window.stationZones.push({ name: "ЦЕНТРАЛЬНЫЙ ХАБ", x: hubX, y: hubY, w: hubW, h: 8 });

    // --- 6. КОМНАТКИ (4x4) В 3 СТОРОНЫ ---

    // А) Комната СЛЕВА (Торговля)
    const roomLeftX = hubX - 4; 
    const roomLeftY = hubY + 2;
    fillRect(roomLeftX, roomLeftY, 4, 4);
    window.stationZones.push({ name: "ТОРГОВЫЙ ПОСТ", x: roomLeftX, y: roomLeftY, w: 4, h: 4 });
    stationModules.push({ type: 'trade_post', x: roomLeftX + 1, y: roomLeftY + 1, w: 2, h: 2 });

    // Б) Комната СПРАВА (Склад)
    const roomRightX = hubX + 8;
    const roomRightY = hubY + 2;
    fillRect(roomRightX, roomRightY, 4, 4);
    window.stationZones.push({ name: "СКЛАД", x: roomRightX, y: roomRightY, w: 4, h: 4 });
    stationModules.push({ type: 'commodities_terminal', x: roomRightX + 1, y: roomRightY + 1, w: 2, h: 2 });

    // В) Комната СВЕРХУ (Инженерия)
    const roomUpX = hubX + 2;
    const roomUpY = hubY - 4;
    fillRect(roomUpX, roomUpY, 4, 4);
    window.stationZones.push({ name: "ИНЖЕНЕРНЫЙ ОТСЕК", x: roomUpX, y: roomUpY, w: 4, h: 4 });
    stationModules.push({ type: 'engineering_terminal', x: roomUpX + 1, y: roomUpY + 1, w: 2, h: 2 });

    // --- 7. КОМНАТА: МАСТЕРСКАЯ (Слева от коридора) ---
    // Коридор находится примерно на X=28..31. Делаем ответвление влево.
    const craftRoomX = centerX - 8; // Смещаем влево от центра
    const craftRoomY = 12; // По вертикали посередине коридора
    
    // Сама комната 4x4
    fillRect(craftRoomX, craftRoomY, 4, 4);
    // Проход к коридору (соединитель)
    fillRect(craftRoomX + 4, craftRoomY + 1, 2, 2);

    window.stationZones.push({ name: "МАСТЕРСКАЯ", x: craftRoomX, y: craftRoomY, w: 4, h: 4 });
    // Добавляем терминал крафта
    stationModules.push({ type: 'crafting_terminal', x: craftRoomX + 1, y: craftRoomY + 1, w: 2, h: 2 });

    // --- 8. НОВАЯ КОМНАТА: ЗОНА ОБМЕНА (Справа от коридора) ---
    // Смещаем вправо от центра, напротив мастерской
    const tradeRoomX = centerX + 4; 
    const tradeRoomY = 12; // Та же высота Y=12
    
    // Комната 4x4
    fillRect(tradeRoomX, tradeRoomY, 4, 4);
    // Проход влево к коридору
    fillRect(tradeRoomX - 2, tradeRoomY + 1, 2, 2);

    window.stationZones.push({ name: "ЗОНА ОБМЕНА", x: tradeRoomX, y: tradeRoomY, w: 4, h: 4 });
    
    // Добавляем терминал обмена (модуль)
    stationModules.push({ 
        type: 'exchange_post', 
        x: tradeRoomX + 1, 
        y: tradeRoomY + 1, 
        w: 2, 
        h: 2 
    });
}

function isShipInDockingZone() {
    if (currentSystemType !== 'station') return false;
    return Math.hypot(mapShip.x - station.x, mapShip.y - station.y) < station.dockingRadius;
}

function handleDockingInteraction() {
    if (currentState !== STATE_MAP || currentSystemType !== 'station') return;
    
    if (isDocked) { 
        isDocked = false; 
        if (typeof uiHint !== 'undefined') uiHint.innerHTML = "UNDOCKED";
    } 
    else if (isShipInDockingZone()) { 
        const availableHangars = window.hangarSpots.filter(h => {
            const isOccupied = Object.values(mpState.remotePlayers).some(p => {
                if (p.locationMode === 2) return false; 
                if (!p.shipStructure || !p.shipStructure.tiles) return false;
                return p.shipStructure.tiles.some(t => 
                    t.x >= h.x && t.x < h.x + h.w && 
                    t.y >= h.y && t.y < h.y + h.h
                );
            });
            return !isOccupied;
        });

        if (availableHangars.length === 0) return;

        const targetHangar = availableHangars[0];
        isDocked = true; 
        mapShip.vx = 0; mapShip.vy = 0; 
        
        if (window.shipTiles && window.shipTiles.length > 0) {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            shipTiles.forEach(t => {
                if (t.x < minX) minX = t.x; if (t.x > maxX) maxX = t.x;
                if (t.y < minY) minY = t.y; if (t.y > maxY) maxY = t.y;
            });

            const shipW = maxX - minX + 1;
            const shipH = maxY - minY + 1;

            const shipGridCX = minX + shipW / 2;
            const shipGridCY = minY + shipH / 2;
            const hangarGridCX = targetHangar.x + targetHangar.w / 2;
            const hangarGridCY = targetHangar.y + targetHangar.h / 2;

            const diffGridX = Math.round(hangarGridCX - shipGridCX);
            const diffGridY = Math.round(hangarGridCY - shipGridCY);

            shipTiles.forEach(t => { t.x += diffGridX; t.y += diffGridY; });
            if (typeof installedModules !== 'undefined') {
                installedModules.forEach(m => { m.x += diffGridX; m.y += diffGridY; });
            }
            
            player.x += diffGridX * TILE_SIZE;
            player.y += diffGridY * TILE_SIZE;

            if (typeof uiHint !== 'undefined') {
                uiHint.innerHTML = `DOCKED AT: <span style="color:#00e5ff">${targetHangar.name}</span>`;
            }
        } 
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