/* radio.js - UPDATED: No Locations + Extreme Market Shifts */

// ==========================================
// 1. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И НАСТРОЙКИ
// ==========================================

const radioUI = document.getElementById('radioUI'); 
const radioHeader = document.getElementById('radioHeader');
const radioLog = document.getElementById('radioLog');
let activeRadioTimeouts = [];
let currentRadioTab = 'general';
let activeChatId = null; 
window.isRadioOpen = false;
window.activeMarketRumor = null; 
window.privateChats = []; 

// Хранилище слушателей Firebase
let contactsRef = null;
let requestsRef = null;
let activeChatListeners = {}; 

// --- ГЕНЕРАТОР ПРОЦЕДУРНЫХ ДИАЛОГОВ (PVE) ---



const ACTIONS = ["сброс груза", "атаку", "сканирование", "стыковку", "ремонт", "добычу"];

// Шаблоны диалогов (Массив объектов-сценариев)
// УБРАНЫ упоминания секторов. ДОБАВЛЕНЫ экстремальные рыночные события.


// 2. Исправленная генерация (разделяем имя для текста и ID для рынка)
// В radio.js функция теперь использует данные из dialogues_db.js
function generateProceduralConversation(itemObj) {
    if (!itemObj) return null;

    // Выбираем шаблон из ВНЕШНЕЙ базы PROCEDURAL_TEMPLATES
    const template = PROCEDURAL_TEMPLATES[Math.floor(Math.random() * PROCEDURAL_TEMPLATES.length)];
    const itemName = itemObj.name || "Груз";
    
    // ЛОГИКА РЫНКА
    if (itemObj.id && (template.type === 'bullish' || template.type === 'bearish')) {
        window.activeMarketRumor = { 
            id: itemObj.id, 
            multiplier: template.multiplier 
        };
        console.log(`[EVENT] ${template.id}: ${itemName} x${template.multiplier}`);
    }

    // Сборка текста (используем PVE_ACTORS из dialogues_db.js)
    return template.steps.map(step => {
        const actorData = PVE_ACTORS[step.role];
        const name = actorData.names[Math.floor(Math.random() * actorData.names.length)];
        let text = step.text.replace(/{ITEM}/g, itemName);
        return { name: name, color: actorData.color, text: text };
    });
}

// ==========================================
// 2. FIREBASE LOGIC (БЭКЕНД)
// ==========================================

function getChatId(uid1, uid2) {
    if (!uid1 || !uid2) return null;
    return uid1 < uid2 ? uid1 + '_' + uid2 : uid2 + '_' + uid1;
}

// 2.1 Отправка заявки
window.saveContactToFirebase = function(targetUid, name) {
    const user = firebase.auth().currentUser;
    if (!user) return Promise.reject("No auth");
    
    const myNick = document.getElementById('nicknameDisplay') ? document.getElementById('nicknameDisplay').innerText : "Unknown";
    const requestPromise = firebase.database().ref('users/' + targetUid + '/requests/' + user.uid).set({
        name: myNick,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });

    const myContactPromise = firebase.database().ref('users/' + user.uid + '/contacts/' + targetUid).set(name);

    return Promise.all([myContactPromise, requestPromise])
        .then(() => {
            window.addToRadioLog("СИСТЕМА: Запрос частоты отправлен пилоту " + name, "#4fc3f7");
        })
        .catch(e => {
            window.addToRadioLog("ОШИБКА: " + (e.code || e.message), "#ff1744");
        });
};

window.acceptRequest = function(targetUid, name) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    firebase.database().ref('users/' + user.uid + '/contacts/' + targetUid).set(name);
    firebase.database().ref('users/' + user.uid + '/requests/' + targetUid).remove();
    window.addToRadioLog("СИСТЕМА: Канал связи с " + name + " установлен.", "#00e676");
};

