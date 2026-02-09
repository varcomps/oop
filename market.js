/* market.js */

const marketUI = document.getElementById('marketUI');
const marketListContainer = document.getElementById('marketList');
const marketGraphCanvas = document.getElementById('marketGraphCanvas');
const marketCtx = marketGraphCanvas ? marketGraphCanvas.getContext('2d') : null;
const tradePanel = document.getElementById('tradePanel');
const tradeStatusMsg = document.getElementById('tradeStatusMsg'); 
const marketGridContainer = document.getElementById('marketGridContainer'); 
const marketGhost = document.getElementById('marketGhost');

// --- КОНФИГУРАЦИЯ ТОВАРОВ ---
const COMMODITY_DB = [
    { id: 'c01', name: 'Iron Ore',      base: 0.0001, min: 0.00005, max: 0.0005, step: 0.00005, w: 1, h: 1 },
    { id: 'c02', name: 'Carbon',        base: 0.0001, min: 0.00005, max: 0.0004, step: 0.00005, w: 1, h: 1 },
    { id: 'c03', name: 'Ice Water',     base: 0.0002, min: 0.0001,  max: 0.0006, step: 0.00005, w: 1, h: 1 },
    { id: 'c04', name: 'Hydrogen',      base: 0.0002, min: 0.0001,  max: 0.0008, step: 0.00005, w: 1, h: 1 },
    { id: 'c05', name: 'Silica Sand',   base: 0.0001, min: 0.00005, max: 0.0005, step: 0.00005, w: 1, h: 1 },
    { id: 'c06', name: 'Copper Ore',    base: 0.0003, min: 0.0001,  max: 0.0009, step: 0.0001,  w: 1, h: 1 },
    { id: 'c07', name: 'Aluminium',     base: 0.0003, min: 0.0002,  max: 0.0010, step: 0.0001,  w: 1, h: 1 },
    { id: 'c08', name: 'Titanium Ore',  base: 0.0005, min: 0.0003,  max: 0.0015, step: 0.0001,  w: 1, h: 1 },
    { id: 'c09', name: 'Biomass',       base: 0.0004, min: 0.0002,  max: 0.0120, step: 0.0001,  w: 1, h: 1 },
    { id: 'c10', name: 'Scrap Metal',   base: 0.0001, min: 0.00001, max: 0.0003, step: 0.00002, w: 1, h: 1 },
    { id: 'c11', name: 'Steel Plates',  base: 0.0010, min: 0.0005,  max: 0.0020, step: 0.0002,  w: 2, h: 1 },
    { id: 'c12', name: 'Glass',         base: 0.0012, min: 0.0008,  max: 0.0025, step: 0.0002,  w: 2, h: 1 },
    { id: 'c13', name: 'Plastics',      base: 0.0015, min: 0.0010,  max: 0.0030, step: 0.0003,  w: 2, h: 1 },
    { id: 'c14', name: 'Copper Wire',   base: 0.0020, min: 0.0012,  max: 0.0040, step: 0.0003,  w: 2, h: 1 },
    { id: 'c15', name: 'Ceramics',      base: 0.0018, min: 0.0010,  max: 0.0035, step: 0.0003,  w: 2, h: 2 },
    { id: 'c16', name: 'Nano-Fibers',   base: 0.0030, min: 0.0020,  max: 0.0060, step: 0.0005,  w: 2, h: 2 },
    { id: 'c17', name: 'Polymer Res',   base: 0.0025, min: 0.0015,  max: 0.0050, step: 0.0004,  w: 2, h: 2 },
    { id: 'c18', name: 'Fuel Rods',     base: 0.0040, min: 0.0025,  max: 0.0080, step: 0.0005,  w: 2, h: 1 },
    { id: 'c19', name: 'Circuitry',     base: 0.0035, min: 0.0020,  max: 0.0070, step: 0.0005,  w: 2, h: 2 },
    { id: 'c20', name: 'Optics',        base: 0.0045, min: 0.0030,  max: 0.0090, step: 0.0006,  w: 2, h: 1 },
    { id: 'c21', name: 'Microchips',    base: 0.0050, min: 0.0030,  max: 0.0100, step: 0.0010,  w: 1, h: 1 }, 
    { id: 'c22', name: 'Solar Cells',   base: 0.0060, min: 0.0040,  max: 0.0120, step: 0.0010,  w: 3, h: 2 },
    { id: 'c23', name: 'Batteries',     base: 0.0055, min: 0.0035,  max: 0.0110, step: 0.0010,  w: 2, h: 2 },
    { id: 'c24', name: 'Sensor Arrays', base: 0.0080, min: 0.0050,  max: 0.0150, step: 0.0015,  w: 3, h: 2 },
    { id: 'c25', name: 'Drones',        base: 0.0100, min: 0.0060,  max: 0.0200, step: 0.0020,  w: 2, h: 2 },
    { id: 'c26', name: 'Med-Gel',       base: 0.0090, min: 0.0050,  max: 0.0180, step: 0.0015,  w: 1, h: 2 },
    { id: 'c27', name: 'Engine Parts',  base: 0.0120, min: 0.0080,  max: 0.0250, step: 0.0020,  w: 4, h: 2 },
    { id: 'c28', name: 'Shield Gen',    base: 0.0150, min: 0.0100,  max: 0.0300, step: 0.0025,  w: 3, h: 2 },
    { id: 'c29', name: 'Nav-Comps',     base: 0.0140, min: 0.0090,  max: 0.0280, step: 0.0020,  w: 2, h: 2 },
    { id: 'c30', name: 'Reactors',      base: 0.0180, min: 0.0120,  max: 0.0350, step: 0.0030,  w: 4, h: 2 },
    { id: 'c31', name: 'Synth-Meat',    base: 0.0200, min: 0.0100,  max: 0.0400, step: 0.0030,  w: 2, h: 1 },
    { id: 'c32', name: 'Pure Water',    base: 0.0220, min: 0.0150,  max: 0.0450, step: 0.0030,  w: 2, h: 1 },
    { id: 'c33', name: 'Liquor',        base: 0.0250, min: 0.0150,  max: 0.0500, step: 0.0040,  w: 1, h: 1 },
    { id: 'c34', name: 'Narcotics',     base: 0.0300, min: 0.0200,  max: 0.0600, step: 0.0050,  w: 1, h: 1 },
    { id: 'c35', name: 'Artwork',       base: 0.0350, min: 0.0200,  max: 0.0800, step: 0.0050,  w: 2, h: 2 },
    { id: 'c36', name: 'Jewelry',       base: 0.0400, min: 0.0250,  max: 0.0900, step: 0.0060,  w: 1, h: 1 },
    { id: 'c37', name: 'Exotic Pets',   base: 0.0450, min: 0.0300,  max: 0.1000, step: 0.0070,  w: 2, h: 2 },
    { id: 'c38', name: 'Ancient Relics',base: 0.0480, min: 0.0300,  max: 0.1200, step: 0.0080,  w: 2, h: 2 },
    { id: 'c39', name: 'VR Suites',     base: 0.0280, min: 0.0180,  max: 0.0550, step: 0.0040,  w: 3, h: 2 },
    { id: 'c40', name: 'Terra-Seeds',   base: 0.0380, min: 0.0250,  max: 0.0750, step: 0.0050,  w: 1, h: 1 },
    { id: 'c41', name: 'Dark Matter',   base: 0.0500, min: 0.0300,  max: 0.1000, step: 0.0080,  w: 3, h: 2 },
    { id: 'c42', name: 'Warp Plasma',   base: 0.0600, min: 0.0400,  max: 0.1200, step: 0.0090,  w: 4, h: 2 },
    { id: 'c43', name: 'Neutronium',    base: 0.0700, min: 0.0500,  max: 0.1400, step: 0.0100,  w: 3, h: 2 },
    { id: 'c44', name: 'AI Cores',      base: 0.0800, min: 0.0500,  max: 0.1500, step: 0.0120,  w: 2, h: 2 },
    { id: 'c45', name: 'Zero-G Alloys', base: 0.0550, min: 0.0350,  max: 0.1100, step: 0.0080,  w: 3, h: 2 },
    { id: 'c46', name: 'Grav-Drives',   base: 0.0900, min: 0.0600,  max: 0.1800, step: 0.0150,  w: 5, h: 2 },
    { id: 'c47', name: 'Void Crystals', base: 0.0850, min: 0.0550,  max: 0.1600, step: 0.0120,  w: 2, h: 2 },
    { id: 'c48', name: 'Protomolecule', base: 0.0950, min: 0.0700,  max: 0.2000, step: 0.0150,  w: 3, h: 2 },
    { id: 'c49', name: 'Singularity',   base: 0.1000, min: 0.0800,  max: 0.2500, step: 0.0200,  w: 5, h: 2 },
    { id: 'c50', name: 'Star Maps',     base: 0.0650, min: 0.0400,  max: 0.1300, step: 0.0100,  w: 1, h: 1 }
];

