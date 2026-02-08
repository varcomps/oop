/* radio.js - Система связи: Сценарные диалоги, Эфир, SOS */

const radioUI = document.getElementById('radioUI');
const radioLog = document.getElementById('radioLog');

window.isRadioOpen = false;
window.activeMarketRumor = null; 

// --- СЦЕНАРИИ ДИАЛОГОВ (Рост цены - ПРОГНОЗЫ) ---
// Логика: "Цена скоро вырастет" или "Там-то платят больше".
// Игрок понимает: надо закупиться сейчас или придержать груз до следующего прыжка.
const SCENARIOS_BULLISH = [
    [ // Сценарий 1: Дефицит (Авария)
        { name: "ДАЛЬНОБОЙЩИК", color: "#fff176", text: "Слышал новости? На главном заводе в секторе авария." },
        { name: "ДИСПЕТЧЕР", color: "#4fc3f7", text: "Подтверждаю. Производство встало. Запасов {ITEM} хватит на пару часов." },
        { name: "ДАЛЬНОБОЙЩИК", color: "#fff176", text: "Значит, к вечеру цена взлетит до небес. Придержу-ка я груз." }
    ],
    [ // Сценарий 2: Пираты (Блокада)
        { name: "ПИРАТ (А)", color: "#ff5252", text: "Мы перекрыли поставки. Ни один транспортник с {ITEM} не прошел." },
        { name: "ПИРАТ (Б)", color: "#ef9a9a", text: "Отлично. Дефицит уже начался. Завтра продадим наши запасы втридорога." },
        { name: "ПИРАТ (А)", color: "#ff5252", text: "Рынок будет у нас в руках." }
    ],
    [ // Сценарий 3: Инсайд (Скупка)
        { name: "ШИФР-КАНАЛ", color: "#b39ddb", text: "...директива 7. Начать массовую скупку {ITEM} в следующем цикле." },
        { name: "АГЕНТ", color: "#9575cd", text: "Принято. Искусственный спрос поднимет котировки." },
        { name: "ШИФР-КАНАЛ", color: "#b39ddb", text: "Скупайте всё, что есть на станциях, пока дешево." }
    ],
    [ // Сценарий 4: Паника (Ажиотаж)
        { name: "ТОРГОВЕЦ", color: "#ffa726", text: "Ты видел аналитику по {ITEM}? График идет вертикально вверх!" },
        { name: "КОЛЛЕГА", color: "#ffcc80", text: "Ага, говорят, скоро его вообще не достать будет." },
        { name: "ТОРГОВЕЦ", color: "#ffa726", text: "Я забиваю трюм под завязку, пока старая цена держится." }
    ],
    [ // Сценарий 5: Военный заказ (Подготовка)
        { name: "ВОЕННЫЙ", color: "#81c784", text: "Внимание гражданским судам. Флот открывает тендер на {ITEM}." },
        { name: "КАПИТАН", color: "#fff", text: "Опять учения? Платите как обычно?" },
        { name: "ВОЕННЫЙ", color: "#81c784", text: "Платим по двойному тарифу за срочность. Ждем поставки в секторе." }
    ]
];

