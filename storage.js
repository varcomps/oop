const storageUI = document.getElementById('storageUI');
const sidePanel = document.getElementById('sidePanel');
const gridContainer = document.getElementById('gridContainer');
const storageList = document.getElementById('storageList');
const storageGhost = document.getElementById('storageGhost');
const storageTitle = document.getElementById('storageTitle');
const fuelValUI = document.getElementById('fuelVal');

window.placedStorageItems = [
    { type: 'fuel', x: 0, y: 0, w: 2, h: 1 },
    { type: 'fuel', x: 2, y: 0, w: 2, h: 1 },
    { type: 'fuel', x: 4, y: 0, w: 2, h: 1 },
    { type: 'fuel', x: 6, y: 0, w: 2, h: 1 },
    { type: 'fuel', x: 8, y: 0, w: 2, h: 1 }
];
window.holdingItemData = null; 

let isTradeMode = false;
let isStorageOpen = false;

for(let i=0; i<100; i++) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    cell.onclick = () => window.handleStorageGridClick(i, 'main');
    cell.onmousemove = (e) => window.handleStorageGridHover(e, i, 'main');
    gridContainer.appendChild(cell);
}
gridContainer.onmouseleave = () => { 
    if(storageGhost) storageGhost.style.display = 'none'; 
};

window.addEventListener('mousemove', (e) => {});

function toggleStorage(state, tradeMode = false) {
    isStorageOpen = state; 
    isTradeMode = tradeMode;
    storageUI.style.display = state ? 'flex' : 'none'; 
    
    inputs.up = false; inputs.down = false; inputs.left = false; inputs.right = false;
    
    if (state) {
        if (tradeMode) {
            storageTitle.innerText = "REACTOR TERMINAL";
            sidePanel.style.display = 'flex';
            storageUI.style.width = '800px'; 
        } else {
            storageTitle.innerText = "ГРУЗОВОЙ ОТСЕК";
            sidePanel.style.display = 'none'; 
            storageUI.style.width = '550px'; 
        }
        
        window.renderStorageGrid();
        renderStorageList();
        window.holdingItemData = null;
        if(storageGhost) storageGhost.style.display = 'none';
    } else {
        if (window.holdingItemData && window.holdingItemData.restore) {
            window.placedStorageItems.push(window.holdingItemData.restore);
            window.holdingItemData = null;
        }
    }
}

window.renderStorageGrid = function() {
    const items = gridContainer.querySelectorAll('.grid-item-visual');
    items.forEach(el => el.remove());

    window.placedStorageItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'grid-item-visual';
        div.style.boxSizing = 'border-box'; 

        if (item.type === 'fuel') {
            div.classList.add('fuel-style');
            div.innerHTML = '<div class="fuel-charge"></div><span class="fuel-label">F-CELL</span>';
        }
        else if (item.type === 'fuel_premium') {
            div.classList.add('fuel-style');
            div.style.borderColor = '#ffd700'; 
            div.style.boxShadow = 'inset 0 0 10px rgba(255, 215, 0, 0.3)';
            div.innerHTML = '<div class="fuel-charge" style="background:#ffd700; box-shadow:0 0 10px #ffd700;"></div><span class="fuel-label" style="color:#ffd700;">SUPER</span>';
        }
        else if (item.type === 'fuel_shift') {
            div.classList.add('fuel-style');
            div.style.borderColor = '#d50000'; 
            div.style.boxShadow = 'inset 0 0 10px rgba(255, 23, 68, 0.3)';
            div.innerHTML = '<div class="fuel-charge" style="background:#ff1744; box-shadow:0 0 10px #ff1744;"></div><span class="fuel-label" style="color:#ff1744;">SHIFT</span>';
        }
        else if (item.type === 'cargo') {
            div.classList.add('cargo-style');
            div.innerHTML = `<span class="cargo-text">${item.name ? item.name.substring(0,8) : 'CRATE'}</span>`;
        }
        
        const step = 47; 
        const pad = 4;   
        
        div.style.width = (item.w * step - 2) + 'px';
        div.style.height = (item.h * step - 2) + 'px';
        div.style.left = (pad + item.x * step) + 'px';
        div.style.top = (pad + item.y * step) + 'px';
        
        gridContainer.appendChild(div);
    });
    updateFuelUI();
}

