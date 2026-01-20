const mapUI = document.getElementById('mapUI');
const jumpBtn = document.getElementById('jumpBtn');
const dockBtn = document.getElementById('dockBtn');
const chargeBar = document.getElementById('chargeBar');
const chargeContainer = document.getElementById('chargeBarContainer');

const mapShip = { x: 0, y: 0, angle: -Math.PI / 2, vx: 0, vy: 0, thrust: 0.05, rotationSpeed: 0.04, friction: 0.99 };
let station = { x: 0, y: 0, radius: 40 }; 
let stars = []; const STAR_COUNT = 800;
let stationTiles = []; 
let stationModules = [];
window.stationZones = []; 

let warpFactor = 0, isWarping = false;
const WARP_IDLE=0, WARP_CHARGE=1, WARP_JUMP=2, WARP_COAST=3, WARP_EXIT=4;
let warpState = { phase: WARP_IDLE, timer: 0 };

function initSpace() {
    mapShip.x = canvas.width / 2; mapShip.y = canvas.height / 2;
    station.x = Math.random() * (canvas.width * 0.8) + canvas.width * 0.1;
    station.y = Math.random() * (canvas.height * 0.8) + canvas.height * 0.1;
    generateStars();
    generateStation();
}

function generateStars() {
    stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
            x: (Math.random() - 0.5) * canvas.width * 3,
            y: (Math.random() - 0.5) * canvas.height * 3,
            z: Math.random() * 2000 + 10,
            size: Math.random() * 2 + 0.5,
            color: Math.random() > 0.85 ? '#00e5ff' : '#ffffff'
        });
    }
}

// Вспомогательная функция для получения случайного направления
function getRandomDir(exclude = -1) {
    let dir;
    do { dir = Math.floor(Math.random() * 4); } while (dir === exclude);
    return dir;
}

function generateStation() {
    stationTiles = []; stationModules = []; window.stationZones = [];
    
    // 1. АНГАР (HANGAR)
    const hangarW = 32; const hangarH = 18;
    const hangarX = 0; const hangarY = 0; 
    for(let x=0; x<hangarW; x++) for(let y=0; y<hangarH; y++) stationTiles.push({x: hangarX + x, y: hangarY + y});
    window.stationZones.push({ name: "ГЛАВНЫЙ АНГАР", x: hangarX, y: hangarY, w: hangarW, h: hangarH });

    // 2. КОРИДОР + ХОЛЛ
    const hallDir = getRandomDir();
    const corrLen = 4; const corrW = 4;
    const hallW = 10; const hallH = 10;
    
    let corrX, corrY, hallX, hallY;
    if (hallDir === 0) { // TOP
        corrX = hangarX + (hangarW - corrW)/2; corrY = hangarY - corrLen;
        hallX = corrX + (corrW - hallW)/2; hallY = corrY - hallH;
    } else if (hallDir === 1) { // RIGHT
        corrX = hangarX + hangarW; corrY = hangarY + (hangarH - corrW)/2;
        hallX = corrX + corrLen; hallY = corrY + (corrW - hallH)/2;
    } else if (hallDir === 2) { // BOTTOM
        corrX = hangarX + (hangarW - corrW)/2; corrY = hangarY + hangarH;
        hallX = corrX + (corrW - hallW)/2; hallY = corrY + corrLen;
    } else { // LEFT
        corrX = hangarX - corrLen; corrY = hangarY + (hangarH - corrW)/2;
        hallX = corrX - hallW; hallY = corrY + (corrW - hallH)/2;
    }

    for(let x=0; x<((hallDir===1||hallDir===3)?corrLen:corrW); x++) for(let y=0; y<((hallDir===1||hallDir===3)?corrW:corrLen); y++) stationTiles.push({x: corrX + x, y: corrY + y});
    for(let x=0; x<hallW; x++) for(let y=0; y<hallH; y++) stationTiles.push({x: hallX + x, y: hallY + y});
    window.stationZones.push({ name: "ЦЕНТРАЛЬНЫЙ ЗАЛ", x: hallX, y: hallY, w: hallW, h: hallH });

    // 3. РЕАКТОРНАЯ
    const fromDir = (hallDir + 2) % 4;
    const reactDir = getRandomDir(fromDir);
    const reactW = 8; const reactH = 8;
    let rCorrX, rCorrY, reactX, reactY;

    if (reactDir === 0) { // TOP
        rCorrX = hallX + (hallW - 2)/2; rCorrY = hallY - 4;
        reactX = rCorrX + (2 - reactW)/2; reactY = rCorrY - reactH;
        for(let x=0; x<2; x++) for(let y=0; y<4; y++) stationTiles.push({x: rCorrX+x, y: rCorrY+y});
    } else if (reactDir === 1) { // RIGHT
        rCorrX = hallX + hallW; rCorrY = hallY + (hallH - 4)/2;
        reactX = rCorrX + 2; reactY = rCorrY + (4 - reactH)/2;
        for(let x=0; x<2; x++) for(let y=0; y<4; y++) stationTiles.push({x: rCorrX+x, y: rCorrY+y});
    } else if (reactDir === 2) { // BOTTOM
        rCorrX = hallX + (hallW - 2)/2; rCorrY = hallY + hallH;
        reactX = rCorrX + (2 - reactW)/2; reactY = rCorrY + 4;
        for(let x=0; x<2; x++) for(let y=0; y<4; y++) stationTiles.push({x: rCorrX+x, y: rCorrY+y});
    } else { // LEFT
        rCorrX = hallX - 2; rCorrY = hallY + (hallH - 4)/2;
        reactX = rCorrX - reactW; reactY = rCorrY + (4 - reactH)/2;
        for(let x=0; x<2; x++) for(let y=0; y<4; y++) stationTiles.push({x: rCorrX+x, y: rCorrY+y});
    }
    for(let x=0; x<reactW; x++) for(let y=0; y<reactH; y++) stationTiles.push({x: reactX + x, y: reactY + y});
    window.stationZones.push({ name: "РЕАКТОРНЫЙ ОТСЕК", x: reactX, y: reactY, w: reactW, h: reactH });

    // 5. ТЕРМИНАЛ
    stationModules.push({ type: 'trade_post', x: Math.floor(reactX + reactW/2 - 1), y: Math.floor(reactY + reactH/2 - 1), w: 2, h: 2 });
}