let marketState = {
    items: [],
    stationStock: { sell: [], buy: [] },
    selectedId: null
};

function initMarket() {
    if(marketGridContainer) {
        marketGridContainer.innerHTML = '';
        marketGridContainer.appendChild(marketGhost); 
        for(let i=0; i<100; i++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.onclick = () => window.handleStorageGridClick(i, 'market');
            cell.onmousemove = (e) => window.handleStorageGridHover(e, i, 'market');
            marketGridContainer.appendChild(cell);
        }
        marketGridContainer.onmouseleave = () => { 
            if(marketGhost) marketGhost.style.display = 'none'; 
        };
    }

    // Генерация с нуля (если не загрузили сохранение)
    marketState.items = COMMODITY_DB.map(c => {
        let history = [];
        let current = c.base;
        for(let i=0; i<10; i++) {
            let change = (Math.random() - 0.5) * c.step * 2;
            current += change;
            if(current < c.min) current = c.min;
            if(current > c.max) current = c.max;
            history.push(current);
        }
        return {
            ...c,
            price: history[9],
            history: history
        };
    });
    
    if(marketGraphCanvas) {
        marketGraphCanvas.addEventListener('mousemove', handleGraphHover);
        marketGraphCanvas.addEventListener('mouseleave', () => {
             const item = marketState.items.find(i => i.id === marketState.selectedId);
             if(item) drawGraph(item, -1);
        });
    }
}