function renderStorageList() {
    storageList.innerHTML = '';
    if (isTradeMode) {
        const fuelCost = 0.0001;
        const premiumCost = 0.0005; 
        const shiftFuelCost = 0.01; 

        const btn = document.createElement('div');
        btn.className = 'shop-item-btn';
        btn.innerHTML = `<span>FUEL CELL (2x1)</span><span class="price-tag">${fuelCost} SC</span>`;
        btn.onclick = () => {
            if (player.credits >= fuelCost) tryAutoBuy('fuel', 2, 1, fuelCost);
        };
        storageList.appendChild(btn);

        const btnPrem = document.createElement('div');
        btnPrem.className = 'shop-item-btn';
        btnPrem.style.borderColor = '#ffd700';
        btnPrem.innerHTML = `<span style="color:#ffd700">SUPER FUEL (2x1)</span><span class="price-tag">${premiumCost} SC</span>`;
        btnPrem.onclick = () => {
            if (player.credits >= premiumCost) tryAutoBuy('fuel_premium', 2, 1, premiumCost);
        };
        storageList.appendChild(btnPrem);

        const btnShift = document.createElement('div');
        btnShift.className = 'shop-item-btn';
        btnShift.style.borderColor = '#d50000'; 
        btnShift.style.background = '#2b0b0b';
        btnShift.innerHTML = `<span style="color:#ff1744">SHIFT FUEL (1x1)</span><span class="price-tag">${shiftFuelCost} SC</span>`;
        btnShift.onclick = () => {
            if (player.credits >= shiftFuelCost) tryAutoBuy('fuel_shift', 1, 1, shiftFuelCost);
        };
        storageList.appendChild(btnShift);
    }
}

function tryAutoBuy(type, w, h, cost) {
    for(let y=0; y<10; y++) {
        for(let x=0; x<10; x++) {
            if (!window.isOccupied(x, y, w, h)) {
                player.credits -= cost;
                if(player.credits < 0) player.credits = 0;
                updateCurrencyUI();
                window.placedStorageItems.push({ x: x, y: y, type: type, w: w, h: h });
                window.renderStorageGrid();
                return; 
            }
        }
    }
}

window.isOccupied = function(tx, ty, w, h, ignoreItem = null) {
    if (tx < 0 || ty < 0 || tx + w > 10 || ty + h > 10) return true;
    return window.placedStorageItems.some(it => {
        if (it === ignoreItem) return false; 
        const overlapX = (tx < it.x + it.w) && (tx + w > it.x);
        const overlapY = (ty < it.y + it.h) && (ty + h > it.y);
        return overlapX && overlapY;
    });
};

window.handleStorageGridClick = function(index, context = 'main') {
    const x = index % 10;
    const y = Math.floor(index / 10);
    
    if (window.holdingItemData) {
        if (!window.isOccupied(x, y, window.holdingItemData.w, window.holdingItemData.h)) {
            window.placedStorageItems.push({ 
                x: x, y: y, 
                type: window.holdingItemData.type,
                w: window.holdingItemData.w, h: window.holdingItemData.h,
                commodityId: window.holdingItemData.commodityId,
                name: window.holdingItemData.name
            });
            window.holdingItemData = null;
            if(storageGhost) storageGhost.style.display = 'none';
            const marketGhost = document.getElementById('marketGhost');
            if(marketGhost) marketGhost.style.display = 'none';

            window.renderStorageGrid();
            if(window.renderMarketGrid) window.renderMarketGrid();
        }
    } 
    else {
        const itemIdx = window.placedStorageItems.findIndex(it => 
            x >= it.x && x < it.x + it.w &&
            y >= it.y && y < it.y + it.h
        );

        if (itemIdx !== -1) {
            const item = window.placedStorageItems[itemIdx];
            const restoreData = { ...item };
            window.placedStorageItems.splice(itemIdx, 1);
            window.holdingItemData = { 
                type: item.type, w: item.w, h: item.h,
                isMoving: true, restore: restoreData,
                commodityId: item.commodityId, name: item.name
            };
            window.renderStorageGrid(); 
            if(window.renderMarketGrid) window.renderMarketGrid();
            window.handleStorageGridHover(null, index, context);
        }
    }
}