// --- СЦЕНАРИИ ДИАЛОГОВ (Падение цены - ПРЕДУПРЕЖДЕНИЯ) ---
// Логика: "Скоро цена рухнет" или "Рынок переполнен".
// Игрок понимает: не стоит покупать этот товар, или надо срочно продать, пока берут.
const SCENARIOS_BEARISH = [
    [ // Сценарий 1: Перепроизводство (Жила)
        { name: "ШАХТЕР", color: "#ffa726", text: "Парни, мы нашли гигантскую жилу! Тонны {ITEM}, просто завались!" },
        { name: "БАЗА", color: "#ffb74d", text: "Идиот! Ты обвалишь рынок!" },
        { name: "ШАХТЕР", color: "#ffa726", text: "Уже поздно, информация ушла. Завтра {ITEM} будет стоить копейки." }
    ],
    [ // Сценарий 2: Конфискат (Сброс)
        { name: "ПОЛИЦИЯ", color: "#4fc3f7", text: "Склады конфиската забиты под завязку: {ITEM}." },
        { name: "АУКЦИОН", color: "#81d4fa", text: "Приказ ясен. Выбрасывайте всё на рынок по любой цене." },
        { name: "ПОЛИЦИЯ", color: "#4fc3f7", text: "Готовьтесь к обвалу цен, товара слишком много." }
    ],
    [ // Сценарий 3: Брак (Скандал)
        { name: "ЗАВОД", color: "#e0e0e0", text: "Внимание: партия {ITEM} признана бракованной. Отзывная кампания." },
        { name: "ПОСТАВЩИК", color: "#bdbdbd", text: "Да вы шутите? Я только что хотел закупиться!" },
        { name: "ЗАВОД", color: "#e0e0e0", text: "Не берите. Рыночная стоимость этого мусора скоро будет ноль." }
    ],
    [ // Сценарий 4: Насыщение (Конкуренты)
        { name: "ТОРГОВЕЦ А", color: "#fff176", text: "Видел радары? Сюда идет тяжелый караван." },
        { name: "ТОРГОВЕЦ Б", color: "#fff59d", text: "Если они везут {ITEM}, то местным ценам конец." },
        { name: "ТОРГОВЕЦ А", color: "#fff176", text: "Точно везут. Сливай всё сейчас, пока биржу не обновили." }
    ],
    [ // Сценарий 5: Смена технологий (Устаревание)
        { name: "ТЕХНИК", color: "#a1887f", text: "Вышла новая модель, старый {ITEM} больше никому не нужен." },
        { name: "СКЛАД", color: "#d7ccc8", text: "И куда мне его девать? Списывать?" },
        { name: "ТЕХНИК", color: "#a1887f", text: "Продавай старьевщикам за гроши, пока хоть кто-то берет." }
    ]
];

// --- АТМОСФЕРНЫЕ ДИАЛОГИ (Без влияния на рынок) ---
const SCENARIOS_FLAVOR = [
    [
        { name: "НЕИЗВЕСТНЫЙ", color: "#9e9e9e", text: "...помогите... системы жизнеобеспечения... *помехи*" },
        { name: "СПАСАТЕЛЬ", color: "#81c784", text: "Держитесь, фиксируем ваши координаты. Высылаем дрон." },
        { name: "НЕИЗВЕСТНЫЙ", color: "#9e9e9e", text: "Быстрее... воздух конча..." }
    ],
    [
        { name: "ПАТРУЛЬ", color: "#4fc3f7", text: "Борт 7-2-9, заглушить двигатели для досмотра." },
        { name: "КОНТРАБАНДИСТ", color: "#e040fb", text: "Да пошел ты! Прыжок через 3... 2... 1..." },
        { name: "ПАТРУЛЬ", color: "#4fc3f7", text: "Ушел... Всем постам, объявить в розыск." }
    ],
    [
        { name: "ГРУЗОВИК", color: "#fff176", text: "Эй, кто-нибудь знает, где тут можно поесть нормальной еды?" },
        { name: "СТАНЦИЯ", color: "#ffb74d", text: "Только синте-мясо и водоросли. Добро пожаловать на фронтир." },
        { name: "ГРУЗОВИК", color: "#fff176", text: "Господи, я ненавижу этот сектор." }
    ],
    [
        { name: "ЭХО", color: "#555", text: "...странные показания сенсоров в туманности..." },
        { name: "ЭХО", color: "#666", text: "...оно смотрит на нас..." },
        { name: "СИСТЕМА", color: "#ff5252", text: "СВЯЗЬ ПРЕРВАНА." }
    ],
    [
        { name: "ПИЛОТ-НОВИЧОК", color: "#80cbc4", text: "Ребята, как включить стыковочный магнит? Я сейчас врежусь!" },
        { name: "ВЕТЕРАН", color: "#00695c", text: "Alt+F4 пробовал? Шучу. Жми F, салага." }
    ]
];

window.toggleRadio = function(state) {
    if (typeof transition !== 'undefined' && transition.active) return;
    window.isRadioOpen = state;
    if (radioUI) {
        radioUI.style.display = state ? 'flex' : 'none';
        if (state && typeof inputs !== 'undefined') {
            inputs.up = false; inputs.down = false; inputs.left = false; inputs.right = false;
        }
        if(radioLog) radioLog.scrollTop = radioLog.scrollHeight;
    }
}

