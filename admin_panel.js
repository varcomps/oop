/* admin_panel.js - New Draggable Tabbed Interface */

// CSS Styles
const admStyle = `
#adm-overlay {
    position: fixed; top: 100px; left: 100px;
    width: 350px; background: rgba(10, 10, 15, 0.95);
    border: 1px solid #444;
    box-shadow: 0 0 20px rgba(0,0,0,0.8);
    color: #ccc; font-family: 'Consolas', monospace; font-size: 12px;
    z-index: 10000; display: none;
    flex-direction: column;
}
.adm-head {
    background: #1a1a1a; padding: 8px; border-bottom: 1px solid #333;
    cursor: grab; display: flex; justify-content: space-between;
    color: #ff5252; font-weight: bold;
}
.adm-head:active { cursor: grabbing; }
.adm-tabs { display: flex; background: #111; border-bottom: 1px solid #333; }
.adm-tab {
    flex: 1; padding: 8px; text-align: center; cursor: pointer;
    background: #111; color: #666; border: none; outline: none;
}
.adm-tab.active { background: #222; color: #fff; border-bottom: 2px solid #00e5ff; }
.adm-content { padding: 15px; display: none; flex-direction: column; gap: 10px; }
.adm-content.active { display: flex; }
.adm-row { display: flex; justify-content: space-between; align-items: center; }
.adm-input {
    background: #000; border: 1px solid #333; color: #fff;
    padding: 4px; width: 80px; text-align: right;
}
.adm-btn {
    background: #333; color: #fff; border: 1px solid #555;
    padding: 5px 10px; cursor: pointer; transition: 0.2s;
}
.adm-btn:hover { background: #444; border-color: #888; }
.adm-btn.green { border-color: #00e676; color: #00e676; background: rgba(0,230,118,0.1); }
.adm-btn.green:hover { background: rgba(0,230,118,0.3); }
.adm-btn.red { border-color: #ff1744; color: #ff1744; background: rgba(255,23,68,0.1); }
`;

// Inject Styles
const styleEl = document.createElement('style');
styleEl.innerHTML = admStyle;
document.head.appendChild(styleEl);

// HTML Structure
const panelHTML = `
<div id="adm-overlay">
    <div class="adm-head" id="adm-drag-handle">
        <span>ADMIN TERMINAL V2</span>
        <span style="cursor:pointer;" onclick="toggleAdmin()">[X]</span>
    </div>
    <div class="adm-tabs">
        <button class="adm-tab active" onclick="switchAdmTab('cheat')">CHEATS</button>
        <button class="adm-tab" onclick="switchAdmTab('story')">STORY</button>
    </div>
    
    <div id="tab-cheat" class="adm-content active">
        <div class="adm-row">
            <span>CREDITS:</span>
            <input type="number" id="adm-cred-val" class="adm-input" value="1000">
        </div>
        <div class="adm-row" style="justify-content: flex-end; gap:5px;">
            <button class="adm-btn red" onclick="modCredits(-1)">SUB</button>
            <button class="adm-btn green" onclick="modCredits(1)">ADD</button>
        </div>
    </div>

    <div id="tab-story" class="adm-content">
        <div class="adm-row">
            <span>CURRENT STAGE:</span>
            <span id="adm-stage-disp" style="color:#00e5ff">0</span>
        </div>
        <div class="adm-row">
             <span>JUMPS DONE:</span>
             <span id="adm-jump-disp" style="color:#aaa">0</span>
        </div>
        <hr style="border:0; border-top:1px solid #333; width:100%">
        <div class="adm-row">
            <span>SET STAGE ID:</span>
            <input type="number" id="adm-stage-val" class="adm-input" placeholder="ID">
        </div>
        <button class="adm-btn" onclick="setStoryStage()">FORCE JUMP TO STAGE</button>
        <br>
        <button class="adm-btn green" onclick="forceCondition()">FORCE COMPLETE ITEM CHECK</button>
    </div>
</div>
`;

document.body.insertAdjacentHTML('beforeend', panelHTML);

// Logic
let isAdminVisible = false;

window.toggleAdmin = function() {
    isAdminVisible = !isAdminVisible;
    document.getElementById('adm-overlay').style.display = isAdminVisible ? 'flex' : 'none';
    if(isAdminVisible) updateAdmStats();
};

window.switchAdmTab = function(tab) {
    document.querySelectorAll('.adm-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.adm-tab').forEach(el => el.classList.remove('active'));
    
    document.getElementById('tab-' + tab).classList.add('active');
    // Находим кнопку таба по тексту (грубо, но работает) или по порядку
    const tabs = document.querySelectorAll('.adm-tab');
    if (tab === 'cheat') tabs[0].classList.add('active');
    if (tab === 'story') tabs[1].classList.add('active');
};

window.modCredits = function(mult) {
    const val = parseFloat(document.getElementById('adm-cred-val').value);
    if (!player) return;
    player.credits += (val * mult);
    if (window.updateCurrencyUI) window.updateCurrencyUI();
};

window.updateAdmStats = function() {
    if (!window.StoryManager) return;
    document.getElementById('adm-stage-disp').innerText = window.StoryManager.state.currentStageId;
    document.getElementById('adm-jump-disp').innerText = window.StoryManager.state.jumpsSinceStage;
};

window.setStoryStage = function() {
    const val = document.getElementById('adm-stage-val').value;
    if (window.StoryManager && val !== "") {
        window.StoryManager.setStage(val);
        updateAdmStats();
    }
};

window.forceCondition = function() {
    if (window.StoryManager) {
        window.StoryManager.forceCompleteCondition();
        alert("Next item check will succeed automatically.");
    }
};

// Keybind (H)
window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyH' && !document.querySelector('input:focus')) {
        toggleAdmin();
    }
});

// Drag Logic
const elm = document.getElementById('adm-overlay');
const header = document.getElementById('adm-drag-handle');
let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

header.onmousedown = dragMouseDown;

function dragMouseDown(e) {
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
}

function elementDrag(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    elm.style.top = (elm.offsetTop - pos2) + "px";
    elm.style.left = (elm.offsetLeft - pos1) + "px";
}

function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
}

// Auto update stats when open
setInterval(() => {
    if(isAdminVisible) updateAdmStats();
}, 1000);