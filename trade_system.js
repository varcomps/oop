/* trade_system.js - STRICT CLEANUP & ATOMIC TRANSFER */

// --- 1. СТИЛИ (БЕЗ ИЗМЕНЕНИЙ) ---
const tradeStyles = `
    #tradeUI {
        display: none;
        position: absolute;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: 1200px;
        height: 800px;
        background: #0b0b0d;
        border: 2px solid #333;
        box-shadow: 0 0 100px #000;
        z-index: 200;
        flex-direction: column;
        color: #ccc;
        font-family: 'Orbitron', sans-serif;
    }

    .trade-header {
        height: 50px;
        background: #111;
        border-bottom: 1px solid #333;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 20px;
        font-size: 16px;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 2px;
    }

    .trade-body {
        display: flex;
        flex: 1;
        padding: 30px;
        gap: 40px;
        overflow: hidden;
        justify-content: center;
        background: radial-gradient(circle at center, #141414 0%, #080808 100%);
    }

    .trade-panel {
        width: 500px;
        display: flex;
        flex-direction: column;
        background: rgba(0,0,0,0.5);
        border: 1px solid #333;
        padding: 10px;
        position: relative;
    }
    
    .panel-title {
        font-size: 20px;
        margin-bottom: 15px;
        text-transform: uppercase;
        letter-spacing: 3px;
        text-align: center;
        padding-bottom: 10px;
        border-bottom: 1px solid rgba(255,255,255,0.1);
        font-weight: bold;
    }
    .my-side .panel-title { color: #ffab00; }
    .partner-side .panel-title { color: #00e5ff; }

    .trade-grid-container {
        display: grid;
        grid-template-columns: repeat(10, 48px);
        grid-template-rows: repeat(10, 48px);
        gap: 2px;
        margin: 0 auto;
        background: #000;
        border: 1px solid #222;
        padding: 2px;
    }

    .trade-cell {
        width: 48px; height: 48px;
        background: #1a1a1a;
        border: 1px solid #333;
        position: relative;
    }
    
    .status-badge {
        margin-top: 15px;
        height: 45px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        letter-spacing: 2px;
        border: 1px solid #333;
        background: #111;
        color: #555;
        transition: 0.3s;
    }
    
    .status-badge.ready-me {
        background: rgba(0, 230, 118, 0.1);
        border: 1px solid #00e676;
        color: #00e676;
        box-shadow: 0 0 25px rgba(0, 230, 118, 0.2);
    }
    .status-badge.ready-partner {
        background: rgba(0, 229, 255, 0.1);
        border: 1px solid #00e5ff;
        color: #00e5ff;
        box-shadow: 0 0 25px rgba(0, 229, 255, 0.2);
    }

    .t-item {
        position: absolute;
        top: 0; left: 0;
        background: #3e2723;
        border: 1px solid #5d4037;
        color: #aaa;
        font-size: 10px;
        display: flex; align-items: center; justify-content: center;
        overflow: hidden;
        z-index: 10;
        cursor: pointer;
    }
    .t-item.fuel { background: #263238; border-color: #00bcd4; }
    .t-item.fuel_prem { background: #263238; border-color: #ffd700; }
    .t-item.fuel_shift { background: #2b0b0b; border-color: #d50000; }

    .t-item.selected-give {
        border: 3px solid #ffab00 !important;
        box-shadow: inset 0 0 15px rgba(255, 171, 0, 0.5);
        z-index: 20;
    }
    .t-item.selected-receive {
        border: 3px solid #00e676 !important;
        box-shadow: inset 0 0 15px rgba(0, 230, 118, 0.5);
        z-index: 20;
    }

    .trade-footer {
        height: 100px;
        border-top: 1px solid #333;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #0f0f0f;
    }

    .btn-main-action {
        width: 320px;
        height: 60px;
        background: #111;
        border: 2px solid #444;
        color: #666;
        font-family: 'Orbitron';
        font-size: 22px;
        cursor: pointer;
        transition: 0.2s;
        text-transform: uppercase;
        letter-spacing: 3px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .btn-main-action:hover {
        border-color: #666;
        color: #ccc;
    }
    
    .btn-main-action.waiting {
        background: #1a1500;
        color: #ffab00;
        border-color: #ffab00;
        box-shadow: 0 0 15px rgba(255, 171, 0, 0.2);
    }
    
    .btn-main-action.error {
        background: #1a0000;
        color: #ff1744;
        border-color: #ff1744;
        cursor: not-allowed;
    }
    
    .btn-main-action.success {
        background: #001a0a;
        color: #00e676;
        border-color: #00e676;
        box-shadow: 0 0 30px rgba(0, 230, 118, 0.3);
    }

    /* ЛОАДЕР */
    #tradeLoader {
        display: none;
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.95);
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 300;
    }
    .square-spinner {
        width: 60px; height: 60px;
        position: relative;
        margin-bottom: 30px;
    }
    .sq-part {
        width: 20px; height: 20px;
        background: #00e5ff;
        position: absolute;
        animation: square-move 2s infinite ease-in-out;
    }
    .sq-part:nth-child(1) { top: 0; left: 0; animation-delay: 0s; }
    .sq-part:nth-child(2) { top: 0; right: 0; animation-delay: 0.5s; background: #ffab00; }
    .sq-part:nth-child(3) { bottom: 0; right: 0; animation-delay: 1.0s; background: #d50000; }
    .sq-part:nth-child(4) { bottom: 0; left: 0; animation-delay: 1.5s; background: #00e676; }

    @keyframes square-move {
        0% { transform: scale(1); }
        50% { transform: scale(0.5) rotate(90deg); }
        100% { transform: scale(1) rotate(180deg); }
    }
    .loader-text { font-size: 24px; color: #fff; letter-spacing: 5px; margin-bottom: 10px; }
    .loader-sub { color: #666; cursor: pointer; border: 1px solid #444; padding: 5px 15px; }
    .loader-sub:hover { color: #fff; border-color: #fff; }
`;

