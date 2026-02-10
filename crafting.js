
/* crafting.js - Система Крафта (Исправленная логика начисления) */

// --- 1. КОНФИГУРАЦИЯ И ДАННЫЕ ---

const CRAFT_RECIPES = [
    {
        id: 'hull_plating',
        name: 'Каркас Корабля (Hull)',
        type: 'stat', // Тип 'stat' означает, что мы меняем переменную игрока, а не даем предмет в трюм
        statKey: 'hullParts', // Имя переменной в объекте player (player.hullParts)
        outputAmount: 1,
        description: 'Базовый строительный элемент. Используется в меню Инженерии [B] для создания пола и стен.',
        requirements: [
            { id: 'c01', name: 'Железная Руда', count: 2 } // Требует 2 железа
        ]
    }
    // Сюда можно добавлять новые рецепты
];

let craftState = {
    selectedRecipeId: null,
    amount: 1,
    maxAmount: 1
};

// Глобальный флаг для слайдера (чтобы не сбрасывался при выходе мыши за пределы)
window.isSliderDragging = false;

// --- 2. ВНЕДРЕНИЕ СТИЛЕЙ (CSS) ---

function injectCraftingStyles() {
    const styleId = 'crafting-css';
    if (document.getElementById(styleId)) return;

    const css = `
        /* Основное окно */
        #craftingUI {
            display: none;
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            width: 900px;
            height: 550px;
            background: #0b0b0d;
            border: 1px solid #ff7043; /* Оранжевая "индустриальная" тема */
            box-shadow: 0 0 40px rgba(0, 0, 0, 0.9), 0 0 10px rgba(255, 87, 34, 0.2);
            z-index: 160;
            flex-direction: column;
            font-family: 'Orbitron', sans-serif;
            color: #ccc;
            user-select: none;
        }

        /* Заголовок */
        .craft-header {
            height: 40px;
            background: #1a1a1a;
            border-bottom: 1px solid #333;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 15px;
        }
        .craft-title { color: #ff7043; font-weight: bold; letter-spacing: 2px; }
        .craft-close { cursor: pointer; color: #666; font-size: 12px; transition: 0.2s; }
        .craft-close:hover { color: #fff; }

        /* Тело окна */
        .craft-body {
            display: flex;
            flex: 1;
            overflow: hidden;
        }

        /* ЛЕВАЯ ПАНЕЛЬ: Список рецептов */
        .craft-panel-left {
            width: 300px;
            background: #111;
            border-right: 1px solid #333;
            display: flex;
            flex-direction: column;
        }
        .craft-list-header {
            padding: 10px;
            font-size: 12px;
            color: #666;
            background: #0e0e0e;
            border-bottom: 1px solid #222;
        }
        .craft-list-scroll {
            flex: 1;
            overflow-y: auto;
            padding: 5px;
        }
        .recipe-item {
            padding: 12px;
            margin-bottom: 4px;
            background: #181818;
            border: 1px solid #2a2a2a;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .recipe-item:hover { background: #222; border-color: #555; }
        .recipe-item.active {
            background: #2b120a;
            border-color: #ff7043;
            color: #ffccbc;
        }
        .recipe-name { font-size: 12px; font-weight: bold; }
        .recipe-type { font-size: 9px; color: #666; }

        /* ПРАВАЯ ПАНЕЛЬ: Детали и Управление */
        .craft-panel-right {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: #0f0f11;
            position: relative;
        }

        /* Уведомление сверху по центру */
        #craftResultOverlay {
            position: absolute;
            top: 10px; left: 50%;
            transform: translateX(-50%);
            padding: 10px 20px;
            background: rgba(0, 230, 118, 0.1);
            border: 1px solid #00e676;
            color: #00e676;
            font-size: 12px;
            display: none;
            opacity: 0;
            transition: opacity 0.5s;
            pointer-events: none;
            text-shadow: 0 0 5px rgba(0, 230, 118, 0.5);
        }

        .craft-info-area {
            padding: 20px;
            flex: 1;
            border-bottom: 1px solid #222;
        }
        .ci-title { font-size: 20px; color: #ff7043; margin-bottom: 10px; }
        .ci-desc { font-family: 'Roboto', sans-serif; font-size: 12px; color: #888; margin-bottom: 20px; line-height: 1.4; }
        
        /* Сетка требований */
        .req-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-top: 10px;
        }
        .req-card {
            background: #141414;
            border: 1px solid #333;
            padding: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .req-name { font-size: 12px; color: #ccc; }
        .req-stats { display: flex; flex-direction: column; align-items: flex-end; }
        .req-needed { font-size: 14px; color: #ff7043; font-weight: bold; }
        
        .stock-badge {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 2px;
            margin-top: 3px;
            background: #222;
            color: #666;
            border: 1px solid #444;
        }
        .stock-badge.ok { border-color: #00e676; color: #00e676; background: rgba(0, 230, 118, 0.1); }
        .stock-badge.low { border-color: #ff1744; color: #ff1744; background: rgba(255, 23, 68, 0.1); }

        /* Нижняя панель управления */
        .craft-controls {
            height: 120px;
            padding: 20px;
            background: #111;
            display: flex;
            flex-direction: column;
            gap: 15px;
            align-items: center;
            justify-content: center;
        }
        
        .slider-container {
            width: 100%;
            display: flex;
            align-items: center;
            gap: 15px;
            justify-content: center;
        }
        .slider-val { font-size: 18px; color: #fff; width: 40px; text-align: center; }
        
        /* Кастомный слайдер */
        input[type=range] {
            -webkit-appearance: none;
            width: 300px;
            background: transparent;
            cursor: pointer;
        }
        input[type=range]:focus { outline: none; }
        
        /* Дорожка */
        input[type=range]::-webkit-slider-runnable-track {
            width: 100%; height: 6px;
            background: #333;
            border-radius: 3px;
            border: 1px solid #444;
        }
        /* Бегунок */
        input[type=range]::-webkit-slider-thumb {
            -webkit-appearance: none;
            height: 20px; width: 20px;
            border-radius: 50%;
            background: #ff7043;
            margin-top: -8px; /* Центрирование относительно дорожки */
            box-shadow: 0 0 10px rgba(255, 112, 67, 0.8);
            border: 2px solid #fff;
            transition: transform 0.1s;
        }
        input[type=range]:active::-webkit-slider-thumb {
            transform: scale(1.2);
            background: #fff;
            border-color: #ff7043;
        }

        .btn-craft {
            width: 200px;
            height: 45px;
            background: #2b120a;
            border: 1px solid #ff7043;
            color: #ff7043;
            font-family: 'Orbitron';
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: 0.2s;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .btn-craft:hover:not(:disabled) {
            background: #ff7043;
            color: #000;
            box-shadow: 0 0 20px rgba(255, 112, 67, 0.4);
        }
        .btn-craft:disabled {
            border-color: #444;
            color: #555;
            background: #0f0f0f;
            cursor: not-allowed;
        }

        .no-select-msg {
            width: 100%; height: 100%;
            display: flex; align-items: center; justify-content: center;
            color: #444; font-size: 14px;
        }
    `;

    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = css;
    document.head.appendChild(style);
}

