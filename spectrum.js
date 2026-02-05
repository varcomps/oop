// spectrum.js - 3D PATHFINDING SCANNER
const sp3dCanvas = document.getElementById('sp3dCanvas');
const sp3dCtx = sp3dCanvas.getContext('2d');
const btnScanAction = document.getElementById('btnScanAction');
const btnEngage3D = document.getElementById('btnEngage3D');

// --- НАСТРОЙКИ 3D ---
const CUBE_SIZE = 220; // Уменьшил, чтобы влезало
const STAR_COUNT = 250;
const FOCAL_LENGTH = 400;
const MAX_JUMP_DIST = 160; // Макс длина одного прыжка

let stars3D = [];
let rotation = { x: 0, y: 0 };
let targetRotation = { x: 0, y: 0 };
let isDragging3D = false;
let lastMouse = { x: 0, y: 0 };

// --- СОСТОЯНИЕ ---
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
        this.px = 0; this.py = 0; this.scale = 0; // Проекции
        
        // Игрок всегда в центре
        this.isPlayer = (Math.abs(x) < 10 && Math.abs(y) < 10 && Math.abs(z) < 10);
        this.type = this.isPlayer ? 'player' : 'unknown';
        this.revealedType = this.isPlayer ? 'player' : this.generateType();
        
        // Цвет: Игрок = Красный
        this.color = this.isPlayer ? '#ff1744' : '#ffffff';
        this.baseColor = this.color;
        this.alpha = 0.5;
        this.radius = Math.random() * 2 + 1;
        
        // Для поиска пути
        this.neighbors = [];
        this.gScore = Infinity;
        this.parent = null;
    }

    generateType() {
        const r = Math.random();
        if (r < 0.02) return 'station'; // 2%
        if (r < 0.06) return 'system';  // 4%
        if (r < 0.07) return 'black_hole'; // 1%
        return 'empty'; // 93% Пустота
    }

    reveal() {
        if (this.type !== 'unknown') return;
        this.type = this.revealedType;
        
        if (this.type === 'station') { this.baseColor = '#00e5ff'; this.radius = 5; }
        else if (this.type === 'system') { this.baseColor = '#ffab00'; this.radius = 4; }
        else if (this.type === 'black_hole') { this.baseColor = '#d500f9'; this.radius = 6; }
        else { this.baseColor = '#555'; this.alpha = 0.4; } // Пустые - серые
        this.color = this.baseColor;
    }
}

