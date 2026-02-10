/* spectrum.js - ПОЛНАЯ ВЕРСИЯ С ОТЛАДКОЙ */

const sp3dCanvas = document.getElementById('sp3dCanvas');
const sp3dCtx = sp3dCanvas.getContext('2d');
const btnScanAction = document.getElementById('btnScanAction');

window.activeAutopilotRoute = null;

const CLOUD_RADIUS = 280; 
const STAR_COUNT = 250;
const FOCAL_LENGTH = 400;
const MAX_JUMP_DIST = 160; 

let stars3D = [];
let rotation = { x: 0, y: 0 };
let targetRotation = { x: 0, y: 0 };
let isDragging3D = false;
let lastMouse = { x: 0, y: 0 };

let scan3DState = {
    active: false,
    radius: 0, 
    maxRadius: 600,
    scanned: false,
    selectedNode: null,
    playerNode: null,
    route: [],
    animTime: 0
};

class StarNode {
    constructor(x, y, z) {
        this.x = x; this.y = y; this.z = z;
        this.px = 0; this.py = 0; this.scale = 0; 
        
        this.isPlayer = (Math.abs(x) < 5 && Math.abs(y) < 5 && Math.abs(z) < 5);
        this.isRemotePlayer = false; 
        this.playerData = null;      

        this.type = this.isPlayer ? 'player' : 'unknown';
        this.revealedType = this.isPlayer ? 'player' : this.generateType();
        
        this.color = this.isPlayer ? '#ff1744' : '#ffffff';
        this.baseColor = this.color;
        this.alpha = 0.5;
        this.radius = Math.random() * 2 + 1;
        
        this.neighbors = [];
        this.gScore = Infinity;
        this.parent = null;
    }

    generateType() {
        if (this.isRemotePlayer) return 'player';
        
        const r = Math.random();
        if (r < 0.012) return 'station'; 
        if (r < 0.016) return 'system';  
        if (r < 0.017) return 'black_hole'; 
        return 'empty'; 
    }

    reveal() {
        if (this.type !== 'unknown') return;
        this.type = this.revealedType;
        
        if (this.type === 'station') { this.baseColor = '#00e5ff'; this.radius = 5; }
        else if (this.type === 'system') { this.baseColor = '#ffab00'; this.radius = 4; }
        else if (this.type === 'black_hole') { this.baseColor = '#d500f9'; this.radius = 6; }
        else if (this.type === 'player') { 
            this.baseColor = '#ff1744'; // ЯРКО-КРАСНЫЙ ЦВЕТ ДЛЯ ИГРОКА
            this.radius = 8; // БОЛЬШОЙ РАЗМЕР
            this.alpha = 1;
        }
        else { this.baseColor = '#555'; this.alpha = 0.4; } 
        this.color = this.baseColor;
    }
}

// Функция сброса цели
window.clear3DTarget = function() {
    scan3DState.selectedNode = null;
    scan3DState.route = [];
    window.activeAutopilotRoute = null;
};

// Полный сброс спектра
window.resetSpectrum = function() {
    stars3D = [];
    window.activeAutopilotRoute = null; 
    scan3DState = { 
        active: false, radius: 0, maxRadius: 600, scanned: false, 
        selectedNode: null, playerNode: null, route: [], animTime: 0
    };
    btnScanAction.style.display = 'inline-block';
};

