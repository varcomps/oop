/* story_manager.js - Warp Interaction System (No Wobble, Choices Included) */

class StoryManagerClass {
    constructor() {
        this.state = {
            active: false,
            currentEvent: null, // Текущий объект события
            npcs: [],
            dialogueQueue: [],
            dialogueIndex: 0,
            dialogueTimer: 0,
            
            waitingForChoice: false, // Ждем ли выбора игрока
            choiceCallback: null,    // Что делать после выбора
            
            // Персистентные данные (сохраняются в saveGame)
            completedEvents: [],     // ID завершенных событий
            activeQuests: []         // Квесты, которые взяты, но не сданы (ожидание ресурсов)
        };

        // Слушатель кликов для выборов
        canvas.addEventListener('mousedown', (e) => this.handleClick(e));
        // Для тач-устройств
        canvas.addEventListener('touchstart', (e) => this.handleClick(e));
    }

    isActive() {
        return this.state.active;
    }

    // --- MAIN UPDATE LOOP ---
    update() {
        if (!this.state.active) return;

        // 1. Анимация NPC (БЕЗ ПОКАЧИВАНИЯ)
        this.state.npcs.forEach(npc => {
            if (npc.phase === 'enter') {
                npc.t += 0.02; // Плавное появление
                if (npc.t > 1) npc.t = 1;
                
                const ease = 1 - Math.pow(1 - npc.t, 3);
                npc.x = npc.startX + (npc.targetX - npc.startX) * ease;
                npc.y = npc.startY + (npc.targetY - npc.startY) * ease;
                
                if (npc.t >= 1) npc.phase = 'idle';
            } 
            else if (npc.phase === 'idle') {
                // НИКАКОГО ДВИЖЕНИЯ. Абсолютная статика относительно камеры варпа.
                npc.x = npc.targetX;
                npc.y = npc.targetY;
            }
            else if (npc.phase === 'leave') {
                npc.t += 0.02;
                const ease = Math.pow(npc.t, 3);
                
                // Улетаем вперед по ходу движения варпа (имитация отставания или ускорения)
                npc.x = npc.targetX - (Math.cos(npc.angle) * 2000 * ease); 
                npc.y = npc.targetY - (Math.sin(npc.angle) * 2000 * ease);

                if (npc.t > 1.2) this.endScene();
            }
        });

        // 2. Логика диалога
        // Если ждем выбора игрока - таймер диалога не идет
        if (!this.state.waitingForChoice && this.state.npcs.some(n => n.phase === 'idle')) {
            // Если очередь диалогов пуста, заканчиваем
            if (this.state.dialogueIndex >= this.state.dialogueQueue.length) {
                // Если есть выбор в конце - активируем его, иначе улетаем
                if (this.state.currentEvent.choice && !this.state.choiceShown) {
                    this.state.waitingForChoice = true;
                    this.state.choiceShown = true;
                } else {
                    this.finishDialogue();
                }
                return;
            }

            this.state.dialogueTimer++;
            const currentLine = this.state.dialogueQueue[this.state.dialogueIndex];
            
            // Читаем скорость текста или дефолт
            const speed = 4; 
            const duration = Math.max(100, (currentLine.text.length * speed));

            if (this.state.dialogueTimer > duration) {
                this.state.dialogueTimer = 0;
                this.state.dialogueIndex++;
            }
        }
    }

    // --- RENDERING ---
    draw(ctx) {
        if (!this.state.active) return;

        this.state.npcs.forEach(npc => {
            // Отрисовка корабля
            ctx.save();
            ctx.translate(npc.x, npc.y);
            ctx.rotate(npc.angle); // Поворот фиксированный

            // Тень и цвет
            ctx.shadowBlur = 15; 
            ctx.shadowColor = npc.color;
            ctx.fillStyle = npc.color;

            // Модель корабля
            ctx.beginPath();
            ctx.moveTo(15, 0);
            ctx.lineTo(-10, 8);
            ctx.lineTo(-5, 0);
            ctx.lineTo(-10, -8);
            ctx.fill();
            
            ctx.shadowBlur = 0;
            ctx.restore();

            // Имя и Диалог
            if (npc.phase === 'idle') {
                // Имя
                ctx.fillStyle = "rgba(255,255,255,0.6)";
                ctx.font = "12px Orbitron"; // Или monospace
                ctx.textAlign = "center";
                ctx.fillText(npc.name, npc.x, npc.y - 30);

                // Баббл с текстом
                const currentLine = this.state.dialogueQueue[this.state.dialogueIndex];
                if (currentLine && currentLine.name === npc.name && !this.state.waitingForChoice) {
                    this.drawBubble(ctx, npc.x, npc.y - 55, currentLine.text, npc.color);
                }
                
                // РИСУЕМ ВЫБОР (если ждем)
                if (this.state.waitingForChoice && this.state.dialogueIndex >= this.state.dialogueQueue.length) {
                    this.drawChoices(ctx, npc.x, npc.y + 40);
                }
            }
        });
    }

