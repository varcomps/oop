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
// ИСПРАВЛЕНИЕ: Защита теперь использует смещение (Offset), а не XOR, чтобы поддерживать дроби
class SecureValue {
    constructor(value) {
        this._offset = Math.random() * 999999; // Случайное смещение
        this._v = value + this._offset;        // Храним значение со смещением
    }

    get v() {
        return this._v - this._offset; // При чтении убираем смещение
    }

    set v(newValue) {
        // При записи генерируем новое смещение, чтобы значение в памяти менялось
        this._offset = Math.random() * 999999;
        this._v = newValue + this._offset;
        
        // Авто-сохранение в Firebase при изменении
        if (window.saveGameData) window.saveGameData(); 
    }
    
    // Для удобства отображения
    toString() { return (this._v - this._offset).toString(); }
    toFixed(n) { return (this._v - this._offset).toFixed(n); }
}

const rawPlayer = {
    x: 0, 
    y: 0, 
    radius: 0.35, 
    speed: 0.15, 
    color: '#66bb6a',
    // ИСПРАВЛЕНИЕ: Стартовый баланс 0.01 SC
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

// Состояние сканера (для сохранения между закрытиями)
let spectrumState = {
    hasScanned: false, // Было ли произведено сканирование
    signals: [],       // Найденные сигналы
    lockedIndex: -1    // Индекс выбранного
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

function updateCurrencyUI() {
    if (currencyDisplay) {
        // player.credits теперь возвращает число, всё ок
        currencyDisplay.innerHTML = `${player.credits.toFixed(4)} <span class="sc-symbol">SC</span>`;
    }
}