function initSpectrum() {
    console.log(">>> [DEBUG] initSpectrum ЗАПУЩЕН"); // ЛОГ 1

    if (stars3D.length > 0) return;

    sp3dCanvas.width = 800;
    sp3dCanvas.height = 600;
    
    stars3D = [];
    const player = new StarNode(0, 0, 0);
    scan3DState.playerNode = player;
    stars3D.push(player);
    
    // Обычные звезды
    for(let i=0; i<STAR_COUNT; i++) {
        const r = Math.cbrt(Math.random()) * CLOUD_RADIUS;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);

        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);

        if (Math.abs(x) > 15 || Math.abs(y) > 15 || Math.abs(z) > 15) {
            stars3D.push(new StarNode(x, y, z));
        }
    }

    // --- ПРОВЕРКА И ЗАПУСК МУЛЬТИПЛЕЕРА ---
    if (typeof window.scanForPlayers === 'function') {
        console.log(">>> [DEBUG] Функция scanForPlayers НАЙДЕНА. Выполняю запрос..."); // ЛОГ 2
        
        window.scanForPlayers().then(players => {
            console.log(">>> [DEBUG] Ответ от scanForPlayers:", players); // ЛОГ 3
            
            if (players.length === 0) {
                console.log(">>> [DEBUG] Список игроков пуст (или никого нет в сети).");
            }

            players.forEach(p => {
                console.log(">>> [DEBUG] Добавляю игрока в спектр:", p.nickname); // ЛОГ 4

                // Генерируем "звезду" игрока
                const r = Math.random() * 100 + 50; 
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos((Math.random() * 2) - 1);
                
                const x = r * Math.sin(phi) * Math.cos(theta);
                const y = r * Math.sin(phi) * Math.sin(theta);
                const z = r * Math.cos(phi);

                const node = new StarNode(x, y, z);
                node.isRemotePlayer = true; 
                node.type = 'player';
                node.revealedType = 'player';
                node.baseColor = '#d50000';
                node.color = '#d50000';
                node.radius = 8; 
                node.playerData = p; 
                
                stars3D.push(node);
                
                // Сразу связываем, чтобы можно было найти путь
                const dist = getDist3D(scan3DState.playerNode, node);
                scan3DState.playerNode.neighbors.push({ node: node, dist: dist });
                node.neighbors.push({ node: scan3DState.playerNode, dist: dist });
            });
        }).catch(err => {
            console.error(">>> [DEBUG] ОШИБКА при сканировании игроков:", err);
        });
    } else {
        console.error(">>> [DEBUG] ОШИБКА: Функция window.scanForPlayers НЕ ОПРЕДЕЛЕНА. Проверь multiplayer.js!");
    }
    // --------------------------------------

    // Связи
    stars3D.forEach(star => {
        stars3D.forEach(other => {
            if (star === other) return;
            const dist = getDist3D(star, other);
            if (dist <= MAX_JUMP_DIST) {
                star.neighbors.push({ node: other, dist: dist });
            }
        });
    });

    btnScanAction.style.display = 'inline-block';

    sp3dCanvas.onmousedown = (e) => { 
        if (typeof isWarping !== 'undefined' && isWarping) return; 
        isDragging3D = true; 
        lastMouse.x = e.clientX; 
        lastMouse.y = e.clientY; 
        checkClick(e.offsetX, e.offsetY);
    };
    window.onmouseup = () => { isDragging3D = false; };
    window.onmousemove = (e) => {
        if (!isDragging3D) return;
        const dx = e.clientX - lastMouse.x;
        const dy = e.clientY - lastMouse.y;
        targetRotation.y += dx * 0.01;
        targetRotation.x += dy * 0.01;
        lastMouse.x = e.clientX;
        lastMouse.y = e.clientY;
    };
}

function getDist3D(a, b) {
    return Math.sqrt(Math.pow(a.x-b.x, 2) + Math.pow(a.y-b.y, 2) + Math.pow(a.z-b.z, 2));
}

function toggleSpectrum(state) {
    isSpectrumOpen = state;
    document.getElementById('spectrumUI').style.display = state ? 'flex' : 'none';
    if(state) {
        initSpectrum();
    }
}

