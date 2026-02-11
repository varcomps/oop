/* story_manager.js - Universal Story Engine */

class StoryManagerClass {
    constructor() {
        this.state = {
            currentStageId: 0,
            jumpsSinceStage: 0,
            active: false,        // Идет ли сейчас сцена
            npcs: [],             // Активные NPC на экране
            dialogueQueue: [],    // Очередь реплик
            dialogueTimer: 0,
            dialogueIndex: 0,
            stageCompleted: false, // Флаг, что текущий этап завершен (диалог прошел)
            forceCondition: false  // Чит для админки
        };

        this.MARGIN = 150; // Отступ спавна от краев
    }

    // --- MAIN LOOP HOOKS ---
    update() {
        if (!this.state.active) return;

        // 1. Анимация NPC (подлет к точке)
        this.state.npcs.forEach(npc => {
            if (npc.phase === 'enter') {
                npc.t += 0.02;
                if (npc.t >= 1) { npc.t = 1; npc.phase = 'idle'; }
                
                // Easing (Smooth step)
                const ease = npc.t * npc.t * (3 - 2 * npc.t);
                npc.x = npc.startX + (npc.targetX - npc.startX) * ease;
                npc.y = npc.startY + (npc.targetY - npc.startY) * ease;
            } 
            else if (npc.phase === 'idle') {
                // Легкое покачивание
                npc.y += Math.sin(Date.now() / 500) * 0.5;
            }
            else if (npc.phase === 'leave') {
                npc.t += 0.02;
                npc.x += Math.cos(npc.leaveAngle) * 10;
                npc.y += Math.sin(npc.leaveAngle) * 10;
                if (npc.t > 2) this.endScene();
            }
        });

        // 2. Обработка диалогов
        if (this.state.dialogueQueue.length > 0 && this.state.npcs.some(n => n.phase === 'idle')) {
            this.state.dialogueTimer++;
            // Время показа реплики (зависит от длины текста)
            const currentLine = this.state.dialogueQueue[this.state.dialogueIndex];
            const duration = Math.max(120, currentLine.text.length * 5);

            if (this.state.dialogueTimer > duration) {
                this.state.dialogueTimer = 0;
                this.state.dialogueIndex++;
                
                // Конец диалога
                if (this.state.dialogueIndex >= this.state.dialogueQueue.length) {
                    this.finishDialogue();
                }
            }
        }
    }

    draw(ctx) {
        if (!this.state.active) return;

        // Рисуем NPC
        this.state.npcs.forEach(npc => {
            ctx.save();
            ctx.translate(npc.x, npc.y);
            
            // Поворот к центру экрана при появлении
            if (npc.phase === 'enter' || npc.phase === 'idle') {
                const angle = Math.atan2((canvas.height/2) - npc.y, (canvas.width/2) - npc.x);
                ctx.rotate(angle);
            } else {
                ctx.rotate(npc.leaveAngle);
            }

            // Корабль (простая модель)
            ctx.fillStyle = npc.color;
            ctx.shadowBlur = 15; ctx.shadowColor = npc.color;
            ctx.beginPath();
            ctx.moveTo(15, 0); ctx.lineTo(-10, 10); ctx.lineTo(-5, 0); ctx.lineTo(-10, -10);
            ctx.fill();
            
            // Никнейм
            ctx.restore(); // Сброс поворота для текста
            ctx.fillStyle = "rgba(255,255,255,0.8)";
            ctx.font = "10px Orbitron";
            ctx.textAlign = "center";
            ctx.shadowBlur = 0;
            ctx.fillText(npc.name, npc.x, npc.y - 25);
            
            // Баббл диалога
            const currentLine = this.state.dialogueQueue[this.state.dialogueIndex];
            if (currentLine && currentLine.name === npc.name && npc.phase === 'idle') {
                this.drawBubble(ctx, npc.x, npc.y - 45, currentLine.text, npc.color);
            }
        });
    }

    drawBubble(ctx, x, y, text, color) {
        ctx.font = "bold 14px monospace";
        const m = ctx.measureText(text);
        const w = m.width + 20;
        const h = 30;

        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.roundRect(x - w/2, y - h, w, h, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, x, y - h/2);
    }

    // --- LOGIC ---

    onJump() {
        this.state.jumpsSinceStage++;
        this.checkTrigger();
    }

    checkTrigger() {
        const stageCfg = STORY_STAGES.find(s => s.id === this.state.currentStageId);
        if (!stageCfg) return;

        // Проверяем, набрали ли нужное кол-во прыжков
        if (this.state.jumpsSinceStage >= stageCfg.waitJumps) {
            // Запускаем сцену ТОЛЬКО если находимся в Deep Space или System (не на станции)
            // И если сцена еще не активна
            if (!this.state.active && !isDocked) {
                // Небольшая задержка, чтобы игрок вышел из варпа
                setTimeout(() => this.startScene(stageCfg), 2000);
            }
        }
    }