// --- 3. ГЕНЕРАЦИЯ UI ---

function createCraftingUI() {
    if (document.getElementById('craftingUI')) return;

    injectCraftingStyles();

    const div = document.createElement('div');
    div.id = 'craftingUI';
    div.innerHTML = `
        <div class="craft-header">
            <span class="craft-title">ВЕРСТАК: ТЕРМИНАЛ</span>
            <span class="craft-close" onclick="window.toggleCrafting(false)">ЗАКРЫТЬ [ESC]</span>
        </div>
        
        <div class="craft-body">
            <div class="craft-panel-left">
                <div class="craft-list-header">ДОСТУПНЫЕ ЧЕРТЕЖИ</div>
                <div class="craft-list-scroll" id="craftList"></div>
            </div>

            <div class="craft-panel-right">
                <div id="craftResultOverlay">УСПЕШНО СОЗДАНО</div>
                
                <div id="craftDetailsContainer" style="display:flex; flex-direction:column; height:100%; width:100%;">
                    <div class="no-select-msg">ВЫБЕРИТЕ ЧЕРТЕЖ ИЗ СПИСКА</div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(div);
}

// --- 4. ЛОГИКА И ВЗАИМОДЕЙСТВИЕ ---

window.toggleCrafting = function(state) {
    if (!document.getElementById('craftingUI')) createCraftingUI();
    
    const ui = document.getElementById('craftingUI');
    const hud = document.getElementById('hud-top-left');

    if (state) {
        ui.style.display = 'flex';
        // Закрываем другие окна
        if (typeof toggleStorage === 'function') toggleStorage(false);
        if (typeof toggleMarket === 'function') toggleMarket(false);
        
        renderCraftList();
        
        // Сброс состояния
        craftState.selectedRecipeId = null;
        document.getElementById('craftDetailsContainer').innerHTML = '<div class="no-select-msg">ВЫБЕРИТЕ ЧЕРТЕЖ ИЗ СПИСКА</div>';
        
        if (hud) hud.style.display = 'none'; 
    } else {
        ui.style.display = 'none';
        if (hud) hud.style.display = 'flex';
    }
    
    // Глобальный флаг (чтобы блокировать движение в main.js)
    window.isCraftingOpen = state; 
};

function renderCraftList() {
    const list = document.getElementById('craftList');
    list.innerHTML = '';

    CRAFT_RECIPES.forEach(recipe => {
        const el = document.createElement('div');
        el.className = 'recipe-item';
        el.id = `recipe-${recipe.id}`;
        
        el.innerHTML = `
            <div>
                <div class="recipe-name">${recipe.name}</div>
                <div class="recipe-type">ТИП: ${recipe.type === 'stat' ? 'УЛУЧШЕНИЕ' : 'ПРЕДМЕТ'}</div>
            </div>
            <div style="color:#555">x${recipe.outputAmount}</div>
        `;
        
        el.onclick = () => selectRecipe(recipe.id);
        list.appendChild(el);
    });
}

function selectRecipe(id) {
    craftState.selectedRecipeId = id;
    craftState.amount = 1;

    // Подсветка активного элемента
    document.querySelectorAll('.recipe-item').forEach(el => el.classList.remove('active'));
    const activeItem = document.getElementById(`recipe-${id}`);
    if(activeItem) activeItem.classList.add('active');

    renderCraftDetails();
}

function getInventoryCount(commodityId) {
    if (!window.placedStorageItems) return 0;
    return window.placedStorageItems.filter(i => i.type === 'cargo' && i.commodityId === commodityId).length;
}

function calculateMaxCraftable(recipe) {
    let max = 999;
    recipe.requirements.forEach(req => {
        const inStock = getInventoryCount(req.id);
        const possible = Math.floor(inStock / req.count);
        if (possible < max) max = possible;
    });
    return max;
}

// --- СПЕЦИАЛЬНАЯ ФУНКЦИЯ ДЛЯ СЛАЙДЕРА (Глобальный захват) ---
function bindCustomSlider(sliderId) {
    const slider = document.getElementById(sliderId);
    if (!slider) return;

    // Обработчик движения мыши (ГЛОБАЛЬНЫЙ)
    const onMouseMove = (e) => {
        if (!window.isSliderDragging) return;
        
        const rect = slider.getBoundingClientRect();
        // Считаем позицию курсора относительно левого края слайдера
        let offsetX = e.clientX - rect.left;
        
        // Ограничиваем рамками
        if (offsetX < 0) offsetX = 0;
        if (offsetX > rect.width) offsetX = rect.width;

        // Переводим в проценты (0.0 - 1.0)
        const percent = offsetX / rect.width;
        
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);
        
        // Вычисляем значение
        let newVal = Math.round(min + (max - min) * percent);
        // Защита от NaN если max=0
        if (isNaN(newVal)) newVal = min;

        // Применяем
        if (slider.value != newVal) {
            slider.value = newVal;
            window.updateCraftAmount(newVal);
        }
    };

    // Остановка перетаскивания
    const onMouseUp = () => {
        if (window.isSliderDragging) {
            window.isSliderDragging = false;
            document.body.style.cursor = 'default';
            // Удаляем глобальные слушатели, чтобы не грузить память
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        }
    };

    // Начало перетаскивания (только на самом слайдере)
    slider.addEventListener('mousedown', (e) => {
        if (slider.disabled) return;
        window.isSliderDragging = true;
        document.body.style.cursor = 'grabbing'; // Меняем курсор на "руку"
        
        // Сразу обновляем позицию при клике
        onMouseMove(e);
        
        // Вешаем слушатели на ОКНО, чтобы ловить уход мыши вверх/вниз
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        
        e.preventDefault(); // Чтобы не выделялся текст вокруг
    });
}

function renderCraftDetails() {
    const container = document.getElementById('craftDetailsContainer');
    const recipe = CRAFT_RECIPES.find(r => r.id === craftState.selectedRecipeId);
    
    if (!recipe) return;

    const maxCraft = calculateMaxCraftable(recipe);
    craftState.maxAmount = maxCraft;
    
    // Коррекция текущего количества
    if (craftState.amount > maxCraft) craftState.amount = Math.max(1, maxCraft);
    if (maxCraft === 0) craftState.amount = 1; // Визуально ставим 1, но кнопка будет недоступна

    // HTML для требований
    let reqHtml = '';
    recipe.requirements.forEach(req => {
        const inStock = getInventoryCount(req.id);
        const neededTotal = req.count * craftState.amount;
        const hasEnough = inStock >= neededTotal;
        const badgeClass = hasEnough ? 'ok' : 'low';

        reqHtml += `
            <div class="req-card">
                <div class="req-name">${req.name}</div>
                <div class="req-stats">
                    <span class="req-needed">x${neededTotal}</span>
                    <span class="stock-badge ${badgeClass}">СКЛАД: ${inStock}</span>
                </div>
            </div>
        `;
    });

    const btnDisabled = maxCraft === 0 ? 'disabled' : '';
    const btnText = maxCraft === 0 ? 'НЕТ РЕСУРСОВ' : 'СОЗДАТЬ';

    // Рендер
    container.innerHTML = `
        <div class="craft-info-area">
            <div class="ci-title">${recipe.name} <span style="font-size:12px; color:#666; margin-left:10px;">ВЫХОД: ${recipe.outputAmount * craftState.amount}</span></div>
            <div class="ci-desc">${recipe.description}</div>
            
            <div style="font-size:10px; color:#666; margin-bottom:5px;">ТРЕБУЕМЫЕ РЕСУРСЫ</div>
            <div class="req-grid">
                ${reqHtml}
            </div>
        </div>

        <div class="craft-controls">
            <div class="slider-container">
                <span style="font-size:10px; color:#888;">КОЛ-ВО</span>
                <input type="range" id="craftQtySlider" min="1" max="${Math.max(1, maxCraft)}" value="${craftState.amount}" 
                       ${maxCraft === 0 ? 'disabled' : ''}>
                <span class="slider-val" id="craftQtyDisplay">${craftState.amount}</span>
            </div>
            
            <button class="btn-craft" onclick="window.performCraft()" ${btnDisabled}>${btnText}</button>
        </div>
    `;

    // ИНИЦИАЛИЗАЦИЯ "УМНОГО" СЛАЙДЕРА
    bindCustomSlider('craftQtySlider');
}

window.updateCraftAmount = function(val) {
    craftState.amount = parseInt(val);
    const display = document.getElementById('craftQtyDisplay');
    if(display) display.innerText = craftState.amount;
    
    // Частичное обновление DOM (цифр), чтобы не сбивать фокус слайдера
    const recipe = CRAFT_RECIPES.find(r => r.id === craftState.selectedRecipeId);
    if(recipe) {
        const reqCards = document.querySelectorAll('.req-card');
        reqCards.forEach((card, idx) => {
            if(recipe.requirements[idx]) {
                const req = recipe.requirements[idx];
                const neededTotal = req.count * craftState.amount;
                const inStock = getInventoryCount(req.id);
                const hasEnough = inStock >= neededTotal;
                
                const neededSpan = card.querySelector('.req-needed');
                const badge = card.querySelector('.stock-badge');
                
                if(neededSpan) neededSpan.innerText = `x${neededTotal}`;
                if(badge) {
                     badge.className = hasEnough ? 'stock-badge ok' : 'stock-badge low';
                }
            }
        });
        const titleSpan = document.querySelector('.ci-title span');
        if(titleSpan) titleSpan.innerText = `ВЫХОД: ${recipe.outputAmount * craftState.amount}`;
    }
};

window.performCraft = function() {
    const recipe = CRAFT_RECIPES.find(r => r.id === craftState.selectedRecipeId);
    if (!recipe) return;

    const max = calculateMaxCraftable(recipe);
    if (craftState.amount > max) return; 

    // 1. Потребление ресурсов
    recipe.requirements.forEach(req => {
        let needed = req.count * craftState.amount;
        
        for (let i = window.placedStorageItems.length - 1; i >= 0; i--) {
            if (needed <= 0) break;
            const item = window.placedStorageItems[i];
            
            if (item.type === 'cargo' && item.commodityId === req.id) {
                window.placedStorageItems.splice(i, 1);
                needed--;
            }
        }
    });

    // 2. Начисление "Каркаса" игроку
    if (recipe.type === 'stat') {
        // !!! ИСПРАВЛЕНИЕ: Используем 'player' напрямую, так как он глобальный, но не в window
        // Проверяем, существует ли переменная player в области видимости
        if (typeof player !== 'undefined' && player[recipe.statKey] !== undefined) {
            player[recipe.statKey] += (recipe.outputAmount * craftState.amount);
            
            // Обновляем счетчик в HUD (x20 -> x21)
            if (window.updateBuildUI) window.updateBuildUI();
        } else {
            console.error("Critical: player object not found for crafting reward.");
        }
    }

    // 3. Визуальные эффекты
    const msg = document.getElementById('craftResultOverlay');
    msg.style.display = 'block';
    void msg.offsetWidth; // Триггер рефлоу для анимации
    msg.style.opacity = '1';
    msg.innerText = `СОЗДАНО: ${recipe.outputAmount * craftState.amount}x ${recipe.name}`;
    
    setTimeout(() => {
        msg.style.opacity = '0';
        setTimeout(() => msg.style.display = 'none', 500);
    }, 2000);

    // Обновляем состояние
    renderCraftDetails();
    if (window.renderStorageGrid) window.renderStorageGrid();
    if (window.saveGameData) window.saveGameData();
};

// Глобальный лиснер закрытия по ESC
document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && document.getElementById('craftingUI') && document.getElementById('craftingUI').style.display === 'flex') {
        window.toggleCrafting(false);
    }
});