window.removeContact = function(targetUid, isRequest) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    if (isRequest) {
        firebase.database().ref('users/' + user.uid + '/requests/' + targetUid).remove();
    } else {
        if (confirm("Разорвать связь и удалить частоту?")) {
            firebase.database().ref('users/' + user.uid + '/contacts/' + targetUid).remove()
                .then(() => {
                    if (activeChatId === targetUid) window.closeChat();
                });
        }
    }
};

window.sendFirebaseMessage = function(targetUid, text) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const chatId = getChatId(user.uid, targetUid);
    const msgData = {
        sender: user.uid,
        text: text,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        read: false
    };
    firebase.database().ref('chats/' + chatId).push(msgData);
};

// 2.5 Слушатели
function startRadioListeners(user) {
    cleanupListeners();
    console.log("[Comms] Online as:", user.uid);
    
    contactsRef = firebase.database().ref('users/' + user.uid + '/contacts');
    contactsRef.on('value', (snapshot) => {
        syncContactsList(user, snapshot.val() || {}, 'friend');
    });

    requestsRef = firebase.database().ref('users/' + user.uid + '/requests');
    requestsRef.on('value', (snapshot) => {
        const reqs = snapshot.val() || {};
        let reqMap = {};
        for(let uid in reqs) reqMap[uid] = reqs[uid].name || "Unknown";
        syncContactsList(user, reqMap, 'pending');
    });
}

function syncContactsList(user, data, status) {
    window.privateChats = window.privateChats.filter(c => {
        if (c.status === status && !data.hasOwnProperty(c.id)) return false;
        return true;
    });

    for (let uid in data) {
        let existing = window.privateChats.find(c => c.id === uid);
        if (!existing) {
            window.privateChats.push({
                id: uid, 
                name: data[uid], 
                unread: 0, 
                messages: [],
                status: status
            });
            subscribeToMessagesForUser(user, uid);
        } else {
            if (existing.status !== status) existing.status = status;
            existing.name = data[uid];
        }
    }
    renderContactList();
}

function subscribeToMessagesForUser(user, targetUid) {
    const chatId = getChatId(user.uid, targetUid);
    if (activeChatListeners[chatId]) return;

    const chatRef = firebase.database().ref('chats/' + chatId).limitToLast(50);
    activeChatListeners[chatId] = chatRef;

    chatRef.on('child_added', (snapshot) => {
        const msg = snapshot.val();
        if (!msg) return;

        let chat = window.privateChats.find(c => c.id === targetUid);
        if (!chat) return;

        const isMe = (msg.sender === user.uid);
        const type = isMe ? 'out' : 'in';
        const date = new Date(msg.timestamp);
        const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

        if (!isMe && !msg.read) {
            if (window.isRadioOpen && currentRadioTab === 'personal' && activeChatId === targetUid) {
                snapshot.ref.update({ read: true });
                msg.read = true; 
            }
        }

        const msgObj = { key: snapshot.key, sender: type, text: msg.text, time: timeStr, read: msg.read };
        
        if (!chat.messages.some(m => m.key === snapshot.key)) {
            chat.messages.push(msgObj);
            
            if (window.isRadioOpen && currentRadioTab === 'personal') {
                if (activeChatId === targetUid) {
                    renderChat(targetUid);
                } else {
                    if (type === 'in' && !msg.read) chat.unread++;
                    renderContactList();
                }
            } else {
                if (type === 'in' && !msg.read) {
                     chat.unread++;
                     if(typeof uiHint !== 'undefined') {
                        uiHint.innerHTML = `<span style="color:#00e676; text-shadow:0 0 5px #00e676">INCOMING TRANSMISSION: ${chat.name}</span>`;
                     }
                }
            }
        }
    });

    chatRef.on('child_changed', (snapshot) => {
        const val = snapshot.val();
        let chat = window.privateChats.find(c => c.id === targetUid);
        if (chat) {
            const m = chat.messages.find(msg => msg.key === snapshot.key);
            if (m) {
                m.read = val.read;
                if (activeChatId === targetUid) renderChat(targetUid);
            }
        }
    });
}

