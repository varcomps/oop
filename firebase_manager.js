/* firebase_manager.js - WITH DEBUGGING LOGS */

const firebaseConfig = {
  apiKey: "AIzaSyDoDTekynERllEotpTRVDKXRdVbtq2FIBE",
  authDomain: "deepspacegame-f5a7b.firebaseapp.com",
  databaseURL: "https://deepspacegame-f5a7b-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "deepspacegame-f5a7b",
  storageBucket: "deepspacegame-f5a7b.firebasestorage.app",
  messagingSenderId: "602316288636",
  appId: "1:602316288636:web:4b8d6e5fcecf5e558a8ff9",
  measurementId: "G-9G2BSX6Z23"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.database();

let isRegisterMode = false;
let currentUser = null;
let isGameLoaded = false;

// UI Elements
const authModal = document.getElementById('authModal');
const authTitle = document.getElementById('authTitle');
const authNick = document.getElementById('authNick');
const authEmail = document.getElementById('authEmail');
const authPass = document.getElementById('authPass');
const authError = document.getElementById('authError');
const toggleLink = document.querySelector('.toggle-link');

function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    authTitle.innerText = isRegisterMode ? "REGISTER PILOT" : "LOGIN";
    authNick.style.display = isRegisterMode ? "block" : "none";
    toggleLink.innerText = isRegisterMode ? "Have account? Login" : "No account? Register";
    authError.innerText = "";
}

async function handleAuth() {
    const email = authEmail.value;
    const pass = authPass.value;
    const nick = authNick.value ? authNick.value.trim() : "";

    console.log(">>> [DEBUG] Auth Action Started. Mode:", isRegisterMode ? "REGISTER" : "LOGIN");

    if (!email || !pass) {
        authError.innerText = "Email and Password required.";
        return;
    }

    try {
        if (isRegisterMode) {
            // --- ЛОГИКА РЕГИСТРАЦИИ ---
            if (!nick) throw new Error("Nickname required.");
            
            console.log(">>> [DEBUG] Checking nickname availability:", nick);
            const nickRef = db.ref('usernames/' + nick);
            const nickSnap = await nickRef.once('value');
            
            if (nickSnap.exists()) {
                console.warn(">>> [DEBUG] Nickname taken.");
                throw new Error("Nickname already taken.");
            }

            console.log(">>> [DEBUG] Creating Firebase Auth user...");
            const userCred = await auth.createUserWithEmailAndPassword(email, pass);
            const user = userCred.user;
            console.log(">>> [DEBUG] User created. UID:", user.uid);

            const updates = {};
            // Занимаем ник
            updates['usernames/' + nick] = user.uid;
            // Создаем профиль
            updates['users/' + user.uid + '/profile'] = {
                nickname: nick,
                email: email,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            };
            // Создаем стартовые данные (БЕЗ КОРАБЛЯ, корабль создаст loadGameData)
            updates['users/' + user.uid + '/saveData'] = {
                credits: 0.01, 
                hullParts: 0,
                x: 0, y: 0
            };

            console.log(">>> [DEBUG] Writing initial DB data...", updates);
            await db.ref().update(updates);
            console.log(">>> [DEBUG] DB Write Success.");
            
        } else {
            // --- ЛОГИКА ВХОДА ---
            console.log(">>> [DEBUG] Signing in...");
            await auth.signInWithEmailAndPassword(email, pass);
            console.log(">>> [DEBUG] Sign in success.");
        }
    } catch (error) {
        console.error(">>> [DEBUG] Auth Error:", error);
        authError.innerText = error.message;
    }
}

window.toggleLogoutOption = function() {
    const btn = document.getElementById('logoutBtn');
    btn.style.display = (btn.style.display === 'block') ? 'none' : 'block';
};

window.logoutUser = function() {
    firebase.auth().signOut().then(() => {
        console.log(">>> [DEBUG] User signed out.");
        location.reload(); 
    }).catch((error) => console.error(error));
};

