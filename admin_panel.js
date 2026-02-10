/* admin_panel.js - FIXED: No Recursion, No Alerts, Status Bar */

// ==========================================
// 1. СТИЛИ ИНТЕРФЕЙСА
// ==========================================
const adminStyles = `
    #adminPanel {
        display: none;
        position: fixed;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: 550px;
        height: auto;
        background: rgba(10, 0, 0, 0.98);
        border: 2px solid #ff1744;
        box-shadow: 0 0 40px rgba(255, 23, 68, 0.4), inset 0 0 50px rgba(0,0,0,0.9);
        z-index: 99999;
        flex-direction: column;
        font-family: 'Share Tech Mono', monospace;
        color: #ff1744;
    }

    .admin-header {
        background: rgba(255, 23, 68, 0.15);
        padding: 12px 15px;
        border-bottom: 1px solid #ff1744;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: grab;
        user-select: none;
    }
    .admin-title { font-weight: bold; letter-spacing: 2px; font-size: 14px; text-shadow: 0 0 5px #ff1744; }
    .admin-close { cursor: pointer; color: #fff; font-weight: bold; }
    .admin-close:hover { color: #ff1744; }

    .admin-tabs { display: flex; background: #000; border-bottom: 1px solid #333; }
    .admin-tab-btn {
        flex: 1; padding: 12px;
        background: transparent; border: none;
        color: #555; font-family: 'Orbitron';
        cursor: pointer; transition: 0.2s;
        border-bottom: 2px solid transparent;
        font-size: 12px;
    }
    .admin-tab-btn.active {
        color: #ff1744;
        border-bottom: 2px solid #ff1744;
        background: rgba(255, 23, 68, 0.05);
    }

    .admin-body { padding: 20px; display: flex; flex-direction: column; gap: 15px; }
    .admin-view { display: none; flex-direction: column; gap: 12px; }
    .admin-view.active { display: flex; }

    .adm-row { display: flex; flex-direction: column; gap: 6px; }
    .adm-row.horizontal { flex-direction: row; align-items: center; gap: 10px; }
    
    .adm-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
    
    .adm-input, .adm-select, .adm-textarea {
        background: #080808;
        border: 1px solid #444;
        color: #fff;
        padding: 10px;
        font-family: 'Share Tech Mono';
        font-size: 12px;
        outline: none;
        resize: none;
        transition: 0.2s;
    }
    .adm-input:focus, .adm-select:focus, .adm-textarea:focus { border-color: #ff1744; box-shadow: 0 0 10px rgba(255, 23, 68, 0.2); }
    .adm-input:disabled { opacity: 0.3; cursor: not-allowed; }

    .adm-btn {
        background: #2b0b0b;
        border: 1px solid #ff1744;
        color: #ff1744;
        padding: 12px;
        cursor: pointer;
        font-family: 'Orbitron';
        font-weight: bold;
        transition: 0.2s;
        margin-top: 10px;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    .adm-btn:hover { background: #ff1744; color: #000; box-shadow: 0 0 20px #ff1744; }
    .adm-btn:active { transform: scale(0.98); }

    .adm-checkbox-wrapper { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    .adm-checkbox { accent-color: #ff1744; width: 16px; height: 16px; cursor: pointer; }

    /* STATUS BAR */
    .admin-status-bar {
        margin-top: 10px;
        padding: 8px;
        font-size: 11px;
        text-align: center;
        border: 1px solid transparent;
        min-height: 15px;
        display: none;
    }
    .status-success { color: #00e676; border-color: #00e676; background: rgba(0, 230, 118, 0.1); display: block; }
    .status-error { color: #ff1744; border-color: #ff1744; background: rgba(255, 23, 68, 0.1); display: block; }
`;

function injectAdminStyles() {
    const styleSheet = document.createElement("style");
    styleSheet.innerText = adminStyles;
    document.head.appendChild(styleSheet);
}