// --- ОТРИСОВКА ПОМЕХ ---
function drawWarpStatic() {
    sp3dCtx.fillStyle = 'rgba(0, 5, 10, 0.4)';
    sp3dCtx.fillRect(0, 0, sp3dCanvas.width, sp3dCanvas.height);
    for (let i = 0; i < 30; i++) {
        const y = Math.random() * sp3dCanvas.height;
        const h = Math.random() * 20 + 2;
        const alpha = Math.random() * 0.3;
        const rand = Math.random();
        if(rand > 0.6) sp3dCtx.fillStyle = `rgba(0, 229, 255, ${alpha})`; 
        else if (rand > 0.3) sp3dCtx.fillStyle = `rgba(255, 23, 68, ${alpha})`; 
        else sp3dCtx.fillStyle = `rgba(255, 255, 255, ${alpha})`; 
        sp3dCtx.fillRect(0, y, sp3dCanvas.width, h);
    }
    for (let i = 0; i < 200; i++) {
        const x = Math.random() * sp3dCanvas.width;
        const y = Math.random() * sp3dCanvas.height;
        const w = Math.random() * 4;
        sp3dCtx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000';
        sp3dCtx.globalAlpha = Math.random() * 0.5;
        sp3dCtx.fillRect(x, y, w, 2);
    }
    sp3dCtx.globalAlpha = 1.0;
    if (Math.random() > 0.1) { 
        sp3dCtx.save();
        sp3dCtx.translate((Math.random()-0.5)*5, (Math.random()-0.5)*5); 
        sp3dCtx.font = "bold 40px Orbitron";
        sp3dCtx.textAlign = "center";
        sp3dCtx.fillStyle = "rgba(255, 0, 0, 0.5)";
        sp3dCtx.fillText("SIGNAL LOST", sp3dCanvas.width/2 + 4, sp3dCanvas.height/2);
        sp3dCtx.fillStyle = "rgba(0, 255, 255, 0.5)";
        sp3dCtx.fillText("SIGNAL LOST", sp3dCanvas.width/2 - 4, sp3dCanvas.height/2);
        sp3dCtx.fillStyle = "#fff";
        sp3dCtx.fillText("SIGNAL LOST", sp3dCanvas.width/2, sp3dCanvas.height/2);
        sp3dCtx.font = "16px monospace";
        sp3dCtx.fillStyle = "#ff5252";
        sp3dCtx.fillText("INTERFERENCE DETECTED // HYPERSPACE CONDUIT", sp3dCanvas.width/2, sp3dCanvas.height/2 + 40);
        sp3dCtx.restore();
    }
    btnScanAction.style.display = 'none';
}