function cleanupListeners() {
    if (contactsRef) contactsRef.off();
    if (requestsRef) requestsRef.off();
    for (let id in activeChatListeners) activeChatListeners[id].off();
    activeChatListeners = {};
    window.privateChats = [];
}

// ==========================================
// 3. СТИЛИ (CSS)
// ==========================================
const radioStyles = `
/* Добавить к существующим стилям в radio.js */
    .choice-container {
        display: flex;
        gap: 10px;
        margin: 10px 0;
        flex-wrap: wrap;
    }
    .radio-choice-btn {
        background: rgba(0, 229, 255, 0.1);
        border: 1px solid #00e5ff;
        color: #00e5ff;
        padding: 6px 12px;
        font-family: 'Share Tech Mono', monospace;
        font-size: 11px;
        cursor: pointer;
        transition: 0.2s;
    }
    .radio-choice-btn:hover {
        background: #00e5ff;
        color: #000;
        box-shadow: 0 0 10px #00e5ff;
    }
    .radio-choice-btn:disabled {
        opacity: 0.5;
        cursor: default;
        border-color: #333;
        color: #555;
        background: none;
    }
    #radioUI { 
        width: 700px; height: 550px; 
        display: none; flex-direction: column; 
        background: rgba(10, 15, 20, 0.95); 
        border: 1px solid #00e5ff; 
        box-shadow: 0 0 20px rgba(0, 229, 255, 0.2), inset 0 0 50px rgba(0,0,0,0.8);
        z-index: 150; 
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
        backdrop-filter: blur(5px);
    }
    #radioUI.manual-pos { transform: none !important; margin: 0; }

    .radio-header { 
        padding: 12px; background: rgba(0, 229, 255, 0.1); 
        border-bottom: 1px solid #00e5ff; 
        font-family: 'Orbitron', sans-serif; font-size: 14px; color: #00e5ff; letter-spacing: 1px;
        display: flex; justify-content: space-between; cursor: grab; user-select: none;
        text-shadow: 0 0 5px #00e5ff;
    }
    .close-btn { cursor: pointer; font-size: 12px; opacity: 0.7; transition: 0.3s; }
    .close-btn:hover { color: #ff5252; opacity: 1; text-shadow: 0 0 8px #ff5252; }

    .radio-tabs { display: flex; background: #050505; border-bottom: 1px solid #333; }
    .radio-tab-btn { 
        flex: 1; padding: 10px; background: transparent; border: none; 
        color: #555; font-family: 'Orbitron'; cursor: pointer; transition: 0.3s;
        border-bottom: 2px solid transparent;
    }
    .radio-tab-btn:hover { color: #aaa; background: rgba(255,255,255,0.02); }
    .radio-tab-btn.active { color: #00e5ff; border-bottom: 2px solid #00e5ff; background: rgba(0, 229, 255, 0.05); text-shadow: 0 0 5px rgba(0,229,255,0.5); }

    .radio-body { display: flex; flex-direction: column; flex: 1; overflow: hidden; position: relative; }
    /* Scanlines effect */
    .radio-body::after {
        content: " "; display: block; position: absolute; top: 0; left: 0; bottom: 0; right: 0;
        background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
        z-index: 2; background-size: 100% 2px, 3px 100%; pointer-events: none; opacity: 0.3;
    }

    .radio-view { display: none; flex-direction: column; flex: 1; height: 100%; z-index: 1; }
    .radio-view.active { display: flex; }

    /* Общий эфир */
    .radio-log-container { 
        flex: 1; background: #000; border: 1px solid #333; margin: 10px; padding: 10px; 
        font-family: 'Share Tech Mono', monospace; font-size: 12px; overflow-y: auto; color: #ccc; 
        box-shadow: inset 0 0 10px #000;
    }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: #000; }
    ::-webkit-scrollbar-thumb { background: #333; }
    ::-webkit-scrollbar-thumb:hover { background: #00e5ff; }

    .radio-controls { height: 50px; display: flex; justify-content: center; align-items: center; border-top: 1px solid #333; background: #0b0f14; gap: 10px; }
    .btn-sos { 
        background: rgba(255, 23, 68, 0.1); border: 1px solid #ff1744; color: #ff1744; 
        padding: 8px 25px; font-family: 'Orbitron'; font-size: 12px; cursor: pointer; 
        transition: 0.2s; letter-spacing: 1px;
    }
    .btn-sos:hover { background: #ff1744; color: #fff; box-shadow: 0 0 15px #ff1744; }

    /* ЛИЧНЫЕ СООБЩЕНИЯ */
    .personal-split { display: flex; flex: 1; height: 100%; overflow: hidden; }
    
    .radio-sidebar { width: 220px; border-right: 1px solid #333; display: flex; flex-direction: column; background: #080a0c; }
    .add-contact-row { display: flex; padding: 8px; gap: 5px; border-bottom: 1px solid #333; background: #0f1215; }
    .contact-input { flex: 1; background: #000; border: 1px solid #444; color: #fff; font-family: 'Share Tech Mono'; padding: 5px; font-size: 11px; outline: none; }
    .contact-input:focus { border-color: #00e5ff; }
    .btn-plus { width: 25px; background: #222; border: 1px solid #444; color: #00e5ff; cursor: pointer; }
    .btn-plus:hover { background: #00e5ff; color: #000; }

    .contact-list { flex: 1; overflow-y: auto; padding: 0; }
    
    .contact-item { 
        padding: 10px; border-bottom: 1px solid #222; cursor: pointer; 
        font-family: 'Orbitron'; font-size: 11px; color: #777; transition:0.2s; 
        display: flex; justify-content: space-between; align-items: center;
    }
    .contact-item:hover { background: rgba(0, 229, 255, 0.1); color: #fff; }
    .contact-item.active { background: rgba(0, 229, 255, 0.2); color: #fff; border-left: 3px solid #00e5ff; }
    .contact-item.pending { border-left: 3px solid #d500f9; background: rgba(213, 0, 249, 0.1); }
    
    .btn-del-contact {
        width: 18px; height: 18px; border-radius: 2px;
        display: flex; align-items: center; justify-content: center;
        color: #555; border: 1px solid #333;
        margin-left: 5px; font-weight: bold; font-size: 12px;
        transition: 0.2s;
    }
    .btn-del-contact:hover { color: #ff5252; border-color: #ff5252; background: rgba(255,0,0,0.2); }

    .req-badge { color: #d500f9; font-size: 9px; margin-left: 5px; animation: blink 1s infinite; }

    /* ПАНЕЛЬ ЧАТА */
    .radio-main { flex: 1; display: flex; flex-direction: column; background: #0b0f14; }
    .chat-header-bar { 
        padding: 8px 15px; background: rgba(0,0,0,0.5); border-bottom: 1px solid #333; 
        font-size: 12px; color: #00e5ff; font-family: 'Orbitron'; display: flex; justify-content: space-between; align-items: center;
    }
    
    .chat-console { 
        flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; 
        font-family: 'Roboto Condensed', sans-serif; font-size: 13px; color: #ccc;
    }

    .msg-wrapper { display: flex; width: 100%; margin-bottom: 4px; }
    .msg-wrapper.in { justify-content: flex-start; }
    .msg-wrapper.out { justify-content: flex-end; }

    .msg-bubble {
        max-width: 75%;
        padding: 10px 14px;
        border-radius: 2px;
        position: relative;
        line-height: 1.4;
        font-size: 13px;
    }

    .msg-wrapper.in .msg-bubble { background: #1c2329; border-left: 2px solid #546e7a; color: #cfd8dc; }
    .msg-wrapper.out .msg-bubble { background: #003d33; border-right: 2px solid #00e676; color: #e0f2f1; }

    .msg-meta {
        display: flex; justify-content: flex-end; align-items: center;
        gap: 6px; margin-top: 5px; font-size: 10px; opacity: 0.6; font-family: 'Share Tech Mono';
    }

    .read-status.read { color: #00e5ff; text-shadow: 0 0 3px #00e5ff; } 
    .read-status.unread { color: #555; }   

    .chat-input-bar { padding: 10px; border-top: 1px solid #333; display: flex; gap: 8px; background: #0f1215; }
    .msg-input { 
        flex: 1; background: #050505; border: 1px solid #333; color: #00e5ff; 
        padding: 10px; font-family: 'Share Tech Mono'; font-size: 12px; outline: none; 
    }
    .msg-input:focus { border-color: #00e5ff; box-shadow: 0 0 5px rgba(0,229,255,0.2); }
    .btn-send { 
        background: #1a2327; border: 1px solid #00e5ff; color: #00e5ff; 
        padding: 0 20px; cursor: pointer; font-family: 'Orbitron'; font-size: 11px; 
        transition: 0.2s;
    }
    .btn-send:hover { background: #00e5ff; color: #000; box-shadow: 0 0 10px #00e5ff; }
    
    .input-error { animation: blinkError 0.4s ease-in-out; border-color: #ff1744 !important; }
    @keyframes blinkError { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
`;