function updateGlobalPrices(freezePrices = false) {
    if (freezePrices) {
        console.log("Market prices frozen by Super Fuel.");
        return; 
    }

    marketState.items.forEach(item => {
        let change = (Math.random() - 0.5) * item.step * 2;
        
        if (window.activeMarketRumor && window.activeMarketRumor.id === item.id) {
            const mult = window.activeMarketRumor.multiplier;
            let newP = item.price * mult;
            newP = newP * (0.9 + Math.random() * 0.2); 
            item.price = newP;
        } else {
            item.price += change;
        }

        if (item.price < item.min) item.price = item.min;
        if (!window.activeMarketRumor || window.activeMarketRumor.id !== item.id) {
            if (item.price > item.max) item.price = item.max;
        }
        
        item.history.push(item.price);
        if (item.history.length > 10) item.history.shift();
    });

    window.activeMarketRumor = null;
}

function generateStationInventory() {
    marketState.stationStock.sell = [];
    marketState.stationStock.buy = [];
    let indices = Array.from({length: 50}, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    for(let i=0; i<5; i++) marketState.stationStock.sell.push(marketState.items[indices[i]].id);
    for(let i=5; i<15; i++) marketState.stationStock.buy.push(marketState.items[indices[i]].id);
}

function toggleMarket(show) {
    if (show) {
        if(marketUI) marketUI.style.display = 'flex';
        renderMarketList();
        window.renderMarketGrid(); 
        if (marketState.items.length > 0 && !marketState.selectedId) {
            selectCommodity(marketState.items[0].id);
        } else if (marketState.selectedId) {
            selectCommodity(marketState.selectedId);
        }
        setTradeStatus("", "#ccc");
        inputs.up = false; inputs.down = false; inputs.left = false; inputs.right = false;
        isMarketOpen = true; 
    } else {
        if(marketUI) marketUI.style.display = 'none';
        isMarketOpen = false;
        if (window.holdingItemData && window.holdingItemData.restore) {
            window.placedStorageItems.push(window.holdingItemData.restore);
            window.holdingItemData = null;
        }
    }
}

function renderMarketList() {
    if(!marketListContainer) return;
    marketListContainer.innerHTML = '';
    
    marketState.items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'market-item-row';
        if (item.id === marketState.selectedId) div.classList.add('selected');
        
        let status = '';
        if (marketState.stationStock.sell.includes(item.id)) status = '<span class="status-sell">SELL</span>';
        if (marketState.stationStock.buy.includes(item.id)) status = '<span class="status-buy">BUY</span>';

        const prev = item.history[item.history.length - 2] || item.price;
        const diff = item.price - prev;
        const trend = diff >= 0 ? '<span class="trend-up">▲</span>' : '<span class="trend-down">▼</span>';

        div.innerHTML = `
            <div class="mi-name">${item.name}</div>
            <div class="mi-price">${item.price.toFixed(5)}</div>
            <div class="mi-trend">${trend}</div>
            <div class="mi-status">${status}</div>
        `;
        div.onclick = () => selectCommodity(item.id);
        marketListContainer.appendChild(div);
    });
}