    drawBubble(ctx, x, y, text, color) {
        ctx.font = "bold 16px monospace";
        const m = ctx.measureText(text);
        const w = m.width + 30;
        const h = 40;

        ctx.fillStyle = "rgba(10, 10, 20, 0.9)";
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.roundRect(x - w/2, y - h/2, w, h, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, x, y);
    }

    drawChoices(ctx, x, y) {
        // Кнопка "Принять" (Галочка)
        this.btnYes = { x: x - 40, y: y, r: 25 };
        ctx.beginPath();
        ctx.arc(this.btnYes.x, this.btnYes.y, this.btnYes.r, 0, Math.PI*2);
        ctx.fillStyle = "rgba(0, 200, 83, 0.2)";
        ctx.fill();
        ctx.strokeStyle = "#00e676";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#00e676";
        ctx.font = "bold 24px monospace";
        ctx.fillText("✓", this.btnYes.x, this.btnYes.y + 2);

        // Кнопка "Отказать" (Крестик)
        this.btnNo = { x: x + 40, y: y, r: 25 };
        ctx.beginPath();
        ctx.arc(this.btnNo.x, this.btnNo.y, this.btnNo.r, 0, Math.PI*2);
        ctx.fillStyle = "rgba(213, 0, 0, 0.2)";
        ctx.fill();
        ctx.strokeStyle = "#ff1744";
        ctx.stroke();
        ctx.fillStyle = "#ff1744";
        ctx.fillText("✕", this.btnNo.x, this.btnNo.y + 2);

        // Текст выбора (подсказка)
        const choiceData = this.state.currentEvent.choice;
        if(choiceData) {
            ctx.font = "12px monospace";
            ctx.fillStyle = "#aaa";
            ctx.fillText(choiceData.yesText || "ПРИНЯТЬ", this.btnYes.x, this.btnYes.y + 40);
            ctx.fillText(choiceData.noText || "ОТКАЗ", this.btnNo.x, this.btnNo.y + 40);
        }
    }

    handleClick(e) {
        if (!this.state.waitingForChoice || !this.btnYes || !this.btnNo) return;

        const rect = canvas.getBoundingClientRect();
        // Поддержка и мыши, и тача
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const mx = clientX - rect.left;
        const my = clientY - rect.top;

        // Проверка дистанции до кнопок
        const distYes = Math.hypot(mx - this.btnYes.x, my - this.btnYes.y);
        const distNo = Math.hypot(mx - this.btnNo.x, my - this.btnNo.y);

        if (distYes < this.btnYes.r) {
            this.resolveChoice(true);
        } else if (distNo < this.btnNo.r) {
            this.resolveChoice(false);
        }
    }

    // --- LOGIC ---

    checkTrigger(inWarp) {
        if (!inWarp || this.state.active) return;

        // 1. Сначала проверяем активные квесты (Ожидание ресурсов)
        // Проходимся по списку взятых квестов
        for (let i = 0; i < this.state.activeQuests.length; i++) {
            const questId = this.state.activeQuests[i];
            const questDef = STORY_EVENTS.find(e => e.id === questId);
            
            if (questDef && questDef.requirements) {
                // Шанс появления NPC для проверки (например 30% каждый прыжок)
                // Или если это первый прыжок после взятия
                if (Math.random() > 0.3) continue; 

                // Проверяем ресурсы
                if (this.checkRequirements(questDef.requirements)) {
                    // УРА! Ресурсы есть. Запускаем сцену сдачи.
                    this.startScene(questDef, 'success');
                    return;
                } else {
                    // Ресурсов нет. Запускаем сцену напоминания (если есть)
                    if (questDef.dialogue_reminder) {
                        this.startScene(questDef, 'reminder');
                        return;
                    }
                }
            }
        }

        // 2. Если квестов нет, ищем новые события
        // Просто берем случайное событие, которое еще не выполнено
        const availableEvents = STORY_EVENTS.filter(e => 
            !this.state.completedEvents.includes(e.id) && 
            !this.state.activeQuests.includes(e.id) &&
            (e.chance ? Math.random() < e.chance : true)
        );

        if (availableEvents.length > 0) {
            // Берем первое попавшееся или рандом
            const evt = availableEvents[Math.floor(Math.random() * availableEvents.length)];
            this.startScene(evt, 'intro');
        }
    }