function injectRadioStyles() {
    const styleSheet = document.createElement("style");
    styleSheet.innerText = radioStyles;
    document.head.appendChild(styleSheet);
}

// ==========================================
// 4. UI ИНИЦИАЛИЗАЦИЯ И PERSISTENCE (ЛОГ)
// ==========================================

function initRadioInterface() {
    injectRadioStyles();
    const old = document.getElementById('radioUI');
    if (old) old.remove();

    const html = `
    <div id="radioUI">
        <div class="radio-header" id="radioHeader">
            <span>QUANTUM LINK SYSTEM</span>
            <span class="close-btn" onclick="toggleRadio(false)">[TERMINATE]</span>
        </div>
        <div class="radio-tabs">
            <button class="radio-tab-btn active" id="tab-general" onclick="switchRadioTab('general')">PUBLIC ETHER</button>
            <button class="radio-tab-btn" id="tab-personal" onclick="switchRadioTab('personal')">ENCRYPTED</button>
        </div>
        <div class="radio-body"> 
            <div id="view-general" class="radio-view active">
                <div class="radio-log-container" id="radioLog"></div>
                <div class="radio-controls">
                    <button class="btn-sos" onclick="requestDistressCall()">BROADCAST SOS (0.001 SC)</button>
                </div>
            </div>
            <div id="view-personal" class="radio-view">
                <div class="personal-split">
                    <div class="radio-sidebar">
                        <div class="add-contact-row">
                            <input type="text" id="addContactInput" class="contact-input" placeholder="Frequency ID (Nick)...">
                            <button class="btn-plus" onclick="confirmNewChat()">+</button>
                        </div>
                        <div id="personal-contacts" class="contact-list"></div>
                    </div>
                    <div class="radio-main">
                        <div class="chat-header-bar" id="chat-header-bar">
                            <span id="chat-contact-name">NO CONNECTION</span>
                        </div>
                        <div id="chat-history" class="chat-console">
                            <div style="color:#444; text-align:center; margin-top:50px; font-family:'Orbitron'">AWAITING CONNECTION...</div>
                        </div>
                        <div class="chat-input-bar">
                            <input type="text" id="chatInput" class="msg-input" placeholder="Transmission data...">
                            <button class="btn-send" onclick="sendPrivateMessage()">SEND</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    
    document.getElementById('addContactInput').addEventListener('keydown', (e) => { e.stopPropagation(); if(e.key === 'Enter') confirmNewChat(); });
    document.getElementById('chatInput').addEventListener('keydown', (e) => { e.stopPropagation(); if(e.key === 'Enter') sendPrivateMessage(); });

    makeDraggable(document.getElementById('radioUI'), document.getElementById('radioHeader'));
    
}


initRadioInterface();

// ==========================================
// 5. ФУНКЦИИ ИНТЕРФЕЙСА
// ==========================================

window.toggleRadio = function(state) {
    if (typeof transition !== 'undefined' && transition.active) return;
    window.isRadioOpen = state;
    const ui = document.getElementById('radioUI');
    if (ui) {
        ui.style.display = state ? 'flex' : 'none';
        if (state) {
            if (typeof inputs !== 'undefined') { inputs.up = false; inputs.down = false; inputs.left = false; inputs.right = false; }
            if (currentRadioTab === 'personal') {
                renderContactList();
                if (activeChatId) {
                    const h = document.getElementById('chat-history');
                    if(h) h.scrollTop = h.scrollHeight;
                }
            } else {
                const log = document.getElementById('radioLog');
                if(log) log.scrollTop = log.scrollHeight;
            }
        }
    }
};

window.switchRadioTab = function(tab) {
    currentRadioTab = tab;
    document.querySelectorAll('.radio-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.radio-view').forEach(v => v.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    document.getElementById(`view-${tab}`).classList.add('active');
    if (tab === 'personal') renderContactList();
};

window.confirmNewChat = async function() {
    const input = document.getElementById('addContactInput');
    const nick = input.value ? input.value.trim() : "";
    if (!nick) return;

    const myNick = document.getElementById('nicknameDisplay') ? document.getElementById('nicknameDisplay').innerText : "PILOT";
    if (nick === myNick) return;

    if (window.findUserByNickname) {
        input.disabled = true;
        try {
            const targetUid = await window.findUserByNickname(nick);
            if (targetUid) {
                await window.saveContactToFirebase(targetUid, nick);
                input.value = ''; input.blur(); 
            } else {
                triggerInputError(input);
            }
        } catch (e) {
            triggerInputError(input);
        } finally {
            input.disabled = false; input.focus();
        }
    }
};

function triggerInputError(el) {
    el.classList.add('input-error');
    setTimeout(() => el.classList.remove('input-error'), 400);
}

// 5.1 Рендер списка контактов
function renderContactList() {
    const container = document.getElementById('personal-contacts');
    container.innerHTML = '';
    
    if (window.privateChats.length === 0) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:#333;font-size:10px;">NO FREQUENCIES</div>';
        return;
    }
    
    window.privateChats.sort((a, b) => {
        if (a.status === 'pending') return -1;
        if (b.status === 'pending') return 1;
        return 0; 
    });

    window.privateChats.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'contact-item';
        
        const infoDiv = document.createElement('div');
        infoDiv.style.flex = "1";
        
        if (chat.status === 'pending') {
            item.classList.add('pending');
            infoDiv.innerHTML = `<span>${chat.name}</span><span class="req-badge">REQ</span>`;
            item.onclick = () => window.acceptRequest(chat.id, chat.name);
        } else {
            if (chat.id === activeChatId) item.classList.add('active');
            
            const badge = chat.unread > 0 ? `<span style="color:#00e676;font-weight:bold;margin-left:5px;">[${chat.unread}]</span>` : '';
            infoDiv.innerHTML = `<span style="overflow:hidden;text-overflow:ellipsis;">${chat.name}</span>${badge}`;
            
            item.onclick = () => openChat(chat.id);
        }

        const delBtn = document.createElement('div');
        delBtn.className = 'btn-del-contact';
        delBtn.innerText = '×';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            window.removeContact(chat.id, chat.status === 'pending');
        };

        item.appendChild(infoDiv);
        item.appendChild(delBtn);
        container.appendChild(item);
    });
}

function openChat(chatId) {
    activeChatId = chatId;
    const chat = window.privateChats.find(c => c.id === chatId);
    const headerName = document.getElementById('chat-contact-name');
    if(headerName && chat) headerName.innerText = "LINKED: " + chat.name.toUpperCase();

    if (chat) {
        chat.unread = 0; 
        const user = firebase.auth().currentUser;
        if (user) {
            const chatRef = firebase.database().ref('chats/' + getChatId(user.uid, chatId));
            chat.messages.forEach(m => {
                if (m.sender === 'in' && !m.read) {
                    chatRef.child(m.key).update({read: true});
                    m.read = true;
                }
            });
        }
    }
    
    renderContactList(); 
    renderChat(chatId);
}

window.closeChat = function() {
    activeChatId = null;
    document.getElementById('chat-contact-name').innerText = "NO CONNECTION";
    document.getElementById('chat-history').innerHTML = '<div style="color:#444; text-align:center; margin-top:50px; font-family:\'Orbitron\'">AWAITING CONNECTION...</div>';
    renderContactList();
}

function renderChat(chatId) {
    const history = document.getElementById('chat-history');
    history.innerHTML = '';
    const chat = window.privateChats.find(c => c.id === chatId);
    if (!chat) return;
    
    chat.messages.forEach(msg => {
        const wrapper = document.createElement('div');
        wrapper.className = `msg-wrapper ${msg.sender}`;
        
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        
        let ticks = '';
        if (msg.sender === 'out') {
            const statusClass = msg.read ? 'read' : 'unread';
            const tickIcon = msg.read ? '///' : '/';
            ticks = `<span class="read-status ${statusClass}">${tickIcon}</span>`;
        }

        bubble.innerHTML = `
            <div>${msg.text}</div>
            <div class="msg-meta">
                <span>${msg.time}</span>
                ${ticks}
            </div>
        `;
        
        wrapper.appendChild(bubble);
        history.appendChild(wrapper);
    });
    
    history.scrollTop = history.scrollHeight;
}

window.sendPrivateMessage = function() {
    if (!activeChatId) return;
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    window.sendFirebaseMessage(activeChatId, text);
};


// ==========================================
// 6. ЛОГИКА ОБЩЕГО ЭФИРА (PVE) - ОБНОВЛЕННАЯ
// ==========================================

window.addToRadioLog = function(msg, color = "#ccc") {
    const log = document.getElementById('radioLog');
    if (!log) return;
    const line = document.createElement('div');
    line.style.color = color;
    line.style.marginBottom = "6px";
    line.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
    line.style.paddingBottom = "4px";
    line.style.wordWrap = "break-word";
    const time = new Date().toLocaleTimeString('ru-RU', { hour12: false });
    line.innerHTML = `<span style="opacity:0.5;font-size:10px;margin-right:8px;color:#00e5ff;">[${time}]</span>${msg}`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
    
};

window.requestDistressCall = function() {
    const cost = 0.001;
    if (typeof player !== 'undefined' && player.credits < cost) return window.addToRadioLog("SYSTEM: INSUFFICIENT CREDITS", "#ff1744");
    if (typeof player !== 'undefined') player.credits -= cost;
    if (window.updateCurrencyUI) window.updateCurrencyUI();
    
    window.addToRadioLog("YOU: MAYDAY! MAYDAY! CURRENT COORDS", "#ff5252");
    
    setTimeout(() => {
        window.addToRadioLog("RESCUE BOT: Coordinates received. Dropping fuel packs.", "#00e676");
        if (window.tryAutoBuy) { window.tryAutoBuy('fuel', 2, 1, 0); }
        if (window.updateBuildUI) window.updateBuildUI();
    }, 2000);
};

// Функция проигрывания диалога
// --- НОВЫЙ МЕТОД: Удаление кнопок при потере связи (Варп) ---
window.clearRadioChoices = function() {
    // 1. ОСТАНАВЛИВАЕМ вывод всех запланированных сообщений
    activeRadioTimeouts.forEach(t => clearTimeout(t));
    activeRadioTimeouts = [];

    // 2. Удаляем контейнеры с кнопками (без лишних сообщений в лог)
    const containers = document.querySelectorAll('.choice-container');
    containers.forEach(container => {
        container.style.opacity = '0';
        container.style.pointerEvents = 'none';
        setTimeout(() => container.remove(), 300);
    });
};
function playProceduralDialogue(conversation, template = null) {
    // На всякий случай чистим старые таймеры перед новым диалогом
    activeRadioTimeouts.forEach(t => clearTimeout(t));
    activeRadioTimeouts = [];

    let delay = 0;
    
    conversation.forEach((line, index) => {
        const timeoutId = setTimeout(() => {
            window.addToRadioLog(`${line.name}: "${line.text}"`, line.color);
            
            if (index === conversation.length - 1 && template && template.choices) {
                const choiceTimeoutId = setTimeout(() => {
                    showRadioChoices(template.choices, line);
                }, 500);
                activeRadioTimeouts.push(choiceTimeoutId);
            }
        }, delay);

        activeRadioTimeouts.push(timeoutId);
        delay += 500 + (line.text.length * 20);
    });
}
function showRadioChoices(choices, lastActor) {
    const log = document.getElementById('radioLog');
    if (!log) return;

    const container = document.createElement('div');
    container.className = 'choice-container';

    choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'radio-choice-btn';
        btn.innerText = choice.text;
        
        btn.onclick = () => {
            // Деактивируем все кнопки в этом блоке после клика
            container.querySelectorAll('button').forEach(b => b.disabled = true);
            
            // 1. Выводим ответ игрока
            window.addToRadioLog(`ВЫ: "${choice.text}"`, "#fff");
            
            // 2. Через паузу NPC отвечает на этот выбор
            setTimeout(() => {
                window.addToRadioLog(`${lastActor.name}: "${choice.reaction}"`, lastActor.color);
            }, 1200);
        };
        
        container.appendChild(btn);
    });

    log.appendChild(container);
    log.scrollTop = log.scrollHeight;
}
window.checkIncomingTransmission = function() {
    if (Math.random() > 0.5) return; // Выход из функции в 50% случаев
    let items = (typeof COMMODITY_DB !== 'undefined') ? COMMODITY_DB : [];
    if (window.marketState && window.marketState.items) items = window.marketState.items;
    if (items.length === 0) return;

    const totalWeight = PROCEDURAL_TEMPLATES.reduce((sum, t) => sum + (t.weight || 10), 0);
    let random = Math.random() * totalWeight;
    let selectedTemplate = PROCEDURAL_TEMPLATES[0];

    for (let t of PROCEDURAL_TEMPLATES) {
        if (random < (t.weight || 10)) {
            selectedTemplate = t;
            break;
        }
        random -= (t.weight || 10);
    }

    const targetItemObj = items[Math.floor(Math.random() * items.length)];
    const conversation = generateProceduralFromTemplate(targetItemObj, selectedTemplate);
    
    if (conversation) {
        // ПЕРЕДАЕМ TEMPLATE в функцию проигрывания
        playProceduralDialogue(conversation, selectedTemplate);
    }
}
function generateProceduralFromTemplate(itemObj, template) {
    const itemName = itemObj.name || "Груз";
    
    // ЛОГИКА РЫНКА
    if (itemObj.id && (template.type === 'bullish' || template.type === 'bearish')) {
        window.activeMarketRumor = { 
            id: itemObj.id, 
            multiplier: template.multiplier 
        };
        console.log(`[EVENT] ${template.id}: x${template.multiplier} rarity applied.`);
    }

    return template.steps.map(step => {
        const actorData = PVE_ACTORS[step.role];
        const name = actorData.names[Math.floor(Math.random() * actorData.names.length)];
        let text = step.text.replace(/{ITEM}/g, itemName);
        return { name: name, color: actorData.color, text: text };
    });
}

// ==========================================
// 7. DRAG & DROP UTILITY
// ==========================================

function makeDraggable(elmnt, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    if (handle) handle.onmousedown = dragMouseDown;
    else elmnt.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        const style = window.getComputedStyle(elmnt);
        if (style.transform !== 'none') {
            const rect = elmnt.getBoundingClientRect();
            elmnt.style.left = rect.left + 'px';
            elmnt.style.top = rect.top + 'px';
            elmnt.classList.add('manual-pos'); 
        }
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }
    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
        elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
    }
    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

// ==========================================
// 8. ЗАПУСК
// ==========================================
if (typeof firebase !== 'undefined') {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            startRadioListeners(user);
        } else {
            cleanupListeners();
        }
    });
}