window.addToRadioLog = function(msg, color = "#ccc") {
    if (!radioLog) return;
    const line = document.createElement('div');
    line.style.color = color;
    line.style.marginBottom = "4px";
    line.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
    line.style.paddingBottom = "2px";
    line.style.wordWrap = "break-word";
    const time = new Date().toLocaleTimeString('ru-RU', { hour12: false });
    line.innerHTML = `<span style="opacity:0.5; font-size:10px; margin-right:5px;">[${time}]</span>${msg}`;
    radioLog.appendChild(line);
    radioLog.scrollTop = radioLog.scrollHeight;
}

window.requestDistressCall = function() {
    const cost = 0.001;
    if (player.credits < cost) {
        window.addToRadioLog("ОШИБКА: Недостаточно средств для сигнала SOS.", "#ff1744");
        return;
    }
    player.credits -= cost;
    if (window.updateCurrencyUI) window.updateCurrencyUI();
    window.addToRadioLog("ИСХОДЯЩИЙ: Mayday! Запрашиваю экстренную помощь.", "#ff5252");
    
    setTimeout(() => {
        window.addToRadioLog("ВХОДЯЩИЙ: Спасательная служба. Сбрасываем топливный пакет.", "#00e676");
        if (window.tryAutoBuy) {
            window.tryAutoBuy('fuel', 2, 1, 0); 
            window.tryAutoBuy('fuel', 2, 1, 0);
        }
        if (window.updateBuildUI) window.updateBuildUI();
        window.addToRadioLog("СИСТЕМА: Получено: 2x Топливо.", "#ffd700");
    }, 1500);
}

// Функция проигрывания диалога с задержками
function playRadioScenario(scenario, itemName) {
    let delay = 0;
    
    scenario.forEach((line, index) => {
        // Увеличиваем задержку для каждой следующей фразы
        // Первая фраза сразу (0), вторая через 1.5с, третья через 3с и т.д.
        setTimeout(() => {
            let text = line.text;
            if (itemName) text = text.replace(/{ITEM}/g, itemName);
            
            window.addToRadioLog(`${line.name}: "${text}"`, line.color);
            
            // Если это последнее сообщение в важном диалоге, даем подсказку
            if (index === scenario.length - 1 && itemName) {
                const hint = document.getElementById('ui-hint');
                if(hint) {
                    const old = hint.innerHTML;
                    hint.innerHTML = "<span style='color:#00e5ff'>[R] СЛУХИ О РЫНКЕ ПОЛУЧЕНЫ</span>";
                    setTimeout(() => { if(hint.innerHTML.includes("СЛУХИ")) hint.innerHTML = old; }, 3000);
                }
            }
        }, delay);
        
        delay += 1500 + Math.random() * 1000; // Пауза 1.5 - 2.5 сек между репликами
    });
}

// --- ГЛАВНАЯ ФУНКЦИЯ (ВЫЗЫВАЕТСЯ ПОСЛЕ ПРЫЖКА) ---
window.checkIncomingTransmission = function() {
    // Безопасный поиск базы товаров (совместимость с разными версиями market.js)
    let items = null;
    if (typeof window.COMMODITY_DB !== 'undefined') items = window.COMMODITY_DB;
    else if (typeof COMMODITY_DB !== 'undefined') items = COMMODITY_DB;
    
    if (!items) {
        if (typeof window.marketState !== 'undefined') items = window.marketState.items;
        else if (typeof marketState !== 'undefined') items = marketState.items;
    }

    if (!items || items.length === 0) return;

    // ШАНС 50%: Атмосфера (Flavor)
    if (Math.random() < 0.5) {
        const scenario = SCENARIOS_FLAVOR[Math.floor(Math.random() * SCENARIOS_FLAVOR.length)];
        playRadioScenario(scenario, null);
        return;
    }

    // ШАНС 50%: Торговый Слух (Влияет на рынок следующего прыжка)
    const targetItem = items[Math.floor(Math.random() * items.length)];
    const isBullish = Math.random() > 0.5;
    
    // Сохраняем влияние на рынок (будет учтено при следующей генерации цен)
    window.activeMarketRumor = {
        id: targetItem.id,
        multiplier: isBullish ? 3.0 : 0.2, 
        name: targetItem.name
    };

    // Выбираем сценарий
    let scenarioList = isBullish ? SCENARIOS_BULLISH : SCENARIOS_BEARISH;
    const scenario = scenarioList[Math.floor(Math.random() * scenarioList.length)];

    // Запускаем диалог
    playRadioScenario(scenario, targetItem.name);
}