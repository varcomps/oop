/* radio.js - Система связи: Эфир, Личные чаты, Drag&Drop */

const radioUI = document.getElementById('radioUI');
const radioHeader = document.getElementById('radioHeader');
const radioLog = document.getElementById('radioLog');

// Стейт вкладок
let currentRadioTab = 'general';
let activeChatId = null;

window.isRadioOpen = false;
window.activeMarketRumor = null; 

// --- ДАННЫЕ ЛИЧНЫХ СООБЩЕНИЙ ---
// Структура: { id: 'sys', name: 'SYSTEM', unread: 0, messages: [] }
window.privateChats = []; // Теперь пустой при старте

// --- СЦЕНАРИИ ОБЩЕГО ЭФИРА (Рынок) ---
const SCENARIOS_BULLISH = [
    [{ name: "ДАЛЬНОБОЙЩИК", color: "#fff176", text: "Слышал новости? На главном заводе в секторе авария." }, { name: "ДИСПЕТЧЕР", color: "#4fc3f7", text: "Подтверждаю. Производство встало. Запасов {ITEM} хватит на пару часов." }, { name: "ДАЛЬНОБОЙЩИК", color: "#fff176", text: "Значит, к вечеру цена взлетит до небес." }],
    [{ name: "ПИРАТ", color: "#ff5252", text: "Мы перекрыли поставки {ITEM}." }, { name: "ТОРГОВЕЦ", color: "#ef9a9a", text: "Черт, дефицит уже начался!" }],
    [{ name: "ШИФР-КАНАЛ", color: "#b39ddb", text: "...массовая скупка {ITEM}. Директива 7." }, { name: "АГЕНТ", color: "#9575cd", text: "Принято. Искусственный спрос поднимет котировки." }]
];
const SCENARIOS_BEARISH = [
    [{ name: "ШАХТЕР", color: "#ffa726", text: "Нашли гигантскую жилу {ITEM}! Просто завались!" }, { name: "БАЗА", color: "#ffb74d", text: "Ты обвалишь рынок, идиот!" }],
    [{ name: "ПОЛИЦИЯ", color: "#4fc3f7", text: "Конфискат {ITEM} выброшен на аукцион." }, { name: "АУКЦИОН", color: "#81d4fa", text: "Продаем по любой цене." }],
    [{ name: "ТЕХНИК", color: "#a1887f", text: "{ITEM} устарел. Вышла новая модель." }, { name: "СКЛАД", color: "#d7ccc8", text: "Сливай запасы, пока они хоть что-то стоят." }]
];
const SCENARIOS_FLAVOR = [
    [{ name: "НЕИЗВЕСТНЫЙ", color: "#9e9e9e", text: "...помогите... воздух конча..." }, { name: "СИСТЕМА", color: "#ff5252", text: "СИГНАЛ ПОТЕРЯН." }],
    [{ name: "ПАТРУЛЬ", color: "#4fc3f7", text: "Борт 7-2-9, заглушить двигатели!" }, { name: "КОНТРАБАНДИСТ", color: "#e040fb", text: "Поймай меня, если сможешь!" }]
];

// --- ИНИЦИАЛИЗАЦИЯ ---
// Вызывается один раз при загрузке main.js (если нужно) или при первом открытии
function initRadioDraggable() {
    if (radioUI && radioHeader) {
        makeDraggable(radioUI, radioHeader);
    }
}
// Вызовем сразу, чтобы инициализировать обработчики
setTimeout(initRadioDraggable, 100);


// --- ФУНКЦИИ УПРАВЛЕНИЯ UI ---

window.toggleRadio = function(state) {
    if (typeof transition !== 'undefined' && transition.active) return;
    window.isRadioOpen = state;
    
    if (radioUI) {
        radioUI.style.display = state ? 'flex' : 'none';
        
        if (state) {
            if (typeof inputs !== 'undefined') {
                inputs.up = false; inputs.down = false; inputs.left = false; inputs.right = false;
            }
            // Обновляем список контактов при открытии
            if (currentRadioTab === 'personal') renderContactList();
            
            // Скролл лога вниз
            if(radioLog) radioLog.scrollTop = radioLog.scrollHeight;
        }
    }
}