function initiateHyperJump() {
    if (currentState !== STATE_MAP || isWarping) return;
    const fuel = getFuelCount();
    if (fuel < 1) return; 

    consumeFuel(1);
    isWarping = true; warpState.phase = WARP_CHARGE; warpState.timer = 0; warpFactor = 0;
    chargeContainer.style.display = 'block'; 
    jumpBtn.disabled = true; jumpBtn.style.removeProperty('border-color'); jumpBtn.innerHTML = "SPOOLING UP...";
    isDocked = false; dockBtn.style.display = 'none';
}

function updateWarpLogic() {
    if (!isWarping) {
        const fuel = getFuelCount();
        const hasFuel = fuel > 0;
        if (hasFuel) {
             jumpBtn.innerHTML = "INITIATE JUMP"; jumpBtn.disabled = false; jumpBtn.style.borderColor = "#ff5252";
        } else {
             jumpBtn.innerHTML = "NO FUEL"; jumpBtn.disabled = true; jumpBtn.style.removeProperty('border-color');
        }
        return;
    }

    if (warpState.phase === WARP_CHARGE) {
        warpState.timer++; warpFactor = (warpState.timer / 100) * 2; chargeBar.style.width = (warpState.timer)+'%';
        if (warpState.timer >= 100) { warpState.phase = WARP_JUMP; warpState.timer = 0; jumpBtn.innerHTML = "ENGAGING!"; }
    } else if (warpState.phase === WARP_JUMP) {
        warpState.timer++; warpFactor += 3 + (warpFactor * 0.15); 
        if (warpFactor > 100) { warpFactor = 100; warpState.phase = WARP_COAST; warpState.timer = 0; }
    } else if (warpState.phase === WARP_COAST) {
        warpState.timer++; 
        if (warpState.timer === 15) { 
            generateStars(); generateStation(); 
            jumpBtn.innerHTML = "ARRIVING..."; 
            station.x = Math.random() * (canvas.width * 0.8) + canvas.width * 0.1;
            station.y = Math.random() * (canvas.height * 0.8) + canvas.height * 0.1;
        }
        if (warpState.timer > 40) { warpState.phase = WARP_EXIT; warpState.timer = 0; }
    } else if (warpState.phase === WARP_EXIT) {
        warpFactor *= 0.85;
        if (warpFactor < 0.1) {
            warpFactor = 0; isWarping = false; warpState.phase = WARP_IDLE;
            chargeContainer.style.display = 'none'; chargeBar.style.width = '0%'; jumpBtn.disabled = false;
        }
    }
}

function handleDockingInteraction() {
    if (currentState !== STATE_MAP) return;
    if (isDocked) { isDocked = false; } 
    else {
        const dist = Math.hypot(mapShip.x - station.x, mapShip.y - station.y);
        if (dist < 100) { isDocked = true; mapShip.vx = 0; mapShip.vy = 0; startTransition(STATE_SHIP); }
    }
}