function updateSpectrum() {
    if (!isSpectrumOpen) return;
    
    if (typeof isWarping !== 'undefined' && isWarping) {
        drawWarpStatic();
        return; 
    }

    if (stars3D.length === 0) {
        initSpectrum();
    }

    if (!scan3DState.scanned && btnScanAction.style.display === 'none') {
        btnScanAction.style.display = 'inline-block';
    }

    scan3DState.animTime += 0.05;

    rotation.x += (targetRotation.x - rotation.x) * 0.1;
    rotation.y += (targetRotation.y - rotation.y) * 0.1;
    
    sp3dCtx.fillStyle = '#000';
    sp3dCtx.fillRect(0, 0, sp3dCanvas.width, sp3dCanvas.height);
    
    const cx = sp3dCanvas.width / 2;
    const cy = sp3dCanvas.height / 2;

    stars3D.sort((a, b) => b.z - a.z);

    sp3dCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    sp3dCtx.lineWidth = 1;
    sp3dCtx.beginPath();
    stars3D.forEach(star => {
        let x1 = star.x * Math.cos(rotation.y) - star.z * Math.sin(rotation.y);
        let z1 = star.z * Math.cos(rotation.y) + star.x * Math.sin(rotation.y);
        let y2 = star.y * Math.cos(rotation.x) - z1 * Math.sin(rotation.x);
        let z2 = z1 * Math.cos(rotation.x) + star.y * Math.sin(rotation.x);
        
        const scale = FOCAL_LENGTH / (FOCAL_LENGTH + z2);
        star.scale = scale;
        star.px = cx + x1 * scale;
        star.py = cy + y2 * scale;

        if (z2 > -FOCAL_LENGTH + 10) {
            star.neighbors.forEach(n => {
                if (n.node.z < star.z) return;
                let nx1 = n.node.x * Math.cos(rotation.y) - n.node.z * Math.sin(rotation.y);
                let nz1 = n.node.z * Math.cos(rotation.y) + n.node.x * Math.sin(rotation.y);
                let ny2 = n.node.y * Math.cos(rotation.x) - nz1 * Math.sin(rotation.x);
                let nz2 = nz1 * Math.cos(rotation.x) + n.node.y * Math.sin(rotation.x);
                const nScale = FOCAL_LENGTH / (FOCAL_LENGTH + nz2);
                
                sp3dCtx.moveTo(star.px, star.py);
                sp3dCtx.lineTo(cx + nx1 * nScale, cy + ny2 * nScale);
            });
        }
    });
    sp3dCtx.stroke();

    stars3D.forEach(star => {
        if (star.scale <= 0) return;

        if (scan3DState.active) {
            const distFromCenter = Math.sqrt(star.x*star.x + star.y*star.y + star.z*star.z);
            if (distFromCenter < scan3DState.radius) {
                star.reveal();
            }
        }

        let alpha = star.alpha;
        if (star.type !== 'empty' && !star.isPlayer) {
             alpha = 0.8 + Math.sin(scan3DState.animTime * 2 + star.x) * 0.2;
        }

        sp3dCtx.beginPath();
        let r = star.radius * star.scale;
        if (star.isPlayer) {
            r = 5 * star.scale; 
            alpha = 1;          
        }

        sp3dCtx.arc(star.px, star.py, r, 0, Math.PI * 2);
        sp3dCtx.fillStyle = star.color;
        sp3dCtx.globalAlpha = alpha;
        
        if (scan3DState.selectedNode === star) {
            sp3dCtx.shadowBlur = 15; sp3dCtx.shadowColor = star.color; sp3dCtx.globalAlpha = 1;
            sp3dCtx.strokeStyle = star.color; sp3dCtx.lineWidth = 2; sp3dCtx.stroke();
            sp3dCtx.beginPath(); sp3dCtx.arc(star.px, star.py, 14*star.scale, 0, Math.PI*2); sp3dCtx.stroke();
        } else {
            sp3dCtx.shadowBlur = 0;
        }
        sp3dCtx.fill();
        sp3dCtx.globalAlpha = 1; sp3dCtx.shadowBlur = 0;
    });

    if (scan3DState.route.length > 1) {
        sp3dCtx.beginPath();
        sp3dCtx.strokeStyle = '#00e676';
        sp3dCtx.lineWidth = 2;
        
        const start = scan3DState.route[0];
        sp3dCtx.moveTo(start.px, start.py);
        
        for (let i = 1; i < scan3DState.route.length; i++) {
            const node = scan3DState.route[i];
            sp3dCtx.lineTo(node.px, node.py);
        }
        sp3dCtx.stroke();
        
        scan3DState.route.forEach(node => {
            sp3dCtx.beginPath();
            sp3dCtx.fillStyle = '#fff';
            sp3dCtx.arc(node.px, node.py, 3 * node.scale, 0, Math.PI*2);
            sp3dCtx.fill();
        });
    }

    if (scan3DState.active) {
        scan3DState.radius += 12;
        sp3dCtx.beginPath();
        sp3dCtx.strokeStyle = 'rgba(0, 229, 255, 0.5)';
        sp3dCtx.lineWidth = 2;
        const screenRad = scan3DState.radius * (FOCAL_LENGTH / (FOCAL_LENGTH + 0)); 
        sp3dCtx.arc(cx, cy, screenRad, 0, Math.PI*2);
        sp3dCtx.stroke();

        if (scan3DState.radius > scan3DState.maxRadius) {
            scan3DState.active = false; scan3DState.scanned = true;
            btnScanAction.style.display = 'inline-block'; 
        }
    }
}