    startScene(cfg) {
        console.log("STORY: Starting Scene ID", cfg.id);
        this.state.active = true;
        this.state.npcs = [];
        this.state.dialogueIndex = 0;
        this.state.dialogueTimer = 0;
        this.state.stageCompleted = false;

        // 1. Спавн NPC
        if (cfg.npcs) {
            cfg.npcs.forEach((npcDef, index) => {
                this.spawnNPC(npcDef, index, cfg.npcs.length);
            });
        }

        // 2. Определение диалога (Условие предметов)
        let finalDialogue = [];
        let isSuccess = true;

        if (cfg.reqItems) {
            // Проверка предметов
            const hasItems = this.checkItems(cfg.reqItems);
            
            if (hasItems || this.state.forceCondition) {
                this.state.forceCondition = false; // Сброс чита
                finalDialogue = cfg.dialogue.success || [];
                // Удаляем предметы
                this.removeItems(cfg.reqItems);
                // Награда
                if (cfg.reward) {
                    player.credits += cfg.reward;
                    if(window.updateCurrencyUI) window.updateCurrencyUI();
                }
                this.state.stageCompleted = true; // Успех, идем дальше
            } else {
                finalDialogue = cfg.dialogue.fail || [];
                this.state.stageCompleted = false; // Провал, этап не меняем
            }
        } else {
            // Обычный диалог без условий
            finalDialogue = Array.isArray(cfg.dialogue) ? cfg.dialogue : [];
            this.state.stageCompleted = true;
        }

        this.state.dialogueQueue = finalDialogue;
    }

    spawnNPC(def, index, total) {
        const side = def.startSide === 'random' ? ['top','bottom','left','right'][Math.floor(Math.random()*4)] : def.startSide;
        
        let startX, startY, targetX, targetY;
        const w = canvas.width;
        const h = canvas.height;
        const offset = 150 * (index - (total-1)/2); // Чтобы не накладывались

        // Целевая позиция (с отступами от краев)
        const safeMargin = 200;
        targetX = (w/2) + Math.cos(index) * 100 + offset; // Немного разбросать
        targetY = (h/2) + Math.sin(index) * 100;

        // Стартовая позиция (за экраном)
        if (side === 'left') { startX = -100; startY = targetY; }
        else if (side === 'right') { startX = w + 100; startY = targetY; }
        else if (side === 'top') { startX = targetX; startY = -100; }
        else { startX = targetX; startY = h + 100; }

        this.state.npcs.push({
            name: def.name,
            color: def.color,
            x: startX, y: startY,
            startX: startX, startY: startY,
            targetX: targetX, targetY: targetY,
            t: 0,
            phase: 'enter',
            leaveAngle: Math.random() * 6.28
        });
    }

    finishDialogue() {
        // Все NPC улетают
        this.state.npcs.forEach(n => {
            n.phase = 'leave';
            n.t = 0;
            n.leaveAngle = Math.atan2(n.y - (canvas.height/2), n.x - (canvas.width/2));
        });
    }

    endScene() {
        this.state.active = false;
        this.state.npcs = [];
        
        if (this.state.stageCompleted) {
            this.state.currentStageId++;
            this.state.jumpsSinceStage = 0;
            console.log("STORY: Stage Complete. Next Stage:", this.state.currentStageId);
        } else {
            console.log("STORY: Condition failed. Staying on Stage:", this.state.currentStageId);
            // Сбрасываем счетчик прыжков, чтобы дать время собрать ресы перед повтором
            this.state.jumpsSinceStage = 0; 
        }

        if (window.saveGameData) window.saveGameData();
    }

    // --- UTILS ---
    checkItems(reqList) {
        if (!window.placedStorageItems) return false;
        for (let req of reqList) {
            const count = window.placedStorageItems.filter(i => i.type === 'cargo' && i.commodityId === req.id).length;
            if (count < req.count) return false;
        }
        return true;
    }

    removeItems(reqList) {
        if (!window.placedStorageItems) return;
        reqList.forEach(req => {
            let leftToRemove = req.count;
            for (let i = window.placedStorageItems.length - 1; i >= 0; i--) {
                if (leftToRemove <= 0) break;
                const item = window.placedStorageItems[i];
                if (item.type === 'cargo' && item.commodityId === req.id) {
                    window.placedStorageItems.splice(i, 1);
                    leftToRemove--;
                }
            }
        });
        if (window.renderStorageGrid) window.renderStorageGrid();
    }
    
    // --- ADMIN API ---
    forceCompleteCondition() {
        this.state.forceCondition = true;
        console.log("STORY: Condition Forced for next check.");
    }
    
    setStage(id) {
        this.state.currentStageId = parseInt(id);
        this.state.jumpsSinceStage = 999; // Чтобы сразу триггернуть
        this.state.active = false;
        console.log("STORY: Set Stage to", id);
    }
}

// Инициализация
window.StoryManager = new StoryManagerClass();

// Хуки в основной цикл (чтобы не лезть в main.js)
const _oldUpdate = window.update;
window.update = function() {
    if (_oldUpdate) _oldUpdate();
    if (window.StoryManager) window.StoryManager.update();
};

const _oldDrawMap = window.drawMap;
window.drawMap = function() {
    if (_oldDrawMap) _oldDrawMap();
    if (window.StoryManager) window.StoryManager.draw(ctx);
};

// Хук на варп (для подсчета прыжков)
const _oldWarpExit = window.handleWarpLeave; // Или куда лучше вставить? В initWarpScene?
// Лучше перехватить resetStarSystem или момент выхода из варпа в space_core.js
// Но чтобы не менять space_core, сделаем "наблюдателя"
let _lastWarpState = false;
setInterval(() => {
    if (typeof isWarping !== 'undefined') {
        if (_lastWarpState && !isWarping) {
            // Вышли из варпа
            window.StoryManager.onJump();
        }
        _lastWarpState = isWarping;
    }
}, 500);