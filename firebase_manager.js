// firebase_manager.js

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

// Инициализация Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.database();

let isRegisterMode = false;
let currentUser = null;

// --- ЗАЩИТА ОТ ПЕРЕЗАПИСИ ---
let isGameLoaded = false;
// -----------------------------

// Элементы интерфейса
const authModal = document.getElementById('authModal');
const authTitle = document.getElementById('authTitle');
const authNick = document.getElementById('authNick');
const authEmail = document.getElementById('authEmail');
const authPass = document.getElementById('authPass');
const authError = document.getElementById('authError');
const toggleLink = document.querySelector('.toggle-link');

// Переключение между Входом и Регистрацией
function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    authTitle.innerText = isRegisterMode ? "REGISTER PILOT" : "LOGIN";
    authNick.style.display = isRegisterMode ? "block" : "none";
    toggleLink.innerText = isRegisterMode ? "Have account? Login" : "No account? Register";
    authError.innerText = "";
}

// Обработка кнопки входа/регистрации
async function handleAuth() {
    const email = authEmail.value;
    const pass = authPass.value;
    const nick = authNick.value ? authNick.value.trim() : "";

    if (!email || !pass) {
        authError.innerText = "Email and Password required.";
        return;
    }

    try {
        if (isRegisterMode) {
            // РЕГИСТРАЦИЯ
            if (!nick) throw new Error("Nickname required.");
            
            const nickRef = db.ref('usernames/' + nick);
            const nickSnap = await nickRef.once('value');
            
            if (nickSnap.exists()) {
                throw new Error("Nickname already taken.");
            }

            const userCred = await auth.createUserWithEmailAndPassword(email, pass);
            const user = userCred.user;

            const updates = {};
            updates['usernames/' + nick] = user.uid;
            updates['users/' + user.uid + '/profile'] = {
                nickname: nick,
                email: email,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            };
            
            // НАЧАЛЬНЫЕ ДАННЫЕ
            // ИСПРАВЛЕНИЕ: Стартовый капитал 0.01 (как ты просил)
            updates['users/' + user.uid + '/saveData'] = {
                credits: 0.01, 
                hullParts: 20,
                x: 0, y: 0
            };

            await db.ref().update(updates);
            
            // Сразу считаем игру "загруженной", так как это новая игра
            isGameLoaded = true;
            
        } else {
            // ВХОД
            await auth.signInWithEmailAndPassword(email, pass);
        }
    } catch (error) {
        authError.innerText = error.message;
        console.error(error);
    }
}

// Управление кнопкой выхода (красный квадрат)
window.toggleLogoutOption = function() {
    const btn = document.getElementById('logoutBtn');
    if (btn.style.display === 'block') {
        btn.style.display = 'none';
    } else {
        btn.style.display = 'block';
    }
};

window.logoutUser = function() {
    firebase.auth().signOut().then(() => {
        console.log("User signed out.");
        location.reload(); 
    }).catch((error) => {
        console.error("Logout error:", error);
    });
};

// Слушатель: когда пользователь входит или выходит
auth.onAuthStateChanged((user) => {
    if (user) {
        // УСПЕШНЫЙ ВХОД
        currentUser = user;
        authModal.style.display = 'none'; 
        console.log("Logged in ID:", user.uid);
        
        // Сброс флага (начало загрузки)
        isGameLoaded = false;
        
        // Получаем никнейм для HUD
        db.ref('users/' + user.uid + '/profile/nickname').once('value').then((snapshot) => {
            const nick = snapshot.val();
            const nickDisplay = document.getElementById('nicknameDisplay');
            if (nick && nickDisplay) {
                nickDisplay.innerText = nick;
            } else if (nickDisplay) {
                nickDisplay.innerText = "PILOT";
            }
        });

        loadGameData();
    } else {
        // ПОЛЬЗОВАТЕЛЬ НЕ В СИСТЕМЕ
        authModal.style.display = 'flex'; 
        isGameLoaded = false;
        
        // Сброс UI ника
        const nickDisplay = document.getElementById('nicknameDisplay');
        if(nickDisplay) nickDisplay.innerText = "PILOT";
        const logoutBtn = document.getElementById('logoutBtn');
        if(logoutBtn) logoutBtn.style.display = 'none';
    }
});

// Глобальная функция сохранения
window.saveGameData = function() {
    if (!currentUser) return;
    
    // --- ПРЕДОХРАНИТЕЛЬ: Если игра не загрузилась, не сохраняем "пустые" нули ---
    if (!isGameLoaded) {
        console.warn("Save blocked: Game data not loaded yet.");
        return;
    }
    // -----------------------------------------------------------------------------
    
    // Сохраняем визуальные данные (для предотвращения "дешевого" сброса фона)
    let visualData = null;
    if (window.getVisualState) {
        visualData = window.getVisualState();
    }

    const dataToSave = {
        credits: player.credits,
        hullParts: player.hullParts,
        inventory: window.placedStorageItems || [],
        worldState: visualData
    };

    db.ref('users/' + currentUser.uid + '/saveData').update(dataToSave);
};

// Функция загрузки данных при старте
function loadGameData() {
    if (!currentUser) return;
    
    console.log("Starting data load...");
    
    db.ref('users/' + currentUser.uid + '/saveData').once('value').then((snapshot) => {
        const data = snapshot.val();
        
        if (data) {
            console.log("Data loaded from server:", data);
            
            if (data.credits !== undefined) player.credits = Number(data.credits);
            if (data.hullParts !== undefined) player.hullParts = Number(data.hullParts);
            
            // Инвентарь
            if (data.inventory) {
                window.placedStorageItems = data.inventory;
                if(window.renderStorageGrid) window.renderStorageGrid();
            }
            
            // Загрузка атмосферы (цвет космоса, тип системы)
            if (data.worldState && window.setVisualState) {
                console.log("Restoring world state...");
                window.setVisualState(data.worldState);
            }
            
            // Обновляем интерфейс
            if(window.updateCurrencyUI) window.updateCurrencyUI();
            if(window.updateBuildUI) window.updateBuildUI();
        }
        
        // --- РАЗРЕШАЕМ СОХРАНЕНИЕ ТОЛЬКО ПОСЛЕ УСПЕШНОЙ ЗАГРУЗКИ ---
        isGameLoaded = true; 
        console.log("Game fully loaded. Saving enabled.");
        // -----------------------------------------------------------
        
    }).catch(error => {
        console.error("Error loading data:", error);
    });
}

// --- НОВАЯ ФУНКЦИЯ ДЛЯ ПОИСКА ИГРОКА ---
window.findUserByNickname = async function(nickname) {
    if (!nickname) return null;
    try {
        const snapshot = await db.ref('usernames/' + nickname).once('value');
        if (snapshot.exists()) {
            return snapshot.val(); // Возвращает UID
        } else {
            return null;
        }
    } catch (error) {
        console.error("User lookup failed:", error);
        return null;
    }
};

window.getCurrentUserUid = function() {
    return currentUser ? currentUser.uid : null;
};