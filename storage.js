const storageUI = document.getElementById('storageUI');
const sidePanel = document.getElementById('sidePanel');
const gridContainer = document.getElementById('gridContainer');
const storageList = document.getElementById('storageList');
const storageGhost = document.getElementById('storageGhost');
const storageTitle = document.getElementById('storageTitle');
const fuelValUI = document.getElementById('fuelVal');

let placedStorageItems = [];
let holdingItemData = null; 
let isTradeMode = false;
let isStorageOpen = false;

// Инициализация сетки
for(let i=0; i<100; i++) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    cell.onclick = () => handleStorageGridClick(i);
    cell.onmousemove = (e) => handleStorageGridHover(e, i);
    gridContainer.appendChild(cell);
}
gridContainer.onmouseleave = () => { storageGhost.style.display = 'none'; };

window.addEventListener('mousemove', (e) => {
    if (isStorageOpen && holdingItemData) {
        handleStorageGridHover(e, -1);
    }
});

function toggleStorage(state, tradeMode = false) {
    isStorageOpen = state; 
    isTradeMode = tradeMode;
    storageUI.style.display = state ? 'flex' : 'none'; 
    
    inputs.up = false; inputs.down = false; inputs.left = false; inputs.right = false;
    
    if (state) {
        if (tradeMode) {
            storageTitle.innerText = "REACTOR TERMINAL";
            sidePanel.style.display = 'flex';
            storageUI.style.width = '750px'; 
        } else {
            storageTitle.innerText = "ГРУЗОВОЙ ОТСЕК";
            sidePanel.style.display = 'none'; 
            storageUI.style.width = '550px'; 
        }
        
        renderStorageGrid();
        renderStorageList();
        holdingItemData = null;
        storageGhost.style.display = 'none';
    } else {
            if (holdingItemData && holdingItemData.restore) {
                placedStorageItems.push(holdingItemData.restore);
                holdingItemData = null;
            }
    }
}

function renderStorageGrid() {
    const items = gridContainer.querySelectorAll('.fuel-item');
    items.forEach(el => el.remove());

    placedStorageItems.forEach(item => {
        if (item.type === 'fuel') {
            const fuelDiv = document.createElement('div');
            fuelDiv.className = 'fuel-item';
            fuelDiv.innerHTML = '<div class="fuel-charge"></div><span class="fuel-label">F-CELL</span>';
            
            const pad = 4; const step = 47;
            fuelDiv.style.width = (item.w * step - 2) + 'px';
            fuelDiv.style.height = (item.h * step - 2) + 'px';
            fuelDiv.style.left = (pad + item.x * step) + 'px';
            fuelDiv.style.top = (pad + item.y * step) + 'px';
            gridContainer.appendChild(fuelDiv);
        }
    });
    updateFuelUI();
}

function renderStorageList() {
    storageList.innerHTML = '';
    if (isTradeMode) {
        const fuelCost = 0.0001;
        const btn = document.createElement('div');
        btn.className = 'shop-item-btn';
        
        btn.innerHTML = `<span>FUEL CELL (2x1)</span><span class="price-tag">${fuelCost} SC</span>`;
        
        // НОВАЯ МЕХАНИКА: Вместо драга, клик сразу покупает в свободное место
        btn.onclick = () => {
            // Исправление бага с округлением: даем небольшую погрешность (epsilon)
            if (player.credits + 0.0000001 >= fuelCost) {
                tryAutoBuy('fuel', 2, 1, fuelCost);
            } else {
                // Можно добавить звук ошибки или мигание
                console.log("Not enough credits");
            }
        };
        
        storageList.appendChild(btn);
    }
}

function tryAutoBuy(type, w, h, cost) {
    // Ищем первое свободное место
    for(let y=0; y<10; y++) {
        for(let x=0; x<10; x++) {
            if (!isOccupied(x, y, w, h)) {
                // Место найдено! Покупаем.
                player.credits -= cost;
                if(player.credits < 0) player.credits = 0; // Защита от -0.0000
                updateCurrencyUI();

                placedStorageItems.push({ 
                    x: x, y: y, 
                    type: type,
                    w: w, h: h
                });
                renderStorageGrid();
                return; // Успешно купили и вышли
            }
        }
    }
    // Если дошли сюда, места нет
    alert("CARGO FULL!");
}