window.renderMarketGrid = function() {
    if(!marketGridContainer) return;
    const existingItems = marketGridContainer.querySelectorAll('.grid-item-visual');
    existingItems.forEach(el => el.remove());

    if(window.placedStorageItems) {
        window.placedStorageItems.forEach(item => {
            const div = document.createElement('div');
            div.className = 'grid-item-visual';
            div.style.boxSizing = 'border-box';

            if (item.type === 'fuel') {
                div.classList.add('fuel-style');
                div.innerHTML = '<div class="fuel-charge"></div><span class="fuel-label">F-CELL</span>';
            } else if (item.type === 'cargo') {
                div.classList.add('cargo-style');
                div.innerHTML = `<span class="cargo-text">${item.name ? item.name.substring(0,3).toUpperCase() : 'BOX'}</span>`;
            }

            const step = 47; 
            const pad = 4;
            
            div.style.width = (item.w * step - 2) + 'px';
            div.style.height = (item.h * step - 2) + 'px';
            div.style.left = (pad + item.x * step) + 'px';
            div.style.top = (pad + item.y * step) + 'px';
            
            marketGridContainer.appendChild(div);
        });
    }
}

function selectCommodity(id) {
    marketState.selectedId = id;
    renderMarketList();
    const item = marketState.items.find(i => i.id === id);
    if (!item) return;
    drawGraph(item, -1);
    updateTradePanel(item);
}

function setTradeStatus(msg, color) {
    if(tradeStatusMsg) {
        tradeStatusMsg.innerText = msg;
        tradeStatusMsg.style.color = color;
    }
}

