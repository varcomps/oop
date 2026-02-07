let station = { x: 0, y: 0, dockingRadius: 150, visible: true }; 
let stationTiles = []; 
let stationModules = [];
window.stationZones = []; 

function generateStation() {
    stationTiles = []; stationModules = []; window.stationZones = [];
    const fillRect = (rx, ry, rw, rh) => {
        for(let x=0; x<rw; x++) for(let y=0; y<rh; y++) { stationTiles.push({x: rx + x, y: ry + y}); }
        return {x: rx, y: ry, w: rw, h: rh, cx: rx + Math.floor(rw/2), cy: ry + Math.floor(rh/2)};
    };
    const hangarW = 32, hangarH = 18;
    const hangar = fillRect(0, 0, hangarW, hangarH);
    window.stationZones.push({ name: "ГЛАВНЫЙ АНГАР", x: hangar.x, y: hangar.y, w: hangar.w, h: hangar.h });
    let sides = [0, 1, 2, 3]; sides.sort(() => Math.random() - 0.5);
    const engSide = sides.pop(); const hubSide = sides.pop();
    const createRoom = (source, side, rw, rh, name, corrLen=3) => {
        let rx, ry, cx, cy, cw, ch;
        if (side === 0) { rx = source.x + Math.floor((source.w - rw) / 2); ry = source.y - rh - corrLen; cx = source.x + Math.floor(source.w/2) - 2; cy = source.y - corrLen; cw = 4; ch = corrLen; } 
        else if (side === 1) { rx = source.x + source.w + corrLen; ry = source.y + Math.floor((source.h - rh) / 2); cx = source.x + source.w; cy = source.y + Math.floor(source.h/2) - 2; cw = corrLen; ch = 4; } 
        else if (side === 2) { rx = source.x + Math.floor((source.w - rw) / 2); ry = source.y + source.h + corrLen; cx = source.x + Math.floor(source.w/2) - 2; cy = source.y + source.h; cw = 4; ch = corrLen; } 
        else { rx = source.x - rw - corrLen; ry = source.y + Math.floor((source.h - rh) / 2); cx = source.x - corrLen; cy = source.y + Math.floor(source.h/2) - 2; cw = corrLen; ch = 4; }
        fillRect(cx, cy, cw, ch); const room = fillRect(rx, ry, rw, rh);
        window.stationZones.push({ name: name, x: rx, y: ry, w: rw, h: rh });
        return { ...room, entranceSide: (side + 2) % 4 }; 
    };
    const engRoom = createRoom(hangar, engSide, 12, 12, "ИНЖЕНЕРНЫЙ ОТСЕК");
    stationModules.push({ type: 'engineering_terminal', x: engRoom.cx - 1, y: engRoom.cy - 1, w: 2, h: 2 });
    const hubRoom = createRoom(hangar, hubSide, 14, 14, "ЦЕНТРАЛЬНЫЙ ХАБ");
    let reactorSides = [0, 1, 2, 3].filter(s => s !== hubRoom.entranceSide);
    const reactorSide = reactorSides[Math.floor(Math.random() * reactorSides.length)];
    const reactorRoom = createRoom(hubRoom, reactorSide, 10, 10, "РЕАКТОРНАЯ");
    stationModules.push({ type: 'trade_post', x: reactorRoom.cx - 1, y: reactorRoom.cy - 1, w: 2, h: 2 });

    let marketSides = [0, 1, 2, 3].filter(s => s !== hubRoom.entranceSide && s !== reactorSide);
    if (marketSides.length > 0) {
        const marketSide = marketSides[Math.floor(Math.random() * marketSides.length)];
        const marketRoom = createRoom(hubRoom, marketSide, 12, 10, "ТОРГОВЫЙ СКЛАД");
        stationModules.push({ type: 'commodities_terminal', x: marketRoom.cx - 1, y: marketRoom.cy - 1, w: 2, h: 2 });
    }
}

function isShipInDockingZone() {
    if (currentSystemType !== 'station') return false;
    return Math.hypot(mapShip.x - station.x, mapShip.y - station.y) < station.dockingRadius;
}

function handleDockingInteraction() {
    if (currentState !== STATE_MAP || currentSystemType !== 'station') return;
    if (isDocked) { isDocked = false; } 
    else if (isShipInDockingZone()) { isDocked = true; mapShip.vx = 0; mapShip.vy = 0; startTransition(STATE_SHIP); }
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