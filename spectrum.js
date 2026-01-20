const spectrumUI = document.getElementById('spectrumUI');
const spCanvas = document.getElementById('spectrumCanvas');
const spCtx = spCanvas.getContext('2d');
const spStatus = document.getElementById('spStatus');
const btnScan = document.getElementById('btnScan');

// Локальные переменные анимации (не требуют сохранения)
let spStars = [];
let scanProgress = 0;
let spTime = 0;
let lockAnimFrame = 0;
let spInternalState = 'IDLE'; // IDLE, SCANNING, RESULTS

function initSpectrum() {
    spCanvas.width = 798;
    spCanvas.height = 480;
    
    // Фон UI
    spStars = [];
    for(let i=0; i<400; i++) {
        spStars.push({
            x: Math.random() * spCanvas.width,
            y: Math.random() * spCanvas.height,
            size: Math.random() * 1.5,
            alpha: Math.random() * 0.5 + 0.1
        });
    }

    spCanvas.addEventListener('mousedown', (e) => {
        // Разрешаем кликать, если сканирование завершено (даже если уже есть Lock)
        if (spInternalState === 'RESULTS' || spectrumState.hasScanned) {
            const rect = spCanvas.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;
            checkSignalClick(cx, cy);
        }
    });
}

function toggleSpectrum(state) {
    isSpectrumOpen = state;
    spectrumUI.style.display = state ? 'flex' : 'none';
    
    if(state) {
        inputs.up = false; inputs.down = false; inputs.left = false; inputs.right = false;

        // ПРОВЕРКА СОХРАНЕНИЯ
        if (spectrumState.hasScanned) {
            // Восстанавливаем состояние
            spInternalState = 'RESULTS';
            btnScan.style.display = 'none'; // Скрываем кнопку, скан уже есть
            
            if (spectrumState.lockedIndex !== -1) {
                const s = spectrumState.signals[spectrumState.lockedIndex];
                spStatus.innerHTML = `STATUS: TARGET LOCKED [${s.type.toUpperCase()}] <br> JUMP COST: ${s.cost} SC`;
                spStatus.style.color = "#00e676";
            } else {
                spStatus.innerText = "STATUS: SECTOR SCANNED. SELECT TARGET.";
                spStatus.style.color = "#00e5ff";
            }
        } else {
            // Новое чистое состояние
            spInternalState = 'IDLE';
            scanProgress = 0;
            btnScan.style.display = 'block';
            btnScan.disabled = false;
            btnScan.innerText = "INITIATE SCAN";
            spStatus.innerText = "STATUS: STANDBY";
            spStatus.style.color = "#888";
        }
    }
}

function startScanner() {
    if (spInternalState !== 'IDLE') return;
    spInternalState = 'SCANNING';
    scanProgress = 0;
    spectrumState.signals = [];
    spectrumState.lockedIndex = -1;
    
    btnScan.disabled = true;
    btnScan.innerText = "SCANNING...";
    spStatus.innerText = "STATUS: SCANNING SECTOR...";
    spStatus.style.color = "#00e5ff";

    // Генерация сигналов
    const count = Math.floor(Math.random() * 3) + 2; 
    for(let i=0; i<count; i++) {
        const isSystem = Math.random() > 0.6;
        spectrumState.signals.push({
            x: Math.random() * (spCanvas.width - 100) + 50,
            y: Math.random() * (spCanvas.height - 100) + 50,
            type: isSystem ? 'system' : 'station',
            cost: isSystem ? 0.001 : 0.0001,
            revealed: false
        });
    }
}

function checkSignalClick(mx, my) {
    for(let i=0; i<spectrumState.signals.length; i++) {
        const s = spectrumState.signals[i];
        if (!s.revealed) continue; // Нельзя кликнуть то, что еще не просканировано
        
        const dist = Math.hypot(mx - s.x, my - s.y);
        if (dist < 30) {
            // ЗАПОМИНАЕМ В ГЛОБАЛЬНОЕ СОСТОЯНИЕ
            spectrumState.lockedIndex = i;
            lockAnimFrame = 0;
            
            nextJumpTarget = s.type;
            pendingJumpCost = s.cost;

            spStatus.innerHTML = `STATUS: TARGET LOCKED [${s.type.toUpperCase()}] <br> JUMP COST: ${s.cost} SC (PAY ON JUMP)`;
            spStatus.style.color = "#00e676";
            return;
        }
    }
}