function drawMap() {
    drawStars(true); 
    
    // ЛОГИКА ОТРИСОВКИ СТАНЦИИ В ПЕРСПЕКТИВЕ (КАК ЗВЕЗДЫ)
    let sX = station.x;
    let sY = station.y;
    let sAlpha = 1;
    let sScale = 1;

    if (isWarping) {
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        if (warpState.phase === WARP_EXIT) {
            // ПРИБЫТИЕ: Станция появляется из глубины (Z)
            // warpFactor уменьшается от 100 до 0. 
            // Чем больше warpFactor, тем "глубже" (дальше) станция.
            const depth = 1 + (warpFactor * 0.3); // Коэффициент глубины
            const relX = station.x - cx;
            const relY = station.y - cy;
            
            sScale = 1 / depth; // Чем дальше, тем меньше
            sX = cx + (relX * sScale); // Проекция на центр
            sY = cy + (relY * sScale);
            sAlpha = Math.min(1, 1 - (warpFactor / 120)); // Плавное появление
        } else {
            // УХОД: Старая станция пролетает "мимо" камеры (Zoom In/Pass)
            // Имитация движения ВПЕРЕД, старый объект расширяется и уходит за кадр
            const passFactor = 1 + (warpFactor * 0.05);
            const relX = station.x - cx;
            const relY = station.y - cy;
            
            sScale = passFactor; 
            sX = cx + (relX * passFactor);
            sY = cy + (relY * passFactor);
            sAlpha = Math.max(0, 1 - (warpFactor * 0.05)); // Исчезает быстрее
        }
    }

    if (sAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = sAlpha;
        
        // Применяем масштаб от центра станции для эффекта зума
        ctx.translate(sX, sY);
        ctx.scale(sScale, sScale);
        ctx.translate(-sX, -sY);

        ctx.fillStyle = isWarping ? '#2979ff' : '#2979ff';
        ctx.fillRect(sX - 5, sY - 5, 10, 10);
        
        if (!isWarping) {
            ctx.fillStyle = "white"; ctx.font = "10px Orbitron"; ctx.fillText("STATION", sX - 25, sY - 15);
        }
        ctx.restore();
    }

    // ОТРИСОВКА КОРАБЛЯ
    ctx.save(); 
    ctx.translate(mapShip.x, mapShip.y); ctx.rotate(mapShip.angle);
    if (warpState.phase === WARP_CHARGE) { const shake = warpFactor * 2; ctx.translate(Math.random() * shake - shake / 2, Math.random() * shake - shake / 2); }
    if (isWarping && warpFactor > 1) ctx.scale(1, 1 + warpFactor / 20);
    ctx.fillStyle = '#00e676'; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, 4); ctx.lineTo(-2, 0); ctx.lineTo(-4, -4); ctx.fill();
    if (inputs.up && !isWarping && !isDocked) { ctx.fillStyle = '#ffb74d'; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-10, 3); ctx.lineTo(-10, -3); ctx.fill(); }
    ctx.restore();
}

function drawStars(isMap) {
    ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width / 2; const cy = canvas.height / 2; ctx.lineCap = 'round';
    stars.forEach(s => {
        let z = s.z - warpFactor;
        if (z <= 0) { z = 2000; s.z = 2000 + warpFactor; s.x = (Math.random() - 0.5) * canvas.width * 3; s.y = (Math.random() - 0.5) * canvas.height * 3; } else if (isWarping) s.z = z;
        const depth = 800; const scale = depth / z;
        let shiftX = 0, shiftY = 0; if (isMap) { shiftX = (mapShip.x - cx) * 0.5; shiftY = (mapShip.y - cy) * 0.5; }
        const headX = (s.x - shiftX) * scale + cx; const headY = (s.y - shiftY) * scale + cy;
        const tailZ = z + warpFactor * 5; const tailScale = depth / tailZ;
        const tailX = (s.x - shiftX) * tailScale + cx; const tailY = (s.y - shiftY) * tailScale + cy;
        const size = Math.max(0.5, s.size * scale);
        ctx.beginPath();
        if (Math.abs(headX - tailX) < 0.5) { ctx.moveTo(headX, headY); ctx.lineTo(headX + 0.01, headY); } else { ctx.moveTo(headX, headY); ctx.lineTo(tailX, tailY); }
        ctx.lineWidth = size * 2; ctx.strokeStyle = s.color; ctx.globalAlpha = Math.min(1, scale); ctx.stroke();
    });
    ctx.globalAlpha = 1; ctx.lineCap = 'butt';
}