function updateTradePanel(item) {
    if(!tradePanel) return;
    const canBuy = marketState.stationStock.sell.includes(item.id);
    const canSell = marketState.stationStock.buy.includes(item.id);
    const playerAmount = countPlayerCargo(item.id);

    let html = `<div class="tp-header">${item.name}</div>`;
    html += `<div class="tp-info">PRICE: <span style="color:#ffd700">${item.price.toFixed(5)} SC</span></div>`;
    // ДИНАМИЧЕСКИЙ РАЗМЕР:
    html += `<div class="tp-info">SIZE: ${item.w}x${item.h} CRATE</div>`; 
    html += `<div class="tp-info">OWNED: ${playerAmount}</div>`;
    html += `<div class="tp-actions">`;
    if (canBuy) html += `<button class="trade-btn btn-buy" onclick="tradeTransaction('${item.id}', 'buy')">BUY</button>`;
    else html += `<button class="trade-btn disabled">NO STOCK</button>`;
    if (canSell) html += `<button class="trade-btn btn-sell" onclick="tradeTransaction('${item.id}', 'sell')">SELL</button>`;
    else html += `<button class="trade-btn disabled">NOT INTERESTED</button>`;
    html += `</div>`;
    tradePanel.innerHTML = html;
}

function handleGraphHover(e) {
    const item = marketState.items.find(i => i.id === marketState.selectedId);
    if(!item) return;
    const rect = marketGraphCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    drawGraph(item, x);
}

function drawGraph(item, hoverX) {
    if(!marketCtx || !marketGraphCanvas) return;
    const w = marketGraphCanvas.width;
    const h = marketGraphCanvas.height;
    
    marketCtx.clearRect(0, 0, w, h);

    // Сетка
    marketCtx.strokeStyle = '#222';
    marketCtx.lineWidth = 1;
    marketCtx.beginPath();
    for(let i=0; i<10; i++) {
        let x = (w / 9) * i;
        marketCtx.moveTo(x, 0); marketCtx.lineTo(x, h);
    }
    for(let i=0; i<=3; i++) {
        let y = (h / 3) * i;
        marketCtx.moveTo(0, y); marketCtx.lineTo(w, y);
    }
    marketCtx.stroke();

    const data = item.history;
    const realMin = Math.min(...data);
    const realMax = Math.max(...data);
    const padding = (realMax - realMin) === 0 ? 0.0001 : (realMax - realMin) * 0.2; 
    const minVal = realMin - padding; 
    const maxVal = realMax + padding;
    const range = maxVal - minVal;

    const getPoint = (idx) => ({
        x: (w / 9) * idx,
        y: h - ((data[idx] - minVal) / range) * h
    });

    const grad = marketCtx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(0, 229, 255, 0.15)');
    grad.addColorStop(1, 'rgba(0, 229, 255, 0)');

    marketCtx.beginPath();
    marketCtx.moveTo(0, h);
    data.forEach((_, idx) => {
        const p = getPoint(idx);
        marketCtx.lineTo(p.x, p.y);
    });
    marketCtx.lineTo(w, h);
    marketCtx.closePath();
    marketCtx.fillStyle = grad;
    marketCtx.fill();

    marketCtx.strokeStyle = '#00e5ff';
    marketCtx.lineWidth = 2;
    marketCtx.shadowBlur = 0;
    marketCtx.beginPath();
    data.forEach((_, idx) => {
        const p = getPoint(idx);
        if (idx === 0) marketCtx.moveTo(p.x, p.y);
        else marketCtx.lineTo(p.x, p.y);
    });
    marketCtx.stroke();

    if (hoverX >= 0) {
        const step = w / 9;
        const index = Math.round(hoverX / step);
        if (index >= 0 && index < data.length) {
            const p = getPoint(index);
            const val = data[index];

            marketCtx.strokeStyle = '#444';
            marketCtx.lineWidth = 1;
            marketCtx.setLineDash([4, 4]);
            marketCtx.beginPath();
            marketCtx.moveTo(p.x, 0); marketCtx.lineTo(p.x, h);
            marketCtx.moveTo(0, p.y); marketCtx.lineTo(w, p.y);
            marketCtx.stroke();
            marketCtx.setLineDash([]);

            marketCtx.fillStyle = '#fff';
            marketCtx.beginPath(); marketCtx.arc(p.x, p.y, 3, 0, Math.PI*2); marketCtx.fill();

            marketCtx.fillStyle = '#fff';
            marketCtx.font = '10px monospace';
            const text = val.toFixed(5);
            const tm = marketCtx.measureText(text);
            
            let tx = p.x + 5; 
            let ty = p.y - 5;
            if (tx + tm.width > w) tx = p.x - tm.width - 5;
            if (ty < 10) ty = p.y + 15;

            marketCtx.fillText(text, tx, ty);
        }
    }
}