function updateSpectrum() {
    if (!isSpectrumOpen) return;
    spTime += 0.05;

    // Очистка
    spCtx.fillStyle = '#020205';
    spCtx.fillRect(0, 0, spCanvas.width, spCanvas.height);

    // Сетка
    spCtx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    spCtx.lineWidth = 1;
    for(let x=0; x<spCanvas.width; x+=40) { spCtx.beginPath(); spCtx.moveTo(x,0); spCtx.lineTo(x, spCanvas.height); spCtx.stroke(); }
    for(let y=0; y<spCanvas.height; y+=40) { spCtx.beginPath(); spCtx.moveTo(0,y); spCtx.lineTo(spCanvas.width,y); spCtx.stroke(); }

    // Звезды
    spCtx.fillStyle = '#fff';
    spStars.forEach(s => {
        spCtx.globalAlpha = Math.max(0, Math.sin(spTime + s.x) * 0.2 + s.alpha);
        spCtx.beginPath(); spCtx.arc(s.x, s.y, s.size, 0, Math.PI*2); spCtx.fill();
    });
    spCtx.globalAlpha = 1;

    // ЛОГИКА СКАНИРОВАНИЯ
    if (spInternalState === 'SCANNING') {
        scanProgress += 5; // Быстрее
        
        spCtx.strokeStyle = '#7c4dff';
        spCtx.lineWidth = 2;
        spCtx.shadowBlur = 10; spCtx.shadowColor = '#7c4dff';
        spCtx.beginPath(); spCtx.moveTo(0, scanProgress); spCtx.lineTo(spCanvas.width, scanProgress); spCtx.stroke();
        spCtx.shadowBlur = 0;

        spectrumState.signals.forEach(s => {
            if (!s.revealed && s.y < scanProgress) s.revealed = true;
        });

        if (scanProgress > spCanvas.height) {
            spInternalState = 'RESULTS';
            spectrumState.hasScanned = true; // ЗАПОМИНАЕМ, ЧТО СКАН БЫЛ
            btnScan.style.display = 'none'; // Убираем кнопку совсем
            spStatus.innerText = "STATUS: SCAN COMPLETE. SELECT TARGET.";
        }
    }

    // ОТРИСОВКА СИГНАЛОВ
    spectrumState.signals.forEach((s, index) => {
        // Если скан уже был в прошлом (сохранен), показываем всё сразу
        if (spectrumState.hasScanned) s.revealed = true; 
        if (!s.revealed) return;

        const isLocked = (index === spectrumState.lockedIndex);
        const color = s.type === 'system' ? '#ffab00' : '#00e5ff';
        
        // Точка
        spCtx.fillStyle = color;
        spCtx.shadowBlur = 10; spCtx.shadowColor = color;
        spCtx.beginPath(); spCtx.arc(s.x, s.y, 4, 0, Math.PI*2); spCtx.fill();
        spCtx.shadowBlur = 0;

        // Кольца
        spCtx.strokeStyle = color;
        spCtx.lineWidth = 1;
        const pulse = (Math.sin(spTime * 3) + 1) / 2;
        spCtx.beginPath(); spCtx.arc(s.x, s.y, 10 + pulse * 5, 0, Math.PI*2); spCtx.stroke();

        spCtx.fillStyle = color;
        spCtx.font = "10px Orbitron";
        spCtx.fillText(s.type.toUpperCase(), s.x + 15, s.y - 5);

        // LOCK UI
        if (isLocked) {
            lockAnimFrame += 0.5;
            const size = Math.max(15, 50 - lockAnimFrame * 2);
            
            spCtx.strokeStyle = '#00e676';
            spCtx.lineWidth = 2;
            spCtx.shadowBlur = 10; spCtx.shadowColor = '#00e676';
            
            spCtx.beginPath();
            spCtx.strokeRect(s.x - size, s.y - size, size*2, size*2); // Простой квадрат прицела
            spCtx.stroke();
            spCtx.shadowBlur = 0;

            spCtx.fillStyle = '#00e676';
            spCtx.font = "bold 12px Orbitron";
            spCtx.textAlign = "center";
            spCtx.fillText("LOCKED", s.x, s.y + 40);
            spCtx.textAlign = "left";
        }
    });
}