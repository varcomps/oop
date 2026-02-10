
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiHint = document.getElementById('ui-hint');
const currencyDisplay = document.getElementById('currencyDisplay');

// --- КОНФИГУРАЦИЯ ---
const TARGET_COLS = 32;
const TARGET_ROWS = 18;
let TILE_SIZE = 50;

// Смещение камеры
let viewOffset = { x: 0, y: 0 };

const STATE_MENU = 0, STATE_SHIP = 1, STATE_MAP = 2, STATE_HANGAR = 3;
let currentState = STATE_MENU;
let transition = { active: false, alpha: 0, direction: 1, targetState: null };
let time = 0;

// Игрок (hullParts - инвентарь каркаса)
class SecureValue {
    constructor(value) {
        this._offset = Math.random() * 999999; 
        this._v = value + this._offset;        
    }

    get v() {
        return this._v - this._offset; 
    }

    set v(newValue) {
        // Округляем до 6 знаков при записи
        newValue = Math.round(newValue * 1000000) / 1000000;
        this._offset = Math.random() * 999999;
        this._v = newValue + this._offset;
        
        if (window.saveGameData) window.saveGameData(); 
    }
    
    toString() { return (this._v - this._offset).toString(); }
    toFixed(n) { return (this._v - this._offset).toFixed(n); }
}

const rawPlayer = {
    x: 0, 
    y: 0, 
    radius: 0.35, 
    speed: 0.15, 
    color: '#66bb6a',
    _credits: new SecureValue(0.01),
    _hullParts: new SecureValue(0),
    _fuel: new SecureValue(0) 
};

const player = new Proxy(rawPlayer, {
    get: function(target, prop) {
        if (prop === 'credits') return target._credits.v;
        if (prop === 'hullParts') return target._hullParts.v;
        return target[prop];
    },
    set: function(target, prop, value) {
        if (prop === 'credits') {
            target._credits.v = value;
            return true;
        }
        if (prop === 'hullParts') {
            target._hullParts.v = value;
            return true;
        }
        target[prop] = value;
        return true;
    }
});

// Глобальные состояния
let isDocked = false; 
let isSpectrumOpen = false;
let isMarketOpen = false; 

// Целеуказание прыжка
let currentSystemType = 'station';
let nextJumpTarget = null; 
let pendingJumpCost = 0;   

// Состояние сканера
let spectrumState = {
    hasScanned: false, 
    signals: [],       
    lockedIndex: -1    
};

// Управление
const inputs = { up: false, down: false, left: false, right: false };
let mouseX = 0, mouseY = 0;
let isMouseDown = false; 

// Взаимодействие
const interactables = { 
    bridge: { active: false }, 
    storage: { active: false }, 
    airlock: { active: false }, 
    tradePost: { active: false, x: 0, y: 0 },
    engineering: { active: false, x: 0, y: 0 },
    commodities: { active: false, x: 0, y: 0 } 
};

// [ОБНОВЛЕНИЕ] Форматирование: Градиент серого к центру (Без смены шрифта)
window.formatCurrencyFancy = function(amount) {
    const val = parseFloat(amount);
    const fixed = isNaN(val) ? "0.00000" : val.toFixed(5);
    
    const parts = fixed.split('.');
    const integerPart = parts[0];
    const dec = parts[1]; // Строка из 5 цифр

    // Целая часть и точка - СЕРЫЕ
    const intHtml = `<span style="color: #666;">${integerPart}.</span>`;

    // Дробная часть - Эффект затухания (Fade out) от центра
    const decHtml = 
           `<span style="color: #666;">${dec[0]}</span>` +
           `<span style="color: #bbb;">${dec[1]}</span>` +
           `<span style="color: #fff; font-weight: 900; text-shadow: 0 0 8px rgba(255,255,255,0.6);">${dec[2]}</span>` +
           `<span style="color: #bbb;">${dec[3]}</span>` +
           `<span style="color: #666;">${dec[4]}</span>`;
           
    return intHtml + decHtml;
};

function updateCurrencyUI() {
    if (currencyDisplay) {
        const fancyMoney = window.formatCurrencyFancy(player.credits);
        currencyDisplay.innerHTML = `${fancyMoney} <span class="sc-symbol">SC</span>`;
    }
}