    startScene(eventData, type) {
        console.log(`STORY: Starting ${eventData.id} [${type}]`);
        this.state.active = true;
        this.state.currentEvent = eventData;
        this.state.waitingForChoice = false;
        this.state.choiceShown = false;
        this.state.dialogueIndex = 0;
        this.state.dialogueTimer = 0;
        
        // Определяем какой диалог показывать
        let lines = [];
        if (type === 'intro') lines = eventData.dialogue_intro;
        else if (type === 'success') lines = eventData.dialogue_success;
        else if (type === 'reminder') lines = eventData.dialogue_reminder;
        else lines = [{ name: "Sys", text: "Ошибка диалога" }];

        this.state.dialogueQueue = lines;
        this.state.sceneType = type; // Запоминаем тип сцены для логики завершения

        // Спавним NPC
        this.state.npcs = [];
        const npcDef = eventData.npc;
        
        // NPC летит параллельно нам
        // Спавним его немного впереди и сбоку
        const startX = canvas.width + 200;
        const targetX = canvas.width / 2 + 150;
        const y = canvas.height / 2;

        this.state.npcs.push({
            name: npcDef.name,
            color: npcDef.color,
            x: startX, 
            y: y,
            startX: startX, 
            startY: y,
            targetX: targetX,
            targetY: y,
            angle: Math.PI, // Смотрит влево (вместе с нами, если мы летим вправо, или наоборот)
            phase: 'enter',
            t: 0
        });
    }

    resolveChoice(accepted) {
        this.state.waitingForChoice = false;
        const evt = this.state.currentEvent;

        if (accepted) {
            // Игрок согласился
            if (evt.choice.onAccept === "start_quest") {
                if (!this.state.activeQuests.includes(evt.id)) {
                    this.state.activeQuests.push(evt.id);
                }
                // Можно добавить реплику "Отлично, жду!"
                this.state.dialogueQueue.push({ name: evt.npc.name, text: evt.choice.acceptReply || "Договорились." });
            } 
            else if (evt.choice.onAccept === "give_reward") {
                // Сразу награда (если квест без сбора)
                player.credits += (evt.reward || 0);
                this.state.completedEvents.push(evt.id);
                this.state.dialogueQueue.push({ name: evt.npc.name, text: "Спасибо! Держи кредиты." });
            }
        } else {
            // Игрок отказался
            this.state.completedEvents.push(evt.id); // Помечаем как пройденный, чтобы не долбал
            this.state.dialogueQueue.push({ name: evt.npc.name, text: evt.choice.rejectReply || "Как знаешь..." });
        }
        
        // Сбрасываем индекс, чтобы показать добавленную реплику
        // this.state.dialogueIndex уже указывает на конец, добавим реплику в конец массива
        // и позволим update() показать её.
    }

    finishDialogue() {
        // Логика завершения сцены
        if (this.state.sceneType === 'success') {
            // Мы только что сдали квест
            const evt = this.state.currentEvent;
            
            // Забираем предметы
            this.consumeRequirements(evt.requirements);
            
            // Даем награду
            player.credits += (evt.reward || 0);
            if(window.updateCurrencyUI) window.updateCurrencyUI();
            
            // Удаляем из активных, добавляем в завершенные
            this.state.activeQuests = this.state.activeQuests.filter(id => id !== evt.id);
            this.state.completedEvents.push(evt.id);
        }

        this.state.npcs.forEach(n => n.phase = 'leave');
        
        if (window.saveGameData) window.saveGameData();
    }

    endScene() {
        this.state.active = false;
        this.state.currentEvent = null;
        this.state.npcs = [];
    }

    // --- UTILS ---
    checkRequirements(reqs) {
        if (!reqs || !window.placedStorageItems) return true;
        
        for (let r of reqs) {
            const count = window.placedStorageItems.filter(i => i.type === 'cargo' && i.commodityId === r.id).length;
            if (count < r.count) return false;
        }
        return true;
    }

    consumeRequirements(reqs) {
        if (!reqs || !window.placedStorageItems) return;
        
        reqs.forEach(r => {
            let needed = r.count;
            for (let i = window.placedStorageItems.length - 1; i >= 0; i--) {
                if (needed <= 0) break;
                const item = window.placedStorageItems[i];
                if (item.type === 'cargo' && item.commodityId === r.id) {
                    window.placedStorageItems.splice(i, 1);
                    needed--;
                }
            }
        });
        if (window.renderStorageGrid) window.renderStorageGrid();
    }
    
    // SAVE/LOAD SYSTEM
    getSaveData() {
        return {
            completed: this.state.completedEvents,
            active: this.state.activeQuests
        };
    }
    
    loadSaveData(data) {
        if (!data) return;
        this.state.completedEvents = data.completed || [];
        this.state.activeQuests = data.active || [];
    }
}

window.StoryManager = new StoryManagerClass();

// HOOKS
const _oldDrawMap = window.drawMap;
window.drawMap = function() {
    if (_oldDrawMap) _oldDrawMap();
    if (window.StoryManager) window.StoryManager.draw(ctx);
};

const _oldUpdate = window.update;
window.update = function() {
    if (_oldUpdate) _oldUpdate();
    if (window.StoryManager) window.StoryManager.update();
};