// ==========================================
// 2. HTML СТРУКТУРА
// ==========================================
function initAdminPanel() {
    injectAdminStyles();
    
    const old = document.getElementById('adminPanel');
    if (old) old.remove();

    const html = `
    <div id="adminPanel">
        <div class="admin-header" id="adminHeader">
            <span class="admin-title">ROOT TERMINAL // ACCESS LEVEL 5</span>
            <span class="admin-close" onclick="toggleAdminPanel()">[TERMINATE]</span>
        </div>
        
        <div class="admin-tabs">
            <button class="admin-tab-btn active" onclick="switchAdminTab('mail')">GIFT PROTOCOL</button>
            <button class="admin-tab-btn" onclick="switchAdminTab('cheats')">LOCAL OVERRIDE</button>
        </div>

        <div class="admin-body">
            <div id="adm-view-mail" class="admin-view active">
                
                <div class="adm-row">
                    <span class="adm-label">ПОЛУЧАТЕЛЬ</span>
                    <div class="adm-row horizontal">
                        <input type="text" id="admTargetInput" class="adm-input" placeholder="Введите никнейм..." style="flex:1">
                        <label class="adm-checkbox-wrapper">
                            <input type="checkbox" id="admSendAll" class="adm-checkbox" onchange="toggleTargetInput()">
                            <span style="font-size:11px; color:#ccc;">РАССЫЛКА ВСЕМ</span>
                        </label>
                    </div>
                </div>

                <div class="adm-row">
                    <span class="adm-label">СОДЕРЖАНИЕ</span>
                    <input type="text" id="admSubject" class="adm-input" placeholder="Тема сообщения">
                    <textarea id="admBody" class="adm-textarea" rows="3" placeholder="Текст сообщения..."></textarea>
                </div>

                <div class="adm-row">
                    <span class="adm-label">ВЛОЖЕНИЕ (НАГРАДА)</span>
                    <div class="adm-row horizontal">
                        <select id="admRewardType" class="adm-select" style="width: 120px;" onchange="updateRewardInputs()">
                            <option value="none">-- ПУСТО --</option>
                            <option value="credits">КРЕДИТЫ (SC)</option>
                            <option value="fuel">ТОПЛИВО</option>
                            <option value="item">ПРЕДМЕТ</option>
                        </select>

                        <div id="admFuelTypeContainer" style="display:none; width: 120px;">
                            <select id="admFuelSelect" class="adm-select" style="width:100%">
                                <option value="normal">ОБЫЧНОЕ</option>
                                <option value="premium">ПРЕМИУМ (GOLD)</option>
                                <option value="shift">SHIFT FUEL (RED)</option>
                            </select>
                        </div>

                        <div id="admItemSelectContainer" style="display:none; flex:1;">
                            <select id="admItemSelect" class="adm-select" style="width:100%"></select>
                        </div>
                        
                        <div id="admAmountContainer" style="display:none; flex:1;">
                            <input type="number" id="admAmount" class="adm-input" placeholder="Кол-во" style="width:100%">
                        </div>
                    </div>
                </div>

                <button class="adm-btn" onclick="executeAdminSend()">ОТПРАВИТЬ ПАКЕТ</button>
                <div id="admStatus" class="admin-status-bar"></div>
            </div>

            <div id="adm-view-cheats" class="admin-view">
                <div class="adm-row">
                    <span class="adm-label">КРЕДИТЫ (ЛОКАЛЬНО)</span>
                    <div class="adm-row horizontal">
                        <input type="number" id="cheatCredits" class="adm-input" value="1000" style="flex:1">
                        <button class="adm-btn" style="margin:0; padding:8px 20px;" onclick="doCheat('credits')">ADD</button>
                    </div>
                </div>
                <div class="adm-row">
                    <span class="adm-label">ДЕТАЛИ КОРПУСА (ЛОКАЛЬНО)</span>
                    <div class="adm-row horizontal">
                        <input type="number" id="cheatHull" class="adm-input" value="10" style="flex:1">
                        <button class="adm-btn" style="margin:0; padding:8px 20px;" onclick="doCheat('hull')">ADD</button>
                    </div>
                </div>
                <div class="adm-row">
                    <span class="adm-label">DEBUG DATA</span>
                    <button class="adm-btn" style="background:#111; border-color:#555; color:#888" onclick="console.log(window.marketState)">LOG MARKET STATE</button>
                </div>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    
    if (typeof makeDraggable === 'function') {
        makeDraggable(document.getElementById('adminPanel'), document.getElementById('adminHeader'));
    }

    populateItemList();
}

// ==========================================
// 3. ЛОГИКА ИНТЕРФЕЙСА
// ==========================================

window.isAdminOpen = false; // Глобальный флаг для блокировки управления в main.js

window.addEventListener('keydown', (e) => {
    // Если фокус в поле ввода - не обрабатываем H
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        if (e.code === 'Escape') toggleAdminPanel(); // ESC закрывает панель даже из инпута
        return;
    }

    if (e.code === 'KeyH') {
        const nickDisplay = document.getElementById('nicknameDisplay');
        if (!nickDisplay) return;
        const currentNick = nickDisplay.innerText.trim();
        
        if (currentNick === 'varcomp') {
            toggleAdminPanel();
        }
    }
});

function toggleAdminPanel() {
    window.isAdminOpen = !window.isAdminOpen;
    const panel = document.getElementById('adminPanel');
    if (panel) {
        panel.style.display = window.isAdminOpen ? 'flex' : 'none';
        if (window.isAdminOpen) {
            populateItemList(); 
            // Сброс инпутов (опционально)
            document.getElementById('admStatus').style.display = 'none';
        }
    }
}

function switchAdminTab(tabName) {
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-view').forEach(v => v.classList.remove('active'));
    
    const btns = document.querySelectorAll('.admin-tab-btn');
    if (tabName === 'mail') btns[0].classList.add('active');
    else btns[1].classList.add('active');

    document.getElementById(`adm-view-${tabName}`).classList.add('active');
    document.getElementById('admStatus').style.display = 'none';
}

function toggleTargetInput() {
    const isAll = document.getElementById('admSendAll').checked;
    const input = document.getElementById('admTargetInput');
    input.disabled = isAll;
    input.placeholder = isAll ? "ШИРОКОВЕЩАТЕЛЬНАЯ РАССЫЛКА" : "Введите никнейм...";
    if (isAll) input.value = "";
}

function updateRewardInputs() {
    const type = document.getElementById('admRewardType').value;
    const itemContainer = document.getElementById('admItemSelectContainer');
    const amtContainer = document.getElementById('admAmountContainer');
    const fuelContainer = document.getElementById('admFuelTypeContainer');
    
    itemContainer.style.display = 'none';
    amtContainer.style.display = 'none';
    fuelContainer.style.display = 'none';

    if (type === 'credits') {
        amtContainer.style.display = 'block';
    } else if (type === 'fuel') {
        amtContainer.style.display = 'block';
        fuelContainer.style.display = 'block';
    } else if (type === 'item') {
        itemContainer.style.display = 'block';
    }
}

function populateItemList() {
    const select = document.getElementById('admItemSelect');
    if (!select) return;
    
    const currentVal = select.value;
    select.innerHTML = '';

    let items = [];
    if (typeof COMMODITY_DB !== 'undefined') {
        items = COMMODITY_DB;
    } else if (window.marketState && window.marketState.items) {
        items = window.marketState.items;
    }

    if (items.length === 0) {
        const opt = document.createElement('option');
        opt.innerText = "База предметов пуста";
        select.appendChild(opt);
        return;
    }

    items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.id; 
        opt.innerText = item.name || item.id;
        select.appendChild(opt);
    });

    if (currentVal) select.value = currentVal;
}

function showStatus(msg, isError = false) {
    const el = document.getElementById('admStatus');
    el.innerText = msg;
    el.className = 'admin-status-bar ' + (isError ? 'status-error' : 'status-success');
    el.style.display = 'block';
    
    // Автоскрытие через 3 секунды
    setTimeout(() => {
        el.style.display = 'none';
    }, 3000);
}

// ==========================================
// 4. ЛОГИКА ОТПРАВКИ (ПРЯМАЯ, БЕЗ РЕКУРСИИ)
// ==========================================

async function executeAdminSend() {
    const isAll = document.getElementById('admSendAll').checked;
    const targetNick = document.getElementById('admTargetInput').value.trim();
    const subject = document.getElementById('admSubject').value.trim();
    const body = document.getElementById('admBody').value.trim();
    const rType = document.getElementById('admRewardType').value;
    
    // Валидация
    if (!isAll && !targetNick) { showStatus("ОШИБКА: НЕ УКАЗАН ПОЛУЧАТЕЛЬ", true); return; }
    if (!subject) { showStatus("ОШИБКА: НЕТ ТЕМЫ", true); return; }
    if (!body) { showStatus("ОШИБКА: ПУСТОЕ ТЕЛО ПИСЬМА", true); return; }

    // Сборка наград
    const rewards = [];
    if (rType !== 'none') {
        let amount = 1;
        let subtype = null;

        if (rType === 'item') {
            subtype = document.getElementById('admItemSelect').value;
            amount = 1; 
        } else if (rType === 'fuel') {
            subtype = document.getElementById('admFuelSelect').value;
            amount = parseFloat(document.getElementById('admAmount').value);
        } else {
            amount = parseFloat(document.getElementById('admAmount').value);
        }

        if (isNaN(amount) || amount <= 0) { showStatus("ОШИБКА: НЕВЕРНОЕ КОЛИЧЕСТВО", true); return; }

        rewards.push({
            type: rType,
            subtype: subtype, 
            amount: amount,
            claimed: false
        });
    }

    const mailData = {
        sender: "SYSTEM COMMAND",
        title: subject,
        body: body,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        rewards: rewards,
        isClaimed: false
    };

    const btn = document.querySelector('.adm-btn');
    const oldText = btn.innerText;
    btn.innerText = "ПЕРЕДАЧА...";
    btn.disabled = true;

    try {
        if (isAll) {
            await _internalSendAll(mailData);
        } else {
            await _internalSendToUser(targetNick, mailData);
        }
        
        // Успех
        document.getElementById('admSubject').value = '';
        document.getElementById('admBody').value = '';
        showStatus("ПАКЕТ УСПЕШНО ДОСТАВЛЕН");

    } catch (e) {
        console.error(e);
        showStatus("СБОЙ: " + e.message, true);
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
}

// Внутренние функции (чтобы не зависеть от window.*)
async function _internalSendToUser(nickname, mailData) {
    // 1. Найти UID по нику
    const snapshot = await firebase.database().ref('usernames/' + nickname).once('value');
    if (!snapshot.exists()) throw new Error("ПИЛОТ НЕ НАЙДЕН");
    const targetUid = snapshot.val();
    
    // 2. Отправить в mail
    return firebase.database().ref(`users/${targetUid}/mail`).push(mailData);
}

async function _internalSendAll(mailData) {
    const snapshot = await firebase.database().ref('usernames').once('value');
    const users = snapshot.val();
    if (!users) throw new Error("НЕТ ПОЛЬЗОВАТЕЛЕЙ");
    
    const updates = {};
    Object.values(users).forEach(uid => {
        const newMailKey = firebase.database().ref(`users/${uid}/mail`).push().key;
        updates[`users/${uid}/mail/${newMailKey}`] = mailData;
    });
    
    return firebase.database().ref().update(updates);
}

// ==========================================
// 5. ЛОГИКА ЧИТОВ
// ==========================================
function doCheat(type) {
    if (type === 'credits') {
        const val = parseFloat(document.getElementById('cheatCredits').value);
        if (player) {
            player.credits += val;
            if (window.updateCurrencyUI) window.updateCurrencyUI();
            if (window.saveGameData) window.saveGameData();
            showStatus(`+${val} КРЕДИТОВ`);
        }
    }
    if (type === 'hull') {
        const val = parseFloat(document.getElementById('cheatHull').value);
        if (player) {
            player.hullParts += val;
            if (window.updateBuildUI) window.updateBuildUI();
            if (window.saveGameData) window.saveGameData();
            showStatus(`+${val} ДЕТАЛЕЙ`);
        }
    }
}

initAdminPanel();