function countPlayerCargo(id) {
    if (!window.placedStorageItems) return 0;
    return window.placedStorageItems.filter(i => i.type === 'cargo' && i.commodityId === id).length;
}

function tradeTransaction(id, action) {
    const item = marketState.items.find(i => i.id === id);
    if (!item) return;

    if (action === 'buy') {
        if (player.credits >= item.price) {
            // ПЕРЕДАЕМ РАЗМЕРЫ ТОВАРА:
            if (tryAutoBuyCargo(id, item.name, item.price, item.w, item.h)) {
                setTradeStatus(`BOUGHT ${item.name}`, "#00e676");
                updateTradePanel(item);
                window.renderMarketGrid(); 
            } else {
                setTradeStatus(`NOT ENOUGH SPACE (${item.w}x${item.h})`, "#ff1744");
            }
        } else {
            setTradeStatus("INSUFFICIENT FUNDS", "#ff1744");
        }
    } 
    else if (action === 'sell') {
        const idx = window.placedStorageItems.findIndex(i => i.type === 'cargo' && i.commodityId === id);
        if (idx !== -1) {
            window.placedStorageItems.splice(idx, 1);
            player.credits += item.price;
            updateCurrencyUI();
            
            if(window.renderStorageGrid) window.renderStorageGrid(); 
            window.renderMarketGrid(); 
            updateTradePanel(item);
            setTradeStatus(`SOLD ${item.name}`, "#d500f9");
        } else {
            setTradeStatus("YOU DON'T HAVE THIS", "#ff1744");
        }
    }
}

function tryAutoBuyCargo(id, name, cost, w, h) {
    if (!window.isOccupied) return false;
    
    // Циклы учитывают размер предмета, чтобы он не вылез за край сетки (10x10)
    for(let y = 0; y <= 10 - h; y++) { 
        for(let x = 0; x <= 10 - w; x++) { 
            if (!window.isOccupied(x, y, w, h)) {
                player.credits -= cost;
                updateCurrencyUI();
                window.placedStorageItems.push({ 
                    x: x, y: y, 
                    type: 'cargo', 
                    w: w, h: h, // СОХРАНЯЕМ РАЗМЕР В ОБЪЕКТ
                    commodityId: id, 
                    name: name
                });
                if(window.renderStorageGrid) window.renderStorageGrid();
                return true;
            }
        }
    }
    return false;
}

// --- НОВЫЕ ФУНКЦИИ ДЛЯ СОХРАНЕНИЯ РЫНКА ---

// 1. Экспорт данных для сохранения в Firebase
window.getMarketSaveData = function() {
    return {
        // Сохраняем все товары с их текущими ценами и историей
        items: marketState.items,
        // Сохраняем списки того, что станция продает и покупает
        stock: marketState.stationStock
    };
};

// 2. Импорт данных при загрузке игры
window.restoreMarketSaveData = function(data) {
    if (!data) return;
    
    // Восстанавливаем товары (цены, история для графиков)
    if (data.items) {
        marketState.items = data.items;
    }
    
    // Восстанавливаем ассортимент станции
    if (data.stock) {
        marketState.stationStock = data.stock;
    }
    
    console.log("Market data restored.");
};