window.handleStorageGridHover = function(e, index, context = 'main') {
    if (!window.holdingItemData) return;

    let activeGhost;
    if (context === 'main') activeGhost = storageGhost;
    else activeGhost = document.getElementById('marketGhost');
    
    if (!activeGhost) return;

    let x, y;
    if (index === -1 && e) return; 
    else {
        x = index % 10;
        y = Math.floor(index / 10);
    }
    
    activeGhost.style.display = 'block';
    activeGhost.style.boxSizing = 'border-box';
    
    const stepSize = 47; 
    const pad = 4; 
    
    const ghostW = (window.holdingItemData.w * stepSize) - 2; 
    const ghostH = (window.holdingItemData.h * stepSize) - 2;

    if (x + window.holdingItemData.w > 10) x = 10 - window.holdingItemData.w;
    if (y + window.holdingItemData.h > 10) y = 10 - window.holdingItemData.h;

    activeGhost.style.width = ghostW + 'px';
    activeGhost.style.height = ghostH + 'px';
    activeGhost.style.left = (pad + x * stepSize) + 'px';
    activeGhost.style.top = (pad + y * stepSize) + 'px';

    let valid = !window.isOccupied(x, y, window.holdingItemData.w, window.holdingItemData.h);

    if (valid) {
        activeGhost.style.borderColor = '#00e5ff';
        activeGhost.style.background = 'rgba(0, 229, 255, 0.2)';
    } else {
        activeGhost.style.borderColor = '#ff1744';
        activeGhost.style.background = 'rgba(255, 23, 68, 0.2)';
    }
}

function getFuelCount() {
    return window.placedStorageItems.filter(i => i.type === 'fuel' || i.type === 'fuel_premium').length;
}

window.getPremiumFuelCount = function() {
    return window.placedStorageItems.filter(i => i.type === 'fuel_premium').length;
}

// Добавлена функция получения количества топлива сдвига
window.getShiftFuelCount = function() {
    return window.placedStorageItems.filter(i => i.type === 'fuel_shift').length;
}

window.consumeSpecificFuel = function(type) {
    let targetType;
    if (type === 'shift') {
        targetType = 'fuel_shift';
    } else {
        targetType = (type === 'premium') ? 'fuel_premium' : 'fuel';
    }
    
    let index = window.placedStorageItems.findIndex(i => i.type === targetType);
    
    if (index === -1 && type === 'normal') {
        index = window.placedStorageItems.findIndex(i => i.type === 'fuel_premium');
    }

    if (index !== -1) {
        window.placedStorageItems.splice(index, 1);
        updateFuelUI();
        window.renderStorageGrid();
        
        if (window.saveGameData) window.saveGameData(); 
        return true;
    }
    return false;
}

function updateFuelUI() {
    if (fuelValUI) fuelValUI.innerText = getFuelCount();
}

function consumeFuel(amount) {
    const fuelIndex = window.placedStorageItems.findIndex(i => i.type === 'fuel');
    if (fuelIndex !== -1) {
        window.placedStorageItems.splice(fuelIndex, 1);
        updateFuelUI();
        window.renderStorageGrid(); 
        if (window.saveGameData) window.saveGameData();
    }
}