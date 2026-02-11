/* story_core.js - FINAL VISUAL & LOGIC FIX
   - Engineer: Exact ship model as Red NPC, but Blue.
   - Animation: Engineer uses exact same Warp Stretch/Ease mechanics.
   - Logic: Instant "Infinite Warp" scene upon arriving at Black Hole with Map.
*/

(function() {
    // --- CONFIGURATION ---
    const STORY_CFG = {
        TRIGGER_JUMP: 4,         
        SPAWN_DIST: 600,         
        INTERACT_DIST: 150,      
        CUBE_SIZE: 30,           
        MARGIN: 100,
        
        WAIT_FOR_REQUEST: 2,     
        WAIT_FOR_DRONES: 4,      
        WAIT_FOR_MAP_MONEY: 1,   
        WAIT_FOR_MAP_INFO: 1     
    };

    const QUEST_REQ = {
        optics: { id: 'c20', count: 2 },
        batteries: { id: 'c23', count: 2 },
        drones: { id: 'c25', count: 2 },
        starmap: { id: 'c50', count: 1 }
    };

    // --- DIALOGUE SYSTEM ---
    function getDialogLines(type) {
        switch(type) {
            case 'MEETING_1': return [
                {s:'red', t:"привет... я тут мимо пролетал..."},
                {s:'red', t:"похоже ты тоже его видел"},
                {s:'red', t:"знаешь что-то? нет?"},
                {s:'red', t:"понял ладно я посмотрю что можно узнать"}
            ];
            case 'REQUEST_1': return [
                {s:'red', t:"привет... это снова я..."},
                {s:'red', t:"я кое-что разузнал но..."},
                {s:'red', t:"нам понадобятся ресурсы"},
                {s:'red', t:"можешь привезти 2 оптики и 2 батареи?"},
                {s:'red', t:"если согласен - встретимся у планетной системы"}
            ];
            case 'CHECK_1_FAIL': return [
                {s:'red', t:"ну как идет поиск вещей?"},
                {s:'red', t:"..."},
                {s:'red', t:"у меня пока тоже ничего нового"},
                {s:'red', t:"нужно 2 оптики и 2 батареи, жду на складе"}
            ];
            case 'CHECK_1_OK': return [
                {s:'red', t:"о класс похоже ты всё достал!"},
                {s:'red', t:"супер я как раз нашел кое-кого"},
                {s:'red', t:"думаю он нам поможет"},
                {s:'red', t:"забираю груз и улетаю..."}
            ];
            case 'REQ_DRONES': return [
                {s:'red', t:"привет!"},
                {s:'red', t:"у меня отличные новости"},
                {s:'red', t:"я нашел отличного инженера"},
                {s:'red', t:"но он сказал что это потребует много ресов"},
                {s:'red', t:"для начала можешь купить 2 дрона?"},
                {s:'red', t:"в этот раз я заплачу"},
                {s:'red', t:"скидываю тебе 0.02 SC..."},
                {s:'red', t:"удачи как соберешь встретимся у звезды"}
            ];
            case 'CHECK_DRONES_FAIL': return [
                {s:'red', t:"поиски не клеятся?"},
                {s:'red', t:"не страшно с чертежами тоже пока туго"},
                {s:'red', t:"нужны 2 дрона, я буду здесь"}
            ];
            case 'CHECK_DRONES_OK': return [
                {s:'red', t:"супер прототип уже наполовину готов!"},
                {s:'red', t:"это будет настоящая инновация"},
                {s:'red', t:"забираю дронов..."},
                {s:'red', t:"я скоро ещё заскочу"}
            ];
            case 'REQ_MAP_MONEY': return [
                {s:'red', t:"хэй я всё выяснил"},
                {s:'red', t:"для завершения прототипа нам понадобится звёздная карта"},
                {s:'red', t:"штука не дешевая но уверен оно того стоит"},
                {s:'red', t:"на вот держи это к сожалению всё что у меня щас есть"},
                {s:'red', t:"перевожу 0.04 SC..."},
                {s:'red', t:"всё во имя великих свершений!"}
            ];
            case 'REQ_MAP_INFO': return [
                {s:'red', t:"ах да забыл сказать"},
                {s:'red', t:"карты понадобятся для калибровки прототипа"},
                {s:'red', t:"так что встретимся на месте испытаний"},
                {s:'red', t:"как соберешь прилетай к грави-аномалии"},
                {s:'red', t:"там и пройдут тесты"}
            ];
            case 'CHECK_MAP_FAIL': return [
                {s:'red', t:"поторопись тесты уже скоро начнутся"},
                {s:'red', t:"нам нужна звездная карта"}
            ];
            // --- FINAL DIALOGUE (INSTANT START) ---
            case 'POST_TEST_CONVO': return [
                {s:'red', t:"ну как есть данные"},
                {s:'blue', t:"..."},
                {s:'red', t:"..."},
                {s:'red', t:"ну хоть что то"},
                {s:'blue', t:"да подожди ты если хотел бы быстрее"},
                {s:'blue', t:"надо было больше дронов закупить"},
                {s:'red', t:"эй я вобще то на них всё что у меня было потратил"},
                {s:'blue', t:"..."},
                {s:'blue', t:"всё данные получены"},
                {s:'blue', t:"разослал"}, // <--- Waves STOP here, Engineer LEAVES
                {s:'red', t:"всё прошло более менее удачно"},
                {s:'red', t:"загляни в строительный терминал"},
                {s:'red', t:"думаю свой прототип тебе не повредит"} // <--- Red LEAVES
            ];

            default: return [{s:'red', t:"..."}];
        }
    }

    // --- STATE ---
    window.storyState = {
        jumps: 0,
        stage: 0, 
        jumpsAfterEvent: 0,
        cubeEvent: null,
        spawnTimer: 0,
        
        // Main NPC (Red)
        warpScene: {
            active: false,
            phase: 'idle',    
            timer: 0,         
            animT: 0,         
            dialogIndex: 0,
            currentDialogId: '', 
            
            arrivalStartPos: { x: 0, y: 0 }, 
            targetPos: { x: 0, y: 0 },       
            renderPos: { x: 0, y: 0 },
            angle: -0.2,
            stretch: 1,
            questActionPending: false
        },
        
        // Engineer NPC (Blue) - EXACT COPY OF RED STATE
        engineerState: {
            active: false,
            phase: 'idle', 
            animT: 0,
            
            arrivalStartPos: { x: 0, y: 0 },
            targetPos: { x: 0, y: 0 },
            renderPos: { x: 0, y: 0 },
            angle: 0.2, // Mirrored angle
            stretch: 1
        },

        wasWarping: false,
        lastSystemCheck: null,
        testEventActive: false,
        wavesActive: true,      
        postTestMode: false     // Infinite Warp Mode
    };

    // --- HELPERS ---
    function countCargo(id) {
        if (!window.placedStorageItems) return 0;
        return window.placedStorageItems.filter(i => i.type === 'cargo' && i.commodityId === id).length;
    }

    function addCredits(amount) {
        if (typeof player !== 'undefined') {
            player.credits = (parseFloat(player.credits) || 0) + amount;
            if (window.updateCurrencyUI) window.updateCurrencyUI();
        }
    }

    function removeItems(reqId, count) {
        if (!window.placedStorageItems) return;
        let removed = 0;
        for (let i = window.placedStorageItems.length - 1; i >= 0; i--) {
            const item = window.placedStorageItems[i];
            if (item.type === 'cargo' && item.commodityId === reqId && removed < count) {
                window.placedStorageItems.splice(i, 1);
                removed++;
            }
        }
        if (window.renderStorageGrid) window.renderStorageGrid();
    }

    // --- TRIGGER LOGIC ---
    function checkTriggers() {
        if (storyState.stage === 0 && storyState.jumps >= STORY_CFG.TRIGGER_JUMP) storyState.spawnTimer = 60; 
        if (storyState.stage === 2 && storyState.jumpsAfterEvent >= STORY_CFG.WAIT_FOR_REQUEST) storyState.stage = 3; 
        if (storyState.stage === 5 && storyState.jumpsAfterEvent >= STORY_CFG.WAIT_FOR_DRONES) storyState.stage = 6;
        if (storyState.stage === 8 && storyState.jumpsAfterEvent >= STORY_CFG.WAIT_FOR_MAP_MONEY) storyState.stage = 9;
        if (storyState.stage === 10 && storyState.jumpsAfterEvent >= STORY_CFG.WAIT_FOR_MAP_INFO) storyState.stage = 11;
    }

    function createCube() {
        const angle = Math.random() * Math.PI * 2;
        const cvs = document.getElementById('gameCanvas');
        const W = cvs ? cvs.width : 2000;
        const H = cvs ? cvs.height : 2000;
        const shipX = (typeof mapShip !== 'undefined') ? mapShip.x : W/2;
        const shipY = (typeof mapShip !== 'undefined') ? mapShip.y : H/2;
        let tx = shipX + Math.cos(angle) * STORY_CFG.SPAWN_DIST;
        let ty = shipY + Math.sin(angle) * STORY_CFG.SPAWN_DIST;
        if (tx < STORY_CFG.MARGIN) tx = STORY_CFG.MARGIN; if (tx > W-100) tx = W-100;
        if (ty < STORY_CFG.MARGIN) ty = STORY_CFG.MARGIN; if (ty > H-100) ty = H-100;

        storyState.cubeEvent = { active: true, x: tx, y: ty, opacity: 0, state: 'spawning' };
    }

    // --- WARP SCENE INIT ---
    function initWarpScene(dialogId) {
        const sc = storyState.warpScene;
        const cvs = document.getElementById('gameCanvas');
        sc.active = true;
        sc.phase = 'approach';
        sc.timer = 0; sc.animT = 0; sc.dialogIndex = 0;
        sc.currentDialogId = dialogId;
        sc.questActionPending = false;
        sc.angle = -0.2; sc.stretch = 1;
        
        sc.targetPos = { x: (cvs.width / 2) - 120, y: (cvs.height / 2) + 60 };
        sc.arrivalStartPos = {
            x: sc.targetPos.x - Math.cos(sc.angle) * 3000,
            y: sc.targetPos.y - Math.sin(sc.angle) * 3000
        };
        sc.renderPos = { ...sc.arrivalStartPos }; 
    }

    function initEngineer() {
        const eng = storyState.engineerState;
        const cvs = document.getElementById('gameCanvas');
        eng.active = true;
        eng.phase = 'approach';
        eng.animT = 0;
        eng.angle = 0.2; // Mirrored angle
        eng.stretch = 1;
        
        // Target: Right side
        eng.targetPos = { x: (cvs.width / 2) + 120, y: (cvs.height / 2) - 40 };
        eng.arrivalStartPos = {
            x: eng.targetPos.x - Math.cos(eng.angle) * 3000,
            y: eng.targetPos.y - Math.sin(eng.angle) * 3000
        };
        eng.renderPos = { ...eng.arrivalStartPos };
    }

    // --- UPDATERS ---
    
    // Generic logic for BOTH ships (Red & Blue use SAME logic)
    function updateShipAnimation(obj) {
        if (obj.phase === 'approach') {
            if (obj.animT < 1) { obj.animT += 0.04; if (obj.animT > 1) obj.animT = 1; }
            const t = obj.animT;
            const ease = 1 - Math.pow(1 - t, 4); 
            obj.renderPos.x = obj.arrivalStartPos.x + (obj.targetPos.x - obj.arrivalStartPos.x) * ease;
            obj.renderPos.y = obj.arrivalStartPos.y + (obj.targetPos.y - obj.arrivalStartPos.y) * ease;
            obj.stretch = 1 + (49 * (1 - ease)); // Stretch on arrival

            if (obj.animT >= 1) { obj.phase = 'talk'; obj.stretch = 1; }
        }
        else if (obj.phase === 'talk') {
            obj.renderPos.x = obj.targetPos.x;
            obj.renderPos.y = obj.targetPos.y + Math.sin(Date.now() * 0.01) * 2;
        }
        else if (obj.phase === 'leave') {
            obj.animT += 0.05;
            const t = obj.animT;
            const ease = Math.pow(t, 4); 
            
            // Fly FORWARD using their angle
            const endX = obj.targetPos.x + Math.cos(obj.angle) * 3000;
            const endY = obj.targetPos.y + Math.sin(obj.angle) * 3000;
            
            obj.renderPos.x = obj.targetPos.x + (endX - obj.targetPos.x) * ease;
            obj.renderPos.y = obj.targetPos.y + (endY - obj.targetPos.y) * ease;
            obj.stretch = 1 + (49 * ease); // Stretch on exit

            if (obj.animT >= 1.5) { obj.active = false; }
        }
    }

    function updateWarpSceneLogic() {
        const sc = storyState.warpScene;
        const lines = getDialogLines(sc.currentDialogId);

        updateShipAnimation(sc); // Update Red Ship

        // DIALOGUE & LOGIC CONTROL
        if (sc.phase === 'talk') {
            sc.timer++;
            
            // --- INFINITE WARP SCENE LOGIC ---
            if (sc.currentDialogId === 'POST_TEST_CONVO') {
                if(window.warpFactor !== undefined) window.warpFactor = 15; // Force visuals
                
                const currentText = lines[sc.dialogIndex] ? lines[sc.dialogIndex].t : "";
                
                // Logic: Stop waves after "razozlal"
                if (currentText === "разослал") {
                    storyState.wavesActive = false;
                }
                
                // Logic: Engineer leaves after "razozlal" (index 9)
                if (sc.dialogIndex > 9 && storyState.engineerState.phase === 'talk') {
                     storyState.engineerState.phase = 'leave';
                     storyState.engineerState.animT = 0;
                }
            }

            if (sc.timer > 160) { 
                sc.timer = 0;
                sc.dialogIndex++;
                if (sc.dialogIndex >= lines.length) {
                    sc.phase = 'leave';
                    sc.animT = 0; 
                }
            }
        }
        
        // RED SHIP LEAVING LOGIC
        else if (sc.phase === 'leave') {
            // On Start Leave
            if (sc.animT === 0) {
                if (sc.currentDialogId === 'REQ_DRONES') addCredits(0.02);
                if (sc.currentDialogId === 'REQ_MAP_MONEY') addCredits(0.04);
                
                if (sc.questActionPending) {
                     if (sc.currentDialogId === 'CHECK_1_OK') { removeItems(QUEST_REQ.optics.id, 2); removeItems(QUEST_REQ.batteries.id, 2); }
                     if (sc.currentDialogId === 'CHECK_DRONES_OK') { removeItems(QUEST_REQ.drones.id, 2); }
                     sc.questActionPending = false;
                }
            }

            // On Finish Leave
            if (!sc.active) { 
                storyState.testEventActive = false;
                storyState.postTestMode = false;
                if(window.warpFactor) window.warpFactor = 0;
                
                // STAGE TRANSITIONS
                if (storyState.stage === 1) { storyState.stage = 2; storyState.jumpsAfterEvent = 0; }
                else if (storyState.stage === 3) { storyState.stage = 4; } 
                else if (storyState.stage === 4 && sc.currentDialogId === 'CHECK_1_OK') { storyState.stage = 5; storyState.jumpsAfterEvent = 0; }
                else if (storyState.stage === 6) { storyState.stage = 7; } 
                else if (storyState.stage === 7 && sc.currentDialogId === 'CHECK_DRONES_OK') { storyState.stage = 8; storyState.jumpsAfterEvent = 0; }
                else if (storyState.stage === 9) { storyState.stage = 10; storyState.jumpsAfterEvent = 0; }
                else if (storyState.stage === 11) { storyState.stage = 12; } 
                else if (storyState.stage === 12 || storyState.stage === 13) { storyState.stage = 14; } // End Chapter

                if(window.saveGameData) window.saveGameData();
            }
        }
    }

    function processWarpOverride() {
        if (!isWarping || typeof warpState === 'undefined') return;
        const WARP_COAST = 3;
        const activeStages = [1, 3, 6, 9, 11];

        if (activeStages.includes(storyState.stage) && warpState.phase === WARP_COAST) {
            if (!storyState.warpScene.active) {
                let dId = '';
                if (storyState.stage === 1) dId = 'MEETING_1';
                else if (storyState.stage === 3) dId = 'REQUEST_1';
                else if (storyState.stage === 6) dId = 'REQ_DRONES';
                else if (storyState.stage === 9) dId = 'REQ_MAP_MONEY';
                else if (storyState.stage === 11) dId = 'REQ_MAP_INFO';
                initWarpScene(dId);
            }
            warpState.timer = 50; 
            if (typeof jumpBtn !== 'undefined') jumpBtn.innerHTML = "ВХОДЯЩИЙ СИГНАЛ";
            updateWarpSceneLogic();
        }
    }

    // --- MAIN UPDATE LOOP ---
    function updateLogic() {
        if (typeof isWarping !== 'undefined') {
            // Normal Warp Logic (ignored during postTestMode)
            if (window.storyState.wasWarping && !isWarping && !storyState.postTestMode) {
                storyState.jumps++;
                if ([2, 5, 8, 10].includes(storyState.stage)) storyState.jumpsAfterEvent++;
                
                storyState.warpScene.active = false;
                storyState.engineerState.active = false;
                storyState.lastSystemCheck = null;
                
                checkTriggers();
                updateAdminUI();
            }
            window.storyState.wasWarping = isWarping;
        }

        processWarpOverride();

        if (!isWarping && !storyState.warpScene.active) {
            // Trigger Checks in System
            if (storyState.stage === 4 && currentSystemType === 'system') {
                const sysId = (typeof starSystem !== 'undefined') ? starSystem.starColor : 'sys';
                if (storyState.lastSystemCheck !== sysId) {
                    storyState.lastSystemCheck = sysId;
                    const has = (countCargo(QUEST_REQ.optics.id) >= 2 && countCargo(QUEST_REQ.batteries.id) >= 2);
                    const dId = has ? 'CHECK_1_OK' : 'CHECK_1_FAIL';
                    initWarpScene(dId);
                    if(has) storyState.warpScene.questActionPending = true;
                }
            }
            if (storyState.stage === 7 && currentSystemType === 'system') {
                const sysId = (typeof starSystem !== 'undefined') ? starSystem.starColor : 'sys';
                if (storyState.lastSystemCheck !== sysId) {
                    storyState.lastSystemCheck = sysId;
                    const has = (countCargo(QUEST_REQ.drones.id) >= 2);
                    const dId = has ? 'CHECK_DRONES_OK' : 'CHECK_DRONES_FAIL';
                    initWarpScene(dId);
                    if(has) storyState.warpScene.questActionPending = true;
                }
            }
            
            // --- STAGE 12: BLACK HOLE CHECK + INSTANT SCENE START ---
            if (storyState.stage === 12 && currentSystemType === 'black_hole') {
                 if (!storyState.warpScene.active) {
                     const has = (countCargo(QUEST_REQ.starmap.id) >= 1);
                     
                     if (has) {
                         // INSTANTLY START THE INFINITE WARP SCENE
                         removeItems(QUEST_REQ.starmap.id, 1);
                         storyState.testEventActive = true; 
                         storyState.postTestMode = true;
                         storyState.wavesActive = true; 
                         
                         // Initialize Both Ships
                         initWarpScene('POST_TEST_CONVO');
                         initEngineer();
                         
                         // Force Talk State immediately
                         storyState.warpScene.phase = 'talk';
                         storyState.engineerState.phase = 'talk';

                     } else {
                         // Fail dialog (normal warp approach)
                         initWarpScene('CHECK_MAP_FAIL');
                     }
                 }
            }
        }
        
        // Update Scenes
        if (storyState.warpScene.active) updateWarpSceneLogic();
        if (storyState.engineerState.active) updateShipAnimation(storyState.engineerState);

        // GRAVITY PULL (Shake)
        if (storyState.testEventActive && currentSystemType === 'black_hole') {
             if (typeof blackHole !== 'undefined' && typeof mapShip !== 'undefined') {
                 const dx = blackHole.x - mapShip.x;
                 const dy = blackHole.y - mapShip.y;
                 const dist = Math.hypot(dx, dy);
                 if (dist > 10) {
                     mapShip.vx += (dx / dist) * 0.5; 
                     mapShip.vy += (dy / dist) * 0.5;
                 }
                 mapShip.x += (Math.random()-0.5) * 5;
                 mapShip.y += (Math.random()-0.5) * 5;
             }
        }

        // CUBE
        if (storyState.spawnTimer > 0) { storyState.spawnTimer--; if (storyState.spawnTimer <= 0) createCube(); }
        const cube = storyState.cubeEvent;
        if (cube && cube.active) {
            if (cube.state === 'spawning') { cube.opacity += 0.03; if (cube.opacity >= 1) cube.state = 'idle'; } 
            else if (cube.state === 'vanishing') {
                cube.opacity -= 0.04;
                if (cube.opacity <= 0) {
                    cube.active = false; storyState.stage = 1; storyState.cubeEvent = null;
                    if(window.saveGameData) window.saveGameData();
                }
            } else if (cube.state === 'idle') {
                if (typeof mapShip !== 'undefined' && Math.hypot(mapShip.x - cube.x, mapShip.y - cube.y) < STORY_CFG.INTERACT_DIST) {
                    cube.state = 'vanishing';
                }
            }
        }
    }

    // --- DRAWING ---
    function drawStory(ctx) {
        // CUBE
        const cube = storyState.cubeEvent;
        if (cube && cube.active && typeof currentState !== 'undefined' && currentState === 2) {
            const s = STORY_CFG.CUBE_SIZE;
            ctx.save(); ctx.translate(cube.x, cube.y);
            if (cube.state === 'spawning' || cube.state === 'vanishing') {
                const slices = 10; const h = s / slices;
                ctx.fillStyle = `rgba(0, 230, 118, ${cube.opacity})`;
                for(let i=0; i<slices; i++) {
                    const off = (Math.random() - 0.5) * 40 * (1 - cube.opacity);
                    ctx.fillRect(-s/2 + off, -s/2 + (i*h), s, h - 1);
                }
            } else {
                ctx.fillStyle = '#000'; ctx.fillRect(-s/2,-s/2,s,s);
                ctx.strokeStyle = '#00e676'; ctx.lineWidth = 2; ctx.strokeRect(-s/2,-s/2,s,s);
                ctx.fillStyle = 'rgba(0, 230, 118, 0.1)'; ctx.fillRect(-s/2,-s/2,s,s);
            }
            ctx.restore();
        }

        // DRAW SHIPS
        if (storyState.warpScene.active) drawNPC(ctx, storyState.warpScene, 'red'); 
        if (storyState.engineerState.active) drawNPC(ctx, storyState.engineerState, 'blue');
    }

    // --- UNIFIED NPC DRAWING (Identical models, different colors/angles) ---
    function drawNPC(ctx, obj, type) {
        ctx.save();
        ctx.translate(obj.renderPos.x, obj.renderPos.y);
        ctx.rotate(obj.angle);
        if (obj.stretch > 1) { ctx.scale(obj.stretch, 1); }
        
        // Visual Config
        const color = (type === 'blue') ? '#2962ff' : '#ff1744';
        const shadow = (type === 'blue') ? '#2979ff' : '#ff1744';
        const engine = (type === 'blue') ? '#00b0ff' : 'rgba(255, 23, 68, 0.4)';

        ctx.shadowBlur = 10; ctx.shadowColor = shadow;
        ctx.fillStyle = color; 
        
        // STANDARD SHIP SHAPE (Exact copy of Red for Blue)
        ctx.beginPath(); 
        ctx.moveTo(10, 0); 
        ctx.lineTo(-8, 6); 
        ctx.lineTo(-4, 0); 
        ctx.lineTo(-8, -6); 
        ctx.fill();

        // Engine Trails (Warp effect)
        if (obj.phase === 'approach') { 
            ctx.fillStyle = engine; 
            ctx.fillRect(-60, -2, 50, 4); 
        }
        else if (obj.phase === 'leave') { 
            ctx.fillStyle = engine; 
            ctx.fillRect(-20, -3, 15, 6); 
        }

        // ENGINEER WAVE SCANNER (Attached to Blue Ship)
        if (type === 'blue' && storyState.testEventActive && storyState.wavesActive) {
             // Reset rotation for wave to be circular
             ctx.restore(); ctx.save(); ctx.translate(obj.renderPos.x, obj.renderPos.y);

             const waveR = (Date.now() % 1000) / 4; 
             ctx.strokeStyle = `rgba(41, 121, 255, ${1 - waveR/250})`; 
             ctx.lineWidth = 3;
             ctx.beginPath(); ctx.arc(0, 0, waveR, 0, Math.PI*2); ctx.stroke();
             const waveR2 = ((Date.now() + 500) % 1000) / 4;
             ctx.strokeStyle = `rgba(41, 121, 255, ${1 - waveR2/250})`; 
             ctx.beginPath(); ctx.arc(0, 0, waveR2, 0, Math.PI*2); ctx.stroke();
        }

        ctx.restore();

        // TEXT BUBBLES
        if (obj.phase === 'talk') {
             const sc = storyState.warpScene;
             const lines = getDialogLines(sc.currentDialogId);
             if (lines[sc.dialogIndex]) {
                 const line = lines[sc.dialogIndex];
                 // Only draw if this ship is the speaker
                 if (line.s === type) {
                     drawDialogBubble(ctx, obj.renderPos.x, obj.renderPos.y, line.t, (type==='blue' ? '#40c4ff' : '#ff8a80'));
                 }
             }
        }
    }

    function drawDialogBubble(ctx, x, y, text, color) {
        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.font = "bold 14px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.shadowBlur = 4; ctx.shadowColor = "#000";
        
        const metrics = ctx.measureText(text);
        const w = metrics.width + 20;
        
        ctx.fillStyle = 'rgba(0,0,0,0.8)'; 
        ctx.fillRect(x - w/2, y - 45, w, 24);
        
        ctx.fillStyle = color; 
        ctx.fillText(text, x, y - 28);
        ctx.restore();
    }

    // --- HOOKS ---
    const _update = window.update;
    window.update = function() { if(_update) _update(); updateLogic(); };

    const _drawMap = window.drawMap;
    const cvs = document.getElementById('gameCanvas');
    if (typeof window.drawMap === 'function') {
        window.drawMap = function() { _drawMap(); drawStory(cvs.getContext('2d')); };
    } else {
        const _draw = window.draw;
        window.draw = function() { if(_draw) _draw(); drawStory(cvs.getContext('2d')); };
    }

    const _getVis = window.getVisualState;
    window.getVisualState = function() {
        let d = _getVis ? _getVis() : {};
        d.storyContext = { 
            jumps: storyState.jumps, 
            stage: storyState.stage, 
            jumpsAfterEvent: storyState.jumpsAfterEvent,
            testEventActive: storyState.testEventActive
        };
        return d;
    };
    const _setVis = window.setVisualState;
    window.setVisualState = function(d) {
        if(_setVis) _setVis(d);
        if(d && d.storyContext) {
            storyState.jumps = d.storyContext.jumps || 0;
            storyState.stage = d.storyContext.stage || 0;
            storyState.jumpsAfterEvent = d.storyContext.jumpsAfterEvent || 0;
            storyState.testEventActive = d.storyContext.testEventActive || false;
        }
    };

    // --- ADMIN ---
    function updateAdminPanel() {
        const body = document.querySelector('#adminPanel .admin-body');
        if(!body) return;
        let debugRow = null;
        const allLabels = body.querySelectorAll('.adm-label');
        allLabels.forEach(l => { if(l.innerText === 'STORY DEBUGGER') debugRow = l.parentElement; });
        if (!debugRow) {
             const allRows = body.querySelectorAll('.adm-row');
             allRows.forEach(row => {
                const label = row.querySelector('.adm-label');
                if (label && label.innerText === 'STORY DEBUGGER') debugRow = row;
             });
        }
        if (debugRow) {
             debugRow.innerHTML = `
                <span class="adm-label" style="color:#00e5ff">STORY DEBUGGER</span>
                <div style="font-size:10px; color:#aaa; border:1px solid #333; padding:2px; text-align:center;">
                    STG: <b id="admSt" style="color:#fff">0</b> | WAIT: <b id="admWait" style="color:#fff">0</b>
                </div>
                <div class="adm-row horizontal" style="gap:2px; margin-top:4px;">
                    <button class="adm-btn" onclick="window.stJumpTo(0)" style="font-size:9px; flex:1">0:CUBE</button>
                    <button class="adm-btn" onclick="window.stJumpTo(1)" style="font-size:9px; flex:1">1:MEET</button>
                    <button class="adm-btn" onclick="window.stJumpTo(3)" style="font-size:9px; flex:1">3:REQ1</button>
                    <button class="adm-btn" onclick="window.stJumpTo(4)" style="font-size:9px; flex:1">4:CHK1</button>
                </div>
                <div class="adm-row horizontal" style="gap:2px; margin-top:2px;">
                    <button class="adm-btn" onclick="window.stJumpTo(6)" style="font-size:9px; flex:1">6:REQ2</button>
                    <button class="adm-btn" onclick="window.stJumpTo(7)" style="font-size:9px; flex:1">7:CHK2</button>
                </div>
                <div class="adm-row horizontal" style="gap:2px; margin-top:2px;">
                    <button class="adm-btn" onclick="window.stJumpTo(9)" style="font-size:9px; flex:1">9:$$</button>
                    <button class="adm-btn" onclick="window.stJumpTo(11)" style="font-size:9px; flex:1">11:INFO</button>
                    <button class="adm-btn" onclick="window.stJumpTo(12)" style="font-size:9px; flex:1; color:#d500f9">12:END</button>
                </div>
                <div class="adm-row horizontal" style="gap:2px; margin-top:4px; border-top:1px solid #333; padding-top:4px;">
                    <button class="adm-btn" onclick="window.stResetFull()" style="font-size:9px; flex:1; color:red">RST</button>
                    <button class="adm-btn" onclick="window.stGiveOptBat()" style="font-size:9px; flex:1; color:#00e676">+OPT</button>
                    <button class="adm-btn" onclick="window.stGiveDrones()" style="font-size:9px; flex:1; color:#00e676">+DRN</button>
                    <button class="adm-btn" onclick="window.stGiveMap()" style="font-size:9px; flex:1; color:#00e676">+MAP</button>
                </div>`;
        }
        updateAdminUI();
    }
    function updateAdminUI(){
        const s=document.getElementById('admSt'), w=document.getElementById('admWait');
        if(s) s.innerText = storyState.stage; if(w) w.innerText = storyState.jumpsAfterEvent;
    }

    window.stResetFull = function(){ 
        storyState.jumps=0; storyState.stage=0; storyState.jumpsAfterEvent=0; storyState.cubeEvent=null; 
        storyState.warpScene.active = false; storyState.testEventActive=false; storyState.engineerState.active = false;
        storyState.postTestMode = false;
        updateAdminUI(); 
    };
    window.stJumpTo = function(n) { 
        storyState.stage = n; 
        storyState.warpScene.active = false; 
        storyState.lastSystemCheck = null;
        storyState.testEventActive = false;
        storyState.engineerState.active = false;
        storyState.postTestMode = false;
        if([2,5,8,10].includes(n)) storyState.jumpsAfterEvent = 0;
        if([3,6,9,11].includes(n)) storyState.jumpsAfterEvent = 99;
        updateAdminUI(); 
    };
    function spawnItem(id, name, w, h, count) {
        if(!window.placedStorageItems) window.placedStorageItems = [];
        for(let i=0; i<count; i++) {
            for(let y=0; y<8; y++) for(let x=0; x<8; x++) {
                if(!window.isOccupied(x,y,w,h)) {
                    window.placedStorageItems.push({x:x, y:y, type:'cargo', w:w, h:h, commodityId:id, name:name});
                    x=99; y=99; 
                }
            }
        }
        if(window.renderStorageGrid) window.renderStorageGrid();
    }
    window.stGiveOptBat = function() { spawnItem('c20','Optics',2,1,2); spawnItem('c23','Batteries',2,2,2); };
    window.stGiveDrones = function() { spawnItem('c25','Drones',2,2,2); };
    window.stGiveMap = function() { spawnItem('c50','Star Map',1,1,1); };
    
    setInterval(updateAdminPanel, 2000);
})();