function perform3DScan() {
    if (scan3DState.active) return;

    console.log(">>> [SPECTRUM] Starting deep scan...");

    // Очищаем старые данные о найденных игроках перед новым сканированием
    stars3D = stars3D.filter(star => !star.isRemotePlayer);
    scan3DState.scanned = false;
    scan3DState.radius = 0;
    scan3DState.active = true;

    // Запускаем свежий поиск игроков в Firebase
    fetchPlayersForSpectrum();
}
function fetchPlayersForSpectrum() {
    if (typeof window.scanForPlayers !== 'function') return;

    window.scanForPlayers().then(players => {
        players.forEach(p => {
            // Создаем узел для каждого найденного игрока
            const r = Math.random() * 120 + 60; 
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            
            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.sin(phi) * Math.sin(theta);
            const z = r * Math.cos(phi);

            const node = new StarNode(x, y, z);
            node.isRemotePlayer = true; 
            node.type = 'player';
            node.revealedType = 'player';
            node.baseColor = '#d50000';
            node.color = '#d50000';
            node.radius = 8; 
            node.playerData = p; 
            
            stars3D.push(node);
            
            // Связываем с игроком для прокладывания пути
            const dist = getDist3D(scan3DState.playerNode, node);
            scan3DState.playerNode.neighbors.push({ node: node, dist: dist });
            node.neighbors.push({ node: scan3DState.playerNode, dist: dist });
        });
    });
}
function checkClick(mx, my) {
    if (!scan3DState.scanned) return;

    let closest = null;
    let minDist = 20; 

    stars3D.forEach(star => {
        if (star.isPlayer) return;
        
        // Позволяем кликать на игроков, даже если они не раскрыты полностью (но лучше раскрытые)
        // Для игроков разрешаем клик
        if (star.type === 'empty' || (star.type === 'unknown' && !star.isRemotePlayer)) return; 

        const dx = mx - star.px;
        const dy = my - star.py;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < minDist) {
            minDist = dist;
            closest = star;
        }
    });

    if (closest) {
        calculatePathTo(closest);
    }
}

function calculatePathTo(target) {
    scan3DState.selectedNode = target;
    scan3DState.route = [];
    
    // --- СПЕЦИАЛЬНЫЙ ПУТЬ ДЛЯ МУЛЬТИПЛЕЕРА ---
    if (target.type === 'player' && target.isRemotePlayer) {
        console.log(">>> [DEBUG] Маршрут к игроку построен:", target.playerData.nickname);
        window.activeAutopilotRoute = {
            targetType: 'player',
            jumpsRequired: 1, 
            playerNick: target.playerData.nickname,
            playerData: target.playerData
        };
        // Рисуем линию напрямую
        scan3DState.route = [scan3DState.playerNode, target];
        return;
    }
    // ----------------------------------------
    
    stars3D.forEach(s => { s.gScore = Infinity; s.parent = null; });
    
    const start = scan3DState.playerNode;
    start.gScore = 0;
    
    const openSet = [start];
    const visited = new Set();

    let found = false;

    while (openSet.length > 0) {
        openSet.sort((a, b) => a.gScore - b.gScore);
        const current = openSet.shift();
        
        if (current === target) {
            found = true;
            break;
        }
        visited.add(current);

        for (let edge of current.neighbors) {
            const neighbor = edge.node;
            if (visited.has(neighbor)) continue;

            const tentativeG = current.gScore + edge.dist;
            if (tentativeG < neighbor.gScore) {
                neighbor.gScore = tentativeG;
                neighbor.parent = current;
                if (!openSet.includes(neighbor)) {
                    openSet.push(neighbor);
                }
            }
        }
    }

    if (found) {
        let curr = target;
        while (curr) {
            scan3DState.route.push(curr);
            curr = curr.parent;
        }
        scan3DState.route.reverse();
        
        window.activeAutopilotRoute = {
            targetType: target.type,
            jumpsRequired: scan3DState.route.length - 1
        };
    } else {
        window.activeAutopilotRoute = null;
    }
}