auth.onAuthStateChanged((user) => {
    if (user) {
        console.log(">>> [DEBUG] Auth State Changed: LOGGED IN as", user.uid);
        currentUser = user;
        authModal.style.display = 'none'; 
        isGameLoaded = false;

        db.ref('online_players/' + user.uid).onDisconnect().remove();
        
        db.ref('users/' + user.uid + '/profile/nickname').once('value').then((snapshot) => {
            const nick = snapshot.val();
            const nickDisplay = document.getElementById('nicknameDisplay');
            if (nick && nickDisplay) nickDisplay.innerText = nick;
        });

        loadGameData();

        if (window.initMultiplayer) window.initMultiplayer();

    } else {
        console.log(">>> [DEBUG] Auth State Changed: LOGGED OUT");
        if (window.forceFullCoopCleanup) window.forceFullCoopCleanup();
        currentUser = null;
        authModal.style.display = 'flex'; 
        isGameLoaded = false;
        
        const nickDisplay = document.getElementById('nicknameDisplay');
        if(nickDisplay) nickDisplay.innerText = "PILOT";
    }
});

window.saveGameData = function() {
    if (!currentUser || !isGameLoaded) return;
    
    let visualData = null;
    if (window.getVisualState) visualData = window.getVisualState();

    const dataToSave = {
        credits: player.credits,
        hullParts: player.hullParts,
        inventory: window.placedStorageItems || [],
        shipStructure: {
            tiles: window.shipTiles || [],
            modules: window.installedModules || []
        },
        worldState: visualData
    };

    // console.log(">>> [DEBUG] Saving Game Data..."); // Раскомментируйте для спама
    db.ref('users/' + currentUser.uid + '/saveData').update(dataToSave);
};

function loadGameData() {
    if (!currentUser) return;
    
    console.log(">>> [DEBUG] Loading Game Data from Server...");
    
    db.ref('users/' + currentUser.uid + '/saveData').once('value').then((snapshot) => {
        const data = snapshot.val();
        
        if (data) {
            console.log(">>> [DEBUG] Data found:", data);
            
            if (data.credits !== undefined) player.credits = Number(data.credits);
            if (data.hullParts !== undefined) player.hullParts = Number(data.hullParts);
            if (data.inventory) window.placedStorageItems = data.inventory;

            // ПРОВЕРКА НАЛИЧИЯ КОРАБЛЯ
            if (data.shipStructure && data.shipStructure.tiles && data.shipStructure.tiles.length > 0) {
                console.log(">>> [DEBUG] Ship structure loaded from DB.");
                window.shipTiles = data.shipStructure.tiles;
                if (data.shipStructure.modules) window.installedModules = data.shipStructure.modules;
            } else {
                console.warn(">>> [DEBUG] Save exists, but NO SHIP found. Generating default ship...");
                if (window.initShip) window.initShip();
                // Сразу сохраним, чтобы в следующий раз корабль был
                setTimeout(window.saveGameData, 1000);
            }
            
            if (window.placePlayerInShip) window.placePlayerInShip();
            if (data.worldState && window.setVisualState) window.setVisualState(data.worldState);
            
            if(window.renderStorageGrid) window.renderStorageGrid();
            if(window.updateCurrencyUI) window.updateCurrencyUI();
            if(window.updateBuildUI) window.updateBuildUI();
        } else {
            console.warn(">>> [DEBUG] No save data found (New User?). Generating everything...");
            if (window.initShip) window.initShip();
        }
        
        isGameLoaded = true; 
        console.log(">>> [DEBUG] Game Fully Loaded. Ready.");
        
    }).catch(error => {
        console.error(">>> [DEBUG] Error loading data:", error);
        isGameLoaded = true; 
    });
}

window.findUserByNickname = async function(nickname) {
    if (!nickname) return null;
    const snapshot = await db.ref('usernames/' + nickname).once('value');
    return snapshot.exists() ? snapshot.val() : null;
};

window.getCurrentUserUid = function() { return currentUser ? currentUser.uid : null; };