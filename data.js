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

// Игрок
const player = { x: 0, y: 0, radius: 0.35, speed: 0.15, color: '#66bb6a', credits: 0.001 };

// Глобальные состояния
let isDocked = false; 

// Управление
const inputs = { up: false, down: false, left: false, right: false };
let mouseX = 0, mouseY = 0;
let isMouseDown = false; 

// Взаимодействие
const interactables = { 
    bridge: { active: false }, 
    storage: { active: false }, 
    airlock: { active: false }, 
    tradePost: { active: false, x: 0, y: 0 } 
};

function updateCurrencyUI() {
    if (currencyDisplay) {
        currencyDisplay.innerHTML = `${player.credits.toFixed(4)} <span class="sc-symbol">SC</span>`;
    }
}