
/* admin_panel.js - CLEAN VERSION: Cheats Only + STORY DEBUG */

// ==========================================
// 1. СТИЛИ ИНТЕРФЕЙСА
// ==========================================
const adminStyles = `
    #adminPanel {
        display: none;
        position: fixed;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: 400px;
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

    .admin-body { padding: 20px; display: flex; flex-direction: column; gap: 15px; }

    .adm-row { display: flex; flex-direction: column; gap: 6px; }
    .adm-row.horizontal { flex-direction: row; align-items: center; gap: 10px; }
    
    .adm-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
    
    .adm-input {
        background: #080808;
        border: 1px solid #444;
        color: #fff;
        padding: 10px;
        font-family: 'Share Tech Mono';
        font-size: 12px;
        outline: none;
        transition: 0.2s;
    }
    .adm-input:focus { border-color: #ff1744; box-shadow: 0 0 10px rgba(255, 23, 68, 0.2); }

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
    
    .story-debug-info {
        font-size: 11px; color: #00e5ff; border: 1px solid #004d40; padding: 5px; background: rgba(0, 229, 255, 0.1);
    }
`;

function injectAdminStyles() {
    const styleSheet = document.createElement("style");
    styleSheet.innerText = adminStyles;
    document.head.appendChild(styleSheet);
}

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
        <div class="admin-body">
            <div class="adm-row">
                <span class="adm-label">КРЕДИТЫ (ЛОКАЛЬНО)</span>
                <div class="adm-row horizontal">
                    <input type="number" id="cheatCredits" class="adm-input" value="1000" style="flex:1">
                    <button class="adm-btn" style="margin:0; padding:8px 20px;" onclick="doCheat('credits')">ADD</button>
                </div>
            </div>
            
            <div style="border-top: 1px solid #333; margin: 5px 0;"></div>

            <div class="adm-row">
                <span class="adm-label">STORY DEBUGGER</span>
                <div class="story-debug-info">
                    JUMPS: <span id="storyJumpVal">0</span> | STAGE: <span id="storyStageVal">0</span>
                </div>
                <div class="adm-row horizontal">
                    <button class="adm-btn" style="flex:1; border-color:#d500f9; color:#d500f9;" onclick="doStoryAction('reset')">RESET STORY</button>
                    <input type="number" id="setStageInput" class="adm-input" value="0" style="width:50px;">
                    <button class="adm-btn" style="width:auto; padding:0 10px;" onclick="doStoryAction('set')">SET</button>
                </div>
            </div>

            <div class="adm-row">
                <span class="adm-label">DEBUG DATA</span>
                <button class="adm-btn" style="background:#111; border-color:#555; color:#888" onclick="console.log(window.marketState)">LOG MARKET STATE</button>
            </div>
            <div id="admStatus" class="admin-status-bar"></div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    if (typeof makeDraggable === 'function') {
        makeDraggable(document.getElementById('adminPanel'), document.getElementById('adminHeader'));
    }
    
    window.updateStoryDebug();
}

window.updateStoryDebug = function() {
    const jumpEl = document.getElementById('storyJumpVal');
    const stageEl = document.getElementById('storyStageVal');
    if (jumpEl && window.storyState) jumpEl.innerText = window.storyState.totalJumps;
    if (stageEl && window.storyState) stageEl.innerText = window.storyState.currentStage;
};

window.isAdminOpen = false;
window.addEventListener('keydown', (e) => {
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        if (e.code === 'Escape') toggleAdminPanel();
        return;
    }
    if (e.code === 'KeyH') {
        const nickDisplay = document.getElementById('nicknameDisplay');
        if (nickDisplay && nickDisplay.innerText.trim() === 'varcomp') toggleAdminPanel();
    }
});

function toggleAdminPanel() {
    window.isAdminOpen = !window.isAdminOpen;
    const panel = document.getElementById('adminPanel');
    if (panel) {
        panel.style.display = window.isAdminOpen ? 'flex' : 'none';
        if (window.isAdminOpen) {
            document.getElementById('admStatus').style.display = 'none';
            window.updateStoryDebug();
        }
    }
}

function showStatus(msg, isError = false) {
    const el = document.getElementById('admStatus');
    el.innerText = msg;
    el.className = 'admin-status-bar ' + (isError ? 'status-error' : 'status-success');
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
}

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
}

function doStoryAction(action) {
    if (typeof StorySystem === 'undefined') {
        showStatus("StorySystem not loaded", true);
        return;
    }
    if (action === 'reset') {
        StorySystem.adminReset();
        showStatus("STORY RESET COMPLETE");
    } else if (action === 'set') {
        const val = document.getElementById('setStageInput').value;
        StorySystem.adminSetStage(val);
        showStatus(`STORY STAGE SET TO ${val}`);
    }
}

initAdminPanel();