function initSpectrum() {
    sp3dCanvas.width = 800;
    sp3dCanvas.height = 600;
    
    stars3D = [];
    const player = new StarNode(0, 0, 0);
    scan3DState.playerNode = player;
    stars3D.push(player);
    
    for(let i=0; i<STAR_COUNT; i++) {
        const x = (Math.random() - 0.5) * CUBE_SIZE * 2;
        const y = (Math.random() - 0.5) * CUBE_SIZE * 2;
        const z = (Math.random() - 0.5) * CUBE_SIZE * 2;
        if (Math.abs(x) > 20 || Math.abs(y) > 20 || Math.abs(z) > 20) {
            stars3D.push(new StarNode(x, y, z));
        }
    }

    // Строим связи
    stars3D.forEach(star => {
        stars3D.forEach(other => {
            if (star === other) return;
            const dist = getDist3D(star, other);
            if (dist <= MAX_JUMP_DIST) {
                star.neighbors.push({ node: other, dist: dist });
            }
        });
    });

    scan3DState = { 
        active: false, radius: 0, maxRadius: 600, scanned: false, 
        selectedNode: null, playerNode: player, route: [], animTime: 0
    };
    
    btnScanAction.style.display = 'inline-block';
    btnEngage3D.style.display = 'none';

    sp3dCanvas.onmousedown = (e) => { 
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
    if(state) initSpectrum();
}

// === ОТРИСОВКА ===
function updateSpectrum() {
    if (!isSpectrumOpen) return;
    scan3DState.animTime += 0.05;

    rotation.x += (targetRotation.x - rotation.x) * 0.1;
    rotation.y += (targetRotation.y - rotation.y) * 0.1;
    
    sp3dCtx.fillStyle = '#000';
    sp3dCtx.fillRect(0, 0, sp3dCanvas.width, sp3dCanvas.height);
    
    const cx = sp3dCanvas.width / 2;
    const cy = sp3dCanvas.height / 2;

    stars3D.sort((a, b) => b.z - a.z);

    // 1. Рисуем связи (тусклые линии)
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
                if (n.node.z < star.z) return; // Рисуем один раз
                // Вращаем соседа для проекции
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

    // 2. Рисуем звезды
    stars3D.forEach(star => {
        if (star.scale <= 0) return;

        // Эффект волны
        if (scan3DState.active) {
            const distFromCenter = Math.sqrt(star.x*star.x + star.y*star.y + star.z*star.z);
            if (distFromCenter < scan3DState.radius) {
                star.reveal();
            }
        }

        // Мерцание
        let alpha = star.alpha;
        if (star.type !== 'empty') alpha = 0.8 + Math.sin(scan3DState.animTime * 2 + star.x) * 0.2;

        sp3dCtx.beginPath();
        let r = star.radius * star.scale;
        
        // Игрок пульсирует
        if (star.isPlayer) r += Math.sin(scan3DState.animTime * 5) * 1.5;

        sp3dCtx.arc(star.px, star.py, r, 0, Math.PI * 2);
        sp3dCtx.fillStyle = star.color;
        sp3dCtx.globalAlpha = alpha;
        
        if (scan3DState.selectedNode === star) {
            sp3dCtx.shadowBlur = 15; sp3dCtx.shadowColor = star.color; sp3dCtx.globalAlpha = 1;
            sp3dCtx.strokeStyle = star.color; sp3dCtx.lineWidth = 1; sp3dCtx.stroke();
            sp3dCtx.beginPath(); sp3dCtx.arc(star.px, star.py, 12*star.scale, 0, Math.PI*2); sp3dCtx.stroke();
        } else {
            sp3dCtx.shadowBlur = 0;
        }
        sp3dCtx.fill();
        sp3dCtx.globalAlpha = 1; sp3dCtx.shadowBlur = 0;
    });

    // 3. Рисуем Маршрут
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

    // 4. Отрисовка волны сканера (визуальное кольцо)
    if (scan3DState.active) {
        scan3DState.radius += 12;
        
        // Рисуем простое кольцо 2D, которое растет (как интерфейс HUD)
        sp3dCtx.beginPath();
        sp3dCtx.strokeStyle = 'rgba(0, 229, 255, 0.5)';
        sp3dCtx.lineWidth = 2;
        // Проецируем радиус примерно по центру (упрощение)
        const screenRad = scan3DState.radius * (FOCAL_LENGTH / (FOCAL_LENGTH + 0)); 
        sp3dCtx.arc(cx, cy, screenRad, 0, Math.PI*2);
        sp3dCtx.stroke();

        if (scan3DState.radius > scan3DState.maxRadius) {
            scan3DState.active = false; scan3DState.scanned = true;
            btnScanAction.style.display = 'none';
        }
    }

    // 5. Текст интерфейса (HUD внутри канваса)
    sp3dCtx.font = "12px Share Tech Mono";
    sp3dCtx.fillStyle = "#00e5ff";
    sp3dCtx.fillText("СТАТУС СИСТЕМЫ: ОНЛАЙН", 20, sp3dCanvas.height - 40);
    
    if (scan3DState.selectedNode) {
        sp3dCtx.fillStyle = "#fff";
        const jumps = scan3DState.route.length - 1;
        sp3dCtx.fillText(`ЦЕЛЬ: ${scan3DState.selectedNode.type.toUpperCase()}`, 20, sp3dCanvas.height - 25);
        if (jumps > 0) sp3dCtx.fillText(`РАССТОЯНИЕ: ${jumps} ПРЫЖКОВ`, 20, sp3dCanvas.height - 10);
        else sp3dCtx.fillText(`МАРШРУТ НЕ НАЙДЕН`, 20, sp3dCanvas.height - 10);
    } else {
        sp3dCtx.fillStyle = "#555";
        sp3dCtx.fillText("ЦЕЛЬ НЕ ВЫБРАНА", 20, sp3dCanvas.height - 25);
    }
}

function perform3DScan() {
    if (scan3DState.active || scan3DState.scanned) return;
    scan3DState.active = true;
}

function checkClick(mx, my) {
    if (!scan3DState.scanned) return;

    let closest = null;
    let minDist = 20; 

    stars3D.forEach(star => {
        if (star.isPlayer) return;
        // Можно кликать только по проявленным объектам (не серым)
        if (star.type === 'empty' || star.type === 'unknown') return; 

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
        btnEngage3D.style.display = 'inline-block';
    } else {
        btnEngage3D.style.display = 'none';
    }
}

function engage3DRoute() {
    if (!scan3DState.selectedNode || scan3DState.route.length === 0) return;
    
    toggleSpectrum(false);
    
    const jumps = scan3DState.route.length - 1;
    // Безопасный запуск: если мы не в карте, space.js переключит нас
    startAutoJumpSequence(jumps, scan3DState.selectedNode.type);
}