window.switchRadioTab = function(tabName) {
    currentRadioTab = tabName;
    
    // UI кнопок
    document.querySelectorAll('.radio-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    // UI контента
    document.querySelectorAll('.radio-view').forEach(view => view.classList.remove('active'));
    document.getElementById(`view-${tabName}`).classList.add('active');

    if (tabName === 'personal') {
        renderContactList();
        // Если чат был открыт, обновляем его, иначе показываем список
        if (activeChatId) {
            document.getElementById('personal-contacts').style.display = 'none';
            document.getElementById('personal-chat').style.display = 'flex';
        } else {
            document.getElementById('personal-contacts').style.display = 'flex';
            document.getElementById('personal-chat').style.display = 'none';
        }
    }
}

// --- ЛОГИКА ЛИЧНЫХ СООБЩЕНИЙ ---

// API для получения сообщения от "игры"
window.receivePrivateMessage = function(chatId, chatName, text) {
    let chat = window.privateChats.find(c => c.id === chatId);
    const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    
    if (!chat) {
        chat = { id: chatId, name: chatName, unread: 0, messages: [] };
        window.privateChats.unshift(chat); // Добавляем в начало
    }
    
    chat.messages.push({ sender: 'in', text: text, time: time });
    
    // Если мы НЕ в этом чате прямо сейчас - увеличиваем счетчик
    if (!window.isRadioOpen || currentRadioTab !== 'personal' || activeChatId !== chatId) {
        chat.unread++;
        
        // Визуальная подсказка в HUD
        if(typeof uiHint !== 'undefined') {
            const oldHint = uiHint.innerHTML;
            uiHint.innerHTML = `<span style="color:#00e676">СООБЩЕНИЕ ОТ: ${chatName}</span>`;
            setTimeout(() => { if(uiHint.innerHTML.includes("СООБЩЕНИЕ")) uiHint.innerHTML = oldHint; }, 3000);
        }
    } else {
        // Если чат открыт - сразу рендерим
        renderChat(chatId);
    }
    
    // Если открыт список контактов - обновляем
    if (window.isRadioOpen && currentRadioTab === 'personal' && !activeChatId) {
        renderContactList();
    }
}

function renderContactList() {
    const container = document.getElementById('personal-contacts');
    container.innerHTML = '';
    
    if (window.privateChats.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center; color:#444; font-size:12px;">НЕТ ДИАЛОГОВ</div>';
        return;
    }

    window.privateChats.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'contact-item';
        if (chat.unread > 0) item.classList.add('has-unread');
        
        const lastMsg = chat.messages.length > 0 ? chat.messages[chat.messages.length-1].text : '';
        const preview = lastMsg.length > 30 ? lastMsg.substring(0, 30) + '...' : lastMsg;
        
        item.innerHTML = `
            <div>
                <div class="contact-name">${chat.name}</div>
                <div style="opacity:0.6; margin-top:2px;">${preview}</div>
            </div>
            ${chat.unread > 0 ? `<div class="unread-badge">${chat.unread}</div>` : ''}
        `;
        
        item.onclick = () => openChat(chat.id);
        container.appendChild(item);
    });
}

function openChat(chatId) {
    activeChatId = chatId;
    
    // Сбрасываем непрочитанные
    const chat = window.privateChats.find(c => c.id === chatId);
    if (chat) chat.unread = 0;
    
    document.getElementById('personal-contacts').style.display = 'none';
    const chatView = document.getElementById('personal-chat');
    chatView.style.display = 'flex';
    
    document.getElementById('chat-contact-name').innerText = chat ? chat.name : 'UNKNOWN';
    
    renderChat(chatId);
}

window.closeChat = function() {
    activeChatId = null;
    document.getElementById('personal-chat').style.display = 'none';
    document.getElementById('personal-contacts').style.display = 'flex';
    renderContactList(); // Обновить счетчики (сбросить badge)
}

function renderChat(chatId) {
    const historyContainer = document.getElementById('chat-history');
    historyContainer.innerHTML = '';
    
    const chat = window.privateChats.find(c => c.id === chatId);
    if (!chat) return;
    
    chat.messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = `chat-msg ${msg.sender === 'in' ? 'incoming' : 'outgoing'}`;
        div.innerHTML = `
            <span class="chat-msg-time">${msg.time}</span>
            ${msg.text}
        `;
        historyContainer.appendChild(div);
    });
    
    // Скролл вниз
    historyContainer.scrollTop = historyContainer.scrollHeight;
}