const isOccupied = (tx, ty, w, h, ignoreItem = null) => {
    if (tx < 0 || ty < 0 || tx + w > 10 || ty + h > 10) return true;
    return placedStorageItems.some(it => {
        if (it === ignoreItem) return false; 
        const overlapX = (tx < it.x + it.w) && (tx + w > it.x);
        const overlapY = (ty < it.y + it.h) && (ty + h > it.y);
        return overlapX && overlapY;
    });
};

function handleStorageGridClick(index) {
    const x = index % 10;
    const y = Math.floor(index / 10);
    
    // Если мы держим предмет (перемещаем старый), пытаемся поставить
    if (holdingItemData) {
        if (!isOccupied(x, y, holdingItemData.w, holdingItemData.h)) {
            // Здесь больше нет списания денег, так как покупка теперь отдельная кнопка
            // Но логику восстановления при перемещении оставляем
            
            placedStorageItems.push({ 
                x: x, y: y, 
                type: holdingItemData.type,
                w: holdingItemData.w, h: holdingItemData.h
            });
            
            holdingItemData = null;
            storageGhost.style.display = 'none';
            renderStorageGrid();
        }
    } 
    else {
        // Логика взятия предмета (Drag) - остается как раньше
        const itemIdx = placedStorageItems.findIndex(it => 
            x >= it.x && x < it.x + it.w &&
            y >= it.y && y < it.y + it.h
        );

        if (itemIdx !== -1) {
            const item = placedStorageItems[itemIdx];
            const restoreData = { ...item };
            
            placedStorageItems.splice(itemIdx, 1);
            renderStorageGrid(); 
            
            holdingItemData = { 
                type: item.type,
                w: item.w, h: item.h,
                isMoving: true,
                restore: restoreData
                // cost больше не нужен здесь
            };
            // Сразу обновляем призрак в ячейке, по которой кликнули (без скачков)
            handleStorageGridHover(null, index);
        }
    }
}

function handleStorageGridHover(e, index) {
    if (!holdingItemData) {
        storageGhost.style.display = 'none';
        return;
    }

    let x, y;
    if (index === -1) {
        const rect = gridContainer.getBoundingClientRect();
        const relX = e.clientX - rect.left - 4;
        const relY = e.clientY - rect.top - 4;
        x = Math.floor(relX / 47);
        y = Math.floor(relY / 47);
    } else {
        x = index % 10;
        y = Math.floor(index / 10);
    }
    
    storageGhost.style.display = 'block';
    const pad = 4; const step = 47; 
    const ghostW = (holdingItemData.w * step) - 2; 
    const ghostH = (holdingItemData.h * step) - 2;

    if (x < 0) x = 0; if (y < 0) y = 0;
    if (x > 9) x = 9; if (y > 9) y = 9;

    // Ограничиваем, чтобы призрак не улетал за границы при наведении
    if (x + holdingItemData.w > 10) x = 10 - holdingItemData.w;
    if (y + holdingItemData.h > 10) y = 10 - holdingItemData.h;

    storageGhost.style.width = ghostW + 'px';
    storageGhost.style.height = ghostH + 'px';
    storageGhost.style.left = (pad + x * step) + 'px';
    storageGhost.style.top = (pad + y * step) + 'px';

    let valid = !isOccupied(x, y, holdingItemData.w, holdingItemData.h);

    if (valid) {
        storageGhost.style.borderColor = '#00e5ff';
        storageGhost.style.background = 'rgba(0, 229, 255, 0.2)';
    } else {
        storageGhost.style.borderColor = '#ff1744';
        storageGhost.style.background = 'rgba(255, 23, 68, 0.2)';
    }
}

function getFuelCount() {
    return placedStorageItems.filter(i => i.type === 'fuel').length;
}

function updateFuelUI() {
    if (fuelValUI) fuelValUI.innerText = getFuelCount();
}

function consumeFuel(amount) {
    const fuelIndex = placedStorageItems.findIndex(i => i.type === 'fuel');
    if (fuelIndex !== -1) {
        placedStorageItems.splice(fuelIndex, 1);
        updateFuelUI();
        renderStorageGrid(); 
    }
}