function injectTradeUI() {
    const oldStyle = document.querySelector('style[data-trade="final-stable"]');
    if (oldStyle) oldStyle.remove();
    const oldUI = document.getElementById('tradeUI');
    if (oldUI) oldUI.remove();
    const oldLoader = document.getElementById('tradeLoader');
    if (oldLoader) oldLoader.remove();

    const styleSheet = document.createElement("style");
    styleSheet.setAttribute('data-trade', 'final-stable');
    styleSheet.innerText = tradeStyles;
    document.head.appendChild(styleSheet);

    const html = `
    <div id="tradeLoader">
        <div class="square-spinner">
            <div class="sq-part"></div><div class="sq-part"></div><div class="sq-part"></div><div class="sq-part"></div>
        </div>
        <div class="loader-text">ПОИСК СИГНАЛА...</div>
        <div class="loader-sub" onclick="window.closeTradeSession()">ОТМЕНА [ESC]</div>
    </div>

    <div id="tradeUI">
        <div class="trade-header">
            <span>SECURE LINK: ESTABLISHED</span>
            <span style="cursor:pointer; color:#888;" onclick="window.closeTradeSession()">ЗАКРЫТЬ [ESC]</span>
        </div>
        
        <div class="trade-body">
            <div class="trade-panel my-side">
                <div class="panel-title">ВАШ СКЛАД</div>
                <div id="tradeMyGrid" class="trade-grid-container"></div>
                <div id="myBadge" class="status-badge">НЕ ГОТОВ</div>
            </div>

            <div class="trade-panel partner-side">
                <div class="panel-title">СКЛАД ПАРТНЕРА</div>
                <div id="tradePartnerGrid" class="trade-grid-container"></div>
                <div id="partnerBadge" class="status-badge">НЕ ГОТОВ</div>
            </div>
        </div>

        <div class="trade-footer">
            <button id="btnMainAction" class="btn-main-action" onclick="window.toggleReadyState()">ГОТОВ</button>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
}

injectTradeUI();

// --- 2. ЛОГИКА СЕССИЙ (STRICT MODE) ---

let isTradeActive = false;
let currentSessionId = null;
let currentRole = null; 
let tradeListener = null;

let mySelection = [];
let partnerSelection = [];
let partnerInventory = [];
let isMyConfirmed = false;
let isPartnerConfirmed = false;

// Глобальные флаги защиты
let isTradeFinalized = false;
let isWaitingForTransfer = false;

window.tryOpenTrade = function() {
    if (isTradeActive) return;

    // 1. Показываем лоадер
    const loader = document.getElementById('tradeLoader');
    if (loader) {
        loader.style.display = 'flex';
        const txt = loader.querySelector('.loader-text');
        if (txt) txt.innerText = "ПОИСК СИГНАЛА...";
    }
    
    isTradeActive = true; 

    // 2. Сканируем окружение
    setTimeout(() => {
        const myPos = { x: player.x, y: player.y };
        let nearestUid = null;
        let minDst = 9999;
        
        if (typeof mpState !== 'undefined' && mpState.remotePlayers) {
            Object.keys(mpState.remotePlayers).forEach(uid => {
                const p = mpState.remotePlayers[uid];
                if (p.stationPos) {
                    const dst = Math.hypot(p.stationPos.x - myPos.x, p.stationPos.y - myPos.y);
                    if (dst < 150) { 
                        if (dst < minDst) { minDst = dst; nearestUid = uid; }
                    }
                }
            });
        }

        if (nearestUid) {
            const txt = loader.querySelector('.loader-text');
            if (txt) txt.innerText = "УСТАНОВКА СВЯЗИ...";
            // Запускаем процесс инициализации
            initiateSession(nearestUid);
        } else {
            const txt = loader.querySelector('.loader-text');
            if (txt) txt.innerText = "СИГНАЛ НЕ НАЙДЕН";
            setTimeout(() => {
                window.closeTradeSession();
            }, 1000);
        }
    }, 500);
};


async function initiateSession(targetUid) {
    const myUid = firebase.auth().currentUser.uid;
    // Сортировка UID гарантирует один и тот же ID сессии для обоих игроков
    const uids = [myUid, targetUid].sort();
    currentSessionId = uids.join('_');
    currentRole = (myUid === uids[0]) ? 'host' : 'client';
    
    const sessionRef = firebase.database().ref('trades/' + currentSessionId);
    
    // Сброс локальных данных
    if (tradeListener) sessionRef.off('value', tradeListener);
    isTradeFinalized = false;
    isWaitingForTransfer = false;
    mySelection = [];
    isMyConfirmed = false;

    // === ЯДЕРНАЯ ЗАЧИСТКА ===
    // Хост перед входом ОБЯЗАН удалить всё старое дерьмо.
    // Клиент просто ждет, пока хост создаст чистую сессию.
    
    try {
        if (currentRole === 'host') {
            console.log("[TRADE] Host: Nuking old session data...");
            await sessionRef.remove(); // Удаляем всё
        }
        
        // Устанавливаем "бомбу" на случай разрыва соединения
        sessionRef.onDisconnect().remove();

        // Заходим в сессию
        await sessionRef.child(currentRole).set({
            status: 'connected',
            uid: myUid,
            inventory: window.placedStorageItems || [],
            selection: [],
            ready: false,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        // Подключаем слушателя
        tradeListener = sessionRef.on('value', onSessionUpdate);
        
    } catch (e) {
        console.error("[TRADE] Init Failed:", e);
        window.closeTradeSession();
        if(typeof uiHint !== 'undefined') uiHint.innerHTML = "ОШИБКА СЕТИ";
    }
}

function onSessionUpdate(snapshot) {
    const data = snapshot.val();
    
    // 1. ЕСЛИ СЕССИЯ ПУСТАЯ (или удалена)
    if (!data) {
        // Если мы уже были в процессе торговли и данные исчезли -> кто-то вышел или сессия убита
        if (document.getElementById('tradeUI').style.display === 'flex' && !isTradeFinalized) {
            window.closeTradeSession();
            if(typeof uiHint !== 'undefined') uiHint.innerHTML = "СЕССИЯ ПРЕРВАНА";
        }
        return;
    }

    // 2. СИГНАЛ НА ПЕРЕДАЧУ (АТОМАРНЫЙ)
    if (data.transfer_signal === true) {
        if (!isTradeFinalized) {
            performAtomicTransfer();
        }
        return;
    }

    // 3. ПРОВЕРКА НАЛИЧИЯ ОБОИХ ИГРОКОВ
    const hostData = data.host;
    const clientData = data.client;

    if (hostData && clientData && hostData.status === 'connected' && clientData.status === 'connected') {
        // Оба на месте -> Открываем интерфейс
        const loader = document.getElementById('tradeLoader');
        if (loader && loader.style.display !== 'none') {
            loader.style.display = 'none';
            document.getElementById('tradeUI').style.display = 'flex';
        }

        // Обновляем данные
        const partnerData = (currentRole === 'host') ? clientData : hostData;
        partnerInventory = partnerData.inventory || [];
        partnerSelection = partnerData.selection || [];
        isPartnerConfirmed = partnerData.ready || false;

        renderMyGrid();
        renderPartnerGrid();
        updateInterfaceState();

        // Проверка готовности (только Хост инициирует сигнал)
        if (currentRole === 'host' && hostData.ready && clientData.ready && !isWaitingForTransfer) {
            initiateTransferSignal();
        }
    } else {
        // Кого-то нет. Если окно уже открыто -> закрываем, т.к. партнер вышел
        if (document.getElementById('tradeUI').style.display === 'flex') {
             // Ждем секунду (вдруг просто лаг при подключении), если нет -> выход
             // Но для строгой логики лучше сразу закрыть
             // window.closeTradeSession(); 
        }
    }
}

function initiateTransferSignal() {
    isWaitingForTransfer = true;
    updateInterfaceState(); // Кнопка "ОБРАБОТКА..."
    
    // Пишем глобальный сигнал в корень сессии
    firebase.database().ref('trades/' + currentSessionId).update({
        transfer_signal: true
    });
}

function performAtomicTransfer() {
    if (isTradeFinalized) return;
    isTradeFinalized = true;

    console.log("[TRADE] EXECUTING TRANSFER LOCALLY");

    // --- ЛОГИКА ОБМЕНА ---
    let incomingItems = [];
    partnerSelection.forEach(sel => {
        const item = partnerInventory.find(i => i.x === sel.x && i.y === sel.y);
        if (item) incomingItems.push(item);
    });

    let newInventory = window.placedStorageItems.filter(item => {
        return !mySelection.some(sel => sel.x === item.x && sel.y === item.y);
    });

    incomingItems.forEach(incItem => {
        const pos = findEmptySpot(newInventory, incItem.w, incItem.h);
        if (pos) {
            newInventory.push({ 
                type: incItem.type,
                x: pos.x, y: pos.y,
                w: incItem.w, h: incItem.h,
                name: incItem.name || '',
                commodityId: incItem.commodityId || null
            });
        }
    });

    // Сохраняем
    window.placedStorageItems = newInventory;
    if (window.saveGameData) window.saveGameData();
    
    // UI Успех
    const btn = document.getElementById('btnMainAction');
    if (btn) {
        btn.innerText = "СДЕЛКА ЗАВЕРШЕНА";
        btn.className = "btn-main-action success";
    }

    // === УДАЛЕНИЕ СЕССИИ ===
    // Каждый клиент отключается. Хост удаляет данные.
    setTimeout(() => {
        window.closeTradeSession(true); // true = завершено успешно
    }, 1500);
}

window.closeTradeSession = function(success = false) {
    isTradeActive = false;
    document.getElementById('tradeUI').style.display = 'none';
    document.getElementById('tradeLoader').style.display = 'none';

    if (currentSessionId) {
        const ref = firebase.database().ref('trades/' + currentSessionId);
        
        // Отключаем слушателя СРАЗУ, чтобы не получить null и не вызвать ошибку
        if (tradeListener) {
            ref.off('value', tradeListener);
        }

        // Если это успешное завершение или я хост -> чистим за собой
        if (currentRole === 'host' || success) {
            ref.remove().catch(()=>{});
        } else {
            // Если я просто вышел (ESC), удаляю только себя, 
            // что вызовет срабатывание onDisconnect логики или проверки у партнера
            ref.child(currentRole).remove().catch(()=>{});
        }
    }
    
    currentSessionId = null;
    tradeListener = null;
    mySelection = [];
    isMyConfirmed = false;
    isTradeFinalized = false;
    isWaitingForTransfer = false;
    
    if (window.renderStorageGrid) window.renderStorageGrid();
};

// --- 3. ИНТЕРФЕЙС ---

window.toggleReadyState = function() {
    if (isWaitingForTransfer || isTradeFinalized) return;
    if (!checkSpaceViability()) return;
    
    isMyConfirmed = !isMyConfirmed;
    
    firebase.database().ref(`trades/${currentSessionId}/${currentRole}`).update({
        ready: isMyConfirmed,
        selection: mySelection 
    });
};

function toggleMyItemSelection(item) {
    if (isMyConfirmed || isWaitingForTransfer || isTradeFinalized) return; 

    const idx = mySelection.findIndex(sel => sel.x === item.x && sel.y === item.y);
    if (idx !== -1) mySelection.splice(idx, 1);
    else mySelection.push({ x: item.x, y: item.y });
    
    firebase.database().ref(`trades/${currentSessionId}/${currentRole}`).update({
        selection: mySelection
    });
    
    renderMyGrid();
    updateInterfaceState();
}

function checkSpaceViability() {
    const safeMyItems = window.placedStorageItems || [];
    let simInventory = safeMyItems.filter(item => {
        return !mySelection.some(sel => sel.x === item.x && sel.y === item.y);
    });
    
    let incomingItems = [];
    partnerSelection.forEach(sel => {
        const item = partnerInventory.find(i => i.x === sel.x && i.y === sel.y);
        if (item) incomingItems.push(item);
    });
    
    for (let incItem of incomingItems) {
        const pos = findEmptySpot(simInventory, incItem.w, incItem.h);
        if (pos) {
            simInventory.push({ ...incItem, x: pos.x, y: pos.y }); 
        } else {
            return false;
        }
    }
    return true;
}

function updateInterfaceState() {
    const btn = document.getElementById('btnMainAction');
    const myBadge = document.getElementById('myBadge');
    const partnerBadge = document.getElementById('partnerBadge');
    
    if (!btn || !myBadge || !partnerBadge) return;

    myBadge.className = isMyConfirmed ? "status-badge ready-me" : "status-badge";
    myBadge.innerText = isMyConfirmed ? "ГОТОВ" : "НЕ ГОТОВ";

    partnerBadge.className = isPartnerConfirmed ? "status-badge ready-partner" : "status-badge";
    partnerBadge.innerText = isPartnerConfirmed ? "ГОТОВ" : "НЕ ГОТОВ";

    const canFit = checkSpaceViability();

    if (!canFit) {
        btn.innerText = "НЕТ МЕСТА";
        btn.className = "btn-main-action error";
    } else if (isTradeFinalized) {
        btn.innerText = "УСПЕШНО!";
        btn.className = "btn-main-action success";
    } else if (isWaitingForTransfer) {
        btn.innerText = "ОБМЕН...";
        btn.className = "btn-main-action success";
    } else if (isMyConfirmed) {
        btn.innerText = "ОЖИДАНИЕ...";
        btn.className = "btn-main-action waiting";
    } else {
        btn.innerText = "ГОТОВ";
        btn.className = "btn-main-action";
    }
}

function renderMyGrid() {
    const container = document.getElementById('tradeMyGrid');
    if (!container) return;
    container.innerHTML = '';
    
    for (let i = 0; i < 100; i++) {
        const cell = document.createElement('div');
        cell.className = 'trade-cell';
        const x = i % 10; const y = Math.floor(i / 10);
        
        const item = window.placedStorageItems.find(it => it.x === x && it.y === y);
        const occupied = window.placedStorageItems.some(it => x >= it.x && x < it.x + it.w && y >= it.y && y < it.y + it.h);

        if (item) {
            const vis = createItemVisual(item, 48);
            const isSelected = mySelection.some(sel => sel.x === item.x && sel.y === item.y);
            if (isSelected) vis.classList.add('selected-give');
            
            vis.onclick = (e) => { e.stopPropagation(); toggleMyItemSelection(item); };
            cell.appendChild(vis);
        } else if (occupied) {
            cell.style.background = '#222';
        }
        container.appendChild(cell);
    }
}

function renderPartnerGrid() {
    const container = document.getElementById('tradePartnerGrid');
    if (!container) return;
    container.innerHTML = '';
    
    for (let i = 0; i < 100; i++) {
        const cell = document.createElement('div');
        cell.className = 'trade-cell';
        const x = i % 10; const y = Math.floor(i / 10);
        
        const item = partnerInventory.find(it => it.x === x && it.y === y);
        const occupied = partnerInventory.some(it => x >= it.x && x < it.x + it.w && y >= it.y && y < it.y + it.h);

        if (item) {
            const vis = createItemVisual(item, 48);
            const isSelected = partnerSelection.some(sel => sel.x === item.x && sel.y === item.y);
            if (isSelected) vis.classList.add('selected-receive');
            
            vis.style.cursor = 'default';
            cell.appendChild(vis);
        } else if (occupied) {
            cell.style.background = '#1a1a1a';
        }
        container.appendChild(cell);
    }
}

function createItemVisual(item, size) {
    const el = document.createElement('div');
    el.className = 't-item';
    if (item.type === 'fuel') el.classList.add('fuel');
    if (item.type === 'fuel_premium') el.classList.add('fuel_prem');
    if (item.type === 'fuel_shift') el.classList.add('fuel_shift');
    
    el.style.width = (item.w * size - 2) + 'px';
    el.style.height = (item.h * size - 2) + 'px';
    
    let text = "";
    if (item.type === 'cargo') text = item.name ? item.name.substr(0,5) : 'BOX';
    else if (item.type === 'fuel') text = 'FUEL';
    else if (item.type === 'fuel_premium') text = 'S-F';
    else if (item.type === 'fuel_shift') text = 'SHFT';
    
    el.innerText = text;
    return el;
}

function findEmptySpot(collection, w, h) {
    for (let y = 0; y <= 10 - h; y++) {
        for (let x = 0; x <= 10 - w; x++) {
            let collision = false;
            for (let it of collection) {
                if (x < it.x + it.w && x + w > it.x && y < it.y + it.h && y + h > it.y) {
                    collision = true; break;
                }
            }
            if (!collision) return { x, y };
        }
    }
    return null;
}