// --- ЛОГИКА ОБЩЕГО ЭФИРА (СТАРАЯ) ---

window.addToRadioLog = function(msg, color = "#ccc") {
    if (!radioLog) return;
    const line = document.createElement('div');
    line.style.color = color;
    line.style.marginBottom = "4px";
    line.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
    line.style.paddingBottom = "2px";
    line.style.wordWrap = "break-word";
    const time = new Date().toLocaleTimeString('ru-RU', { hour12: false });
    line.innerHTML = `<span style="opacity:0.5; font-size:10px; margin-right:5px;">[${time}]</span>${msg}`;
    radioLog.appendChild(line);
    radioLog.scrollTop = radioLog.scrollHeight;
}

window.requestDistressCall = function() {
    const cost = 0.001;
    if (player.credits < cost) {
        window.addToRadioLog("ОШИБКА: Недостаточно средств для сигнала SOS.", "#ff1744");
        return;
    }
    player.credits -= cost;
    if (window.updateCurrencyUI) window.updateCurrencyUI();
    window.addToRadioLog("ИСХОДЯЩИЙ: Mayday! Запрашиваю экстренную помощь.", "#ff5252");
    
    setTimeout(() => {
        window.addToRadioLog("ВХОДЯЩИЙ: Спасательная служба. Сбрасываем топливный пакет.", "#00e676");
        if (window.tryAutoBuy) {
            window.tryAutoBuy('fuel', 2, 1, 0); 
            window.tryAutoBuy('fuel', 2, 1, 0);
        }
        if (window.updateBuildUI) window.updateBuildUI();
        window.addToRadioLog("СИСТЕМА: Получено: 2x Топливо.", "#ffd700");
    }, 1500);
}

function playRadioScenario(scenario, itemName) {
    let delay = 0;
    scenario.forEach((line, index) => {
        setTimeout(() => {
            let text = line.text;
            if (itemName) text = text.replace(/{ITEM}/g, itemName);
            window.addToRadioLog(`${line.name}: "${text}"`, line.color);
        }, delay);
        delay += 1500 + Math.random() * 1000;
    });
}

window.checkIncomingTransmission = function() {
    let items = null;
    if (typeof window.COMMODITY_DB !== 'undefined') items = window.COMMODITY_DB;
    else if (typeof window.marketState !== 'undefined') items = window.marketState.items;

    if (!items || items.length === 0) return;

    if (Math.random() < 0.5) {
        const scenario = SCENARIOS_FLAVOR[Math.floor(Math.random() * SCENARIOS_FLAVOR.length)];
        playRadioScenario(scenario, null);
        return;
    }

    const targetItem = items[Math.floor(Math.random() * items.length)];
    const isBullish = Math.random() > 0.5;
    
    window.activeMarketRumor = {
        id: targetItem.id,
        multiplier: isBullish ? 3.0 : 0.2, 
        name: targetItem.name
    };

    let scenarioList = isBullish ? SCENARIOS_BULLISH : SCENARIOS_BEARISH;
    const scenario = scenarioList[Math.floor(Math.random() * scenarioList.length)];
    playRadioScenario(scenario, targetItem.name);
}

// --- УТИЛИТА DRAG & DROP ---

function makeDraggable(elmnt, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    if (handle) {
        handle.onmousedown = dragMouseDown;
    } else {
        elmnt.onmousedown = dragMouseDown;
    }

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        
        // При первом клике снимаем CSS центрирование (transform: translate)
        // и заменяем его на конкретные пиксели top/left
        const style = window.getComputedStyle(elmnt);
        if (style.transform !== 'none') {
            const rect = elmnt.getBoundingClientRect();
            elmnt.style.left = rect.left + 'px';
            elmnt.style.top = rect.top + 'px';
            elmnt.classList.add('manual-pos'); // Класс, отключающий transform в CSS
        }
        
        // Получаем позицию курсора
        pos3 = e.clientX;
        pos4 = e.clientY;
        
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        
        // Вычисляем смещение
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        
        // Устанавливаем новую позицию
        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
        elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}