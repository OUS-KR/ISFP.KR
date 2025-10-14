// today-game.js - 나만의 아틀리에 꾸미기 (Decorating My Own Atelier)

// --- Utility Functions ---
function getDailySeed() {
    const today = new Date();
    return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
}

function mulberry32(seed) {
    return function() {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) | 0;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function getEulReParticle(word) {
    if (!word || word.length === 0) return "";
    const lastChar = word[word.length - 1];
    const uni = lastChar.charCodeAt(0);
    if (uni < 0xAC00 || uni > 0xD7A3) return "를";
    return (uni - 0xAC00) % 28 > 0 ? "을" : "를";
}

function getWaGwaParticle(word) {
    if (!word || word.length === 0) return "";
    const lastChar = word[word.length - 1];
    const uni = lastChar.charCodeAt(0);
    if (uni < 0xAC00 || uni > 0xD7A3) return "와";
    return (uni - 0xAC00) % 28 > 0 ? "과" : "와";
}

// --- Game State Management ---
let gameState = {};
let currentRandFn = null;

function resetGameState() {
    gameState = {
        day: 1,
        aesthetics: 50,
        freedom: 50,
        harmony: 50,
        actionPoints: 10,
        maxActionPoints: 10,
        resources: { colors: 10, inspiration: 10, reputation: 5, masterpiece_piece: 0 },
        muses: [
            { id: "lyra", name: "리라", personality: "자유로운", skill: "음악", connection: 70 },
            { id: "iris", name: "아이리스", personality: "섬세한", skill: "그림", connection: 60 }
        ],
        maxMuses: 5,
        currentScenarioId: "intro",
        lastPlayedDate: new Date().toISOString().slice(0, 10),
        manualDayAdvances: 0,
        dailyEventTriggered: false,
        dailyBonus: { creationSuccess: 0 },
        dailyActions: { created: false, exhibitionHeld: false, talkedTo: [], minigamePlayed: false },
        artworks: {
            sketchbook: { built: false, durability: 100 },
            canvas: { built: false, durability: 100 },
            masterpiece: { built: false, durability: 100 },
            sculpture: { built: false, durability: 100 },
            gallery: { built: false, durability: 100 }
        },
        atelierLevel: 0,
        minigameState: {}
    };
    currentRandFn = mulberry32(getDailySeed() + gameState.day);
}

function saveGameState() {
    localStorage.setItem('isfpAtelierGame', JSON.stringify(gameState));
}

function loadGameState() {
    const savedState = localStorage.getItem('isfpAtelierGame');
    const today = new Date().toISOString().slice(0, 10);
    if (savedState) {
        let loaded = JSON.parse(savedState);
        if (!loaded.dailyBonus) loaded.dailyBonus = { creationSuccess: 0 };
        if (!loaded.muses || loaded.muses.length === 0) {
            loaded.muses = [
                { id: "lyra", name: "리라", personality: "자유로운", skill: "음악", connection: 70 },
                { id: "iris", name: "아이리스", personality: "섬세한", skill: "그림", connection: 60 }
            ];
        }
        Object.assign(gameState, loaded);

        currentRandFn = mulberry32(getDailySeed() + gameState.day);

        if (gameState.lastPlayedDate !== today) {
            gameState.day += 1;
            gameState.lastPlayedDate = today;
            gameState.manualDayAdvances = 0;
            gameState.dailyEventTriggered = false;
            processDailyEvents();
        }
    } else {
        resetGameState();
        processDailyEvents();
    }
    renderAll();
}

function updateState(changes, displayMessage = null) {
    Object.keys(changes).forEach(key => {
        if (typeof changes[key] === 'object' && changes[key] !== null && !Array.isArray(changes[key])) {
            gameState[key] = { ...gameState[key], ...changes[key] };
        } else {
            gameState[key] = changes[key];
        }
    });
    saveGameState();
    renderAll(displayMessage);
}

// --- UI Rendering ---
function updateGameDisplay(text) {
    const gameArea = document.getElementById('gameArea');
    if(gameArea && text) gameArea.innerHTML = `<p>${text.replace(/\n/g, '<br>')}</p>`;
}

function renderStats() {
    const statsDiv = document.getElementById('gameStats');
    if (!statsDiv) return;
    const museListHtml = gameState.muses.map(m => `<li>${m.name} (${m.skill}) - 교감: ${m.connection}</li>`).join('');
    statsDiv.innerHTML = `
        <p><b>작업:</b> ${gameState.day}일차</p>
        <p><b>집중력:</b> ${gameState.actionPoints}/${gameState.maxActionPoints}</p>
        <p><b>미학:</b> ${gameState.aesthetics} | <b>자유:</b> ${gameState.freedom} | <b>조화:</b> ${gameState.harmony}</p>
        <p><b>자원:</b> 물감 ${gameState.resources.colors}, 영감 ${gameState.resources.inspiration}, 평판 ${gameState.resources.reputation}, 걸작의 조각 ${gameState.resources.masterpiece_piece || 0}</p>
        <p><b>아틀리에 레벨:</b> ${gameState.atelierLevel}</p>
        <p><b>뮤즈 (${gameState.muses.length}/${gameState.maxMuses}):</b></p>
        <ul>${museListHtml}</ul>
    `;
    const manualDayCounter = document.getElementById('manualDayCounter');
    if(manualDayCounter) manualDayCounter.innerText = gameState.manualDayAdvances;
}

function renderChoices(choices) {
    const choicesDiv = document.getElementById('gameChoices');
    if (!choicesDiv) return;
    let dynamicChoices = [];

    if (gameState.currentScenarioId === 'intro') {
        dynamicChoices = gameScenarios.intro.choices;
    } else if (gameState.currentScenarioId === 'action_facility_management') {
        dynamicChoices = gameScenarios.action_facility_management.choices ? [...gameScenarios.action_facility_management.choices] : [];
        if (!gameState.artworks.sketchbook.built) dynamicChoices.push({ text: "스케치북 채우기 (물감 50, 영감 20)", action: "build_sketchbook" });
        if (!gameState.artworks.canvas.built) dynamicChoices.push({ text: "캔버스에 그리기 (영감 30, 평판 30)", action: "build_canvas" });
        if (!gameState.artworks.masterpiece.built) dynamicChoices.push({ text: "걸작 구상하기 (물감 100, 영감 50, 평판 50)", action: "build_masterpiece" });
        if (!gameState.artworks.sculpture.built) dynamicChoices.push({ text: "조각상 만들기 (영감 80, 평판 40)", action: "build_sculpture" });
        if (gameState.artworks.canvas.built && gameState.artworks.canvas.durability > 0 && !gameState.artworks.gallery.built) {
            dynamicChoices.push({ text: "개인 갤러리 열기 (영감 50, 평판 100)", action: "build_gallery" });
        }
        Object.keys(gameState.artworks).forEach(key => {
            const facility = gameState.artworks[key];
            if (facility.built && facility.durability < 100) {
                dynamicChoices.push({ text: `${key} 복원하기 (영감 10, 평판 10)`, action: "maintain_facility", params: { facility: key } });
            }
        });
        dynamicChoices.push({ text: "취소", action: "return_to_intro" });
    } else {
        dynamicChoices = choices ? [...choices] : [];
    }

    choicesDiv.innerHTML = dynamicChoices.map(choice => `<button class="choice-btn" data-action="${choice.action}" data-params='${JSON.stringify(choice.params || {})}'''>${choice.text}</button>`).join('');
    choicesDiv.querySelectorAll('.choice-btn').forEach(button => {
        button.addEventListener('click', () => {
            const action = button.dataset.action;
            if (gameActions[action]) {
                gameActions[action](JSON.parse(button.dataset.params || '{}'));
            }
        });
    });
}

function renderAll(customDisplayMessage = null) {
    const desc = document.getElementById('gameDescription');
    if (desc) desc.style.display = 'none';
    renderStats();
    
    if (!gameState.currentScenarioId.startsWith('minigame_')) {
        const scenario = gameScenarios[gameState.currentScenarioId] || gameScenarios.intro;
        updateGameDisplay(customDisplayMessage || scenario.text);
        renderChoices(scenario.choices);
    }
}

// --- Game Data ---
const gameScenarios = {
    "intro": { text: "오늘은 어떤 예술 활동을 해볼까요?", choices: [
        { text: "작업 구상하기", action: "create" },
        { text: "뮤즈와 교감하기", action: "talk_to_muses" },
        { text: "작은 전시회 열기", action: "hold_exhibition" },
        { text: "재료 수집", action: "show_resource_collection_options" },
        { text: "예술품 관리", action: "show_facility_options" },
        { text: "오늘의 미니게임", action: "play_minigame" }
    ]},
    "daily_event_artistic_difference": {
        text: "새로운 작품의 방향성에 대해 뮤즈와 의견 차이가 생겼습니다.",
        choices: [
            { text: "나의 예술적 영감을 따른다.", action: "handle_difference", params: { choice: "my_way" } },
            { text: "뮤즈의 의견을 존중한다.", action: "handle_difference", params: { choice: "muse_way" } },
            { text: "함께 새로운 영감을 찾아 떠난다.", action: "mediate_difference" },
            { text: "작업을 잠시 멈춘다.", action: "ignore_event" }
        ]
    },
    "daily_event_critic_review": { text: "유명 비평가에게 혹평을 받았습니다. (-10 평판)", choices: [{ text: "확인", action: "return_to_intro" }] },
    "daily_event_inspiration_lost": { text: "갑자기 영감이 모두 사라져 버렸습니다. (-10 영감)", choices: [{ text: "확인", action: "return_to_intro" }] },
    "daily_event_patron": {
        text: "익명의 후원자가 당신의 작품 활동을 지원하고 싶어합니다. [평판 50]을 사용하여 [걸작의 조각]을 얻을 수 있습니다.",
        choices: [
            { text: "후원을 받는다", action: "accept_patronage" },
            { text: "정중히 거절한다", action: "decline_patronage" }
        ]
    },
    "daily_event_new_muse": {
        choices: [
            { text: "그의 독특한 분위기에 이끌려 환영한다.", action: "welcome_new_unique_muse" },
            { text: "나의 예술 세계와 조화로운지 지켜본다.", action: "observe_muse" },
            { text: "나의 아틀리에와는 어울리지 않는다.", action: "reject_muse" }
        ]
    },
    "game_over_aesthetics": { text: "미학적 감각을 잃었습니다. 더 이상 아름다움을 창조할 수 없습니다.", choices: [], final: true },
    "game_over_freedom": { text: "자유를 잃은 예술은 의미가 없습니다. 아틀리에의 문을 닫습니다.", choices: [], final: true },
    "game_over_harmony": { text: "내면의 조화가 깨졌습니다. 더 이상 붓을 들 수 없습니다.", choices: [], final: true },
    "game_over_resources": { text: "모든 재료와 영감이 소진되었습니다.", choices: [], final: true },
    "action_resource_collection": {
        text: "어떤 재료를 수집하시겠습니까?",
        choices: [
            { text: "물감 구매 (물감)", action: "perform_gather_colors" },
            { text: "영감 탐색 (영감)", action: "perform_seek_inspiration" },
            { text: "평판 관리 (평판)", "action": "perform_manage_reputation" },
            { text: "취소", "action": "return_to_intro" }
        ]
    },
    "action_facility_management": {
        text: "어떤 예술품을 관리하시겠습니까?",
        choices: []
    },
    "resource_collection_result": {
        text: "",
        choices: [{ text: "확인", action: "show_resource_collection_options" }]
    },
    "facility_management_result": {
        text: "",
        choices: [{ text: "확인", action: "show_facility_options" }]
    },
    "difference_resolution_result": {
        text: "",
        choices: [{ text: "확인", action: "return_to_intro" }]
    }
};

function calculateMinigameReward(minigameName, score) {
    let rewards = { aesthetics: 0, freedom: 0, harmony: 0, message: "" };

    switch (minigameName) {
        case "기억력 순서 맞추기":
            if (score >= 51) {
                rewards.aesthetics = 15;
                rewards.freedom = 10;
                rewards.harmony = 5;
                rewards.message = `완벽한 기억력입니다! 모든 색의 조합을 기억했습니다. (+15 미학, +10 자유, +5 조화)`;
            } else if (score >= 21) {
                rewards.aesthetics = 10;
                rewards.freedom = 5;
                rewards.message = `훌륭한 기억력입니다. (+10 미학, +5 자유)`;
            } else if (score >= 0) {
                rewards.aesthetics = 5;
                rewards.message = `훈련을 완료했습니다. (+5 미학)`;
            } else {
                rewards.message = `훈련을 완료했지만, 아쉽게도 보상은 없습니다.`;
            }
            break;
        case "색 조합하기":
            rewards.aesthetics = 10;
            rewards.message = `환상적인 색 조합입니다! (+10 미학)`;
            break;
        case "즉흥 연주":
            rewards.freedom = 10;
            rewards.message = `자유로운 영혼의 연주였습니다. (+10 자유)`;
            break;
        case "숨은 그림 찾기":
            rewards.harmony = 10;
            rewards.message = `숨겨진 조화를 발견했습니다. (+10 조화)`;
            break;
        case "감정 스케치":
            rewards.aesthetics = 5;
            rewards.harmony = 5;
            rewards.message = `감정을 스케치하며 내면의 조화를 찾았습니다. (+5 미학, +5 조화)`;
            break;
        default:
            rewards.message = `미니게임 ${minigameName}을(를) 완료했습니다.`;
            break;
    }
    return rewards;
}

const minigames = [
    {
        name: "기억력 순서 맞추기",
        description: "화면에 나타나는 색상 순서를 기억하고 정확하게 입력하세요. 단계가 올라갈수록 어려워집니다!",
        start: (gameArea, choicesDiv) => {
            gameState.minigameState = { currentSequence: [], playerInput: [], stage: 1, score: 0, showingSequence: false };
            minigames[0].render(gameArea, choicesDiv);
            minigames[0].showSequence();
        },
        render: (gameArea, choicesDiv) => {
            gameArea.innerHTML = `
                <p><b>단계:</b> ${gameState.minigameState.stage} | <b>점수:</b> ${gameState.minigameState.score}</p>
                <p id="sequenceDisplay" style="font-size: 2em; font-weight: bold; min-height: 1.5em;"></p>
                <p>순서를 기억하고 입력하세요:</p>
                <div id="playerInputDisplay" style="font-size: 1.5em; min-height: 1.5em;">${gameState.minigameState.playerInput.join(' ')}</div>
            `;
            choicesDiv.innerHTML = `
                <div class="number-pad">
                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => `<button class="choice-btn num-btn" data-value="${num}">${num}</button>`).join('')}
                    <button class="choice-btn num-btn" data-value="0">0</button>
                    <button class="choice-btn submit-btn" data-action="submitSequence">입력 완료</button>
                    <button class="choice-btn reset-btn" data-action="resetInput">초기화</button>
                </div>
            `;
            choicesDiv.querySelectorAll('.num-btn').forEach(button => {
                button.addEventListener('click', () => minigames[0].processAction('addInput', button.dataset.value));
            });
            choicesDiv.querySelector('.submit-btn').addEventListener('click', () => minigames[0].processAction('submitSequence'));
            choicesDiv.querySelector('.reset-btn').addEventListener('click', () => minigames[0].processAction('resetInput'));
        },
        showSequence: () => {
            gameState.minigameState.showingSequence = true;
            gameState.minigameState.currentSequence = [];
            const sequenceLength = gameState.minigameState.stage + 2;
            for (let i = 0; i < sequenceLength; i++) {
                gameState.minigameState.currentSequence.push(Math.floor(currentRandFn() * 10));
            }

            const sequenceDisplay = document.getElementById('sequenceDisplay');
            let i = 0;
            const interval = setInterval(() => {
                if (i < gameState.minigameState.currentSequence.length) {
                    sequenceDisplay.innerText = gameState.minigameState.currentSequence[i];
                    i++;
                } else {
                    clearInterval(interval);
                    sequenceDisplay.innerText = "입력하세요!";
                    gameState.minigameState.showingSequence = false;
                }
            }, 800);
        },
        processAction: (actionType, value = null) => {
            if (gameState.minigameState.showingSequence) return;

            if (actionType === 'addInput') {
                gameState.minigameState.playerInput.push(parseInt(value));
                document.getElementById('playerInputDisplay').innerText = gameState.minigameState.playerInput.join(' ');
            } else if (actionType === 'resetInput') {
                gameState.minigameState.playerInput = [];
                document.getElementById('playerInputDisplay').innerText = '';
            } else if (actionType === 'submitSequence') {
                const correct = gameState.minigameState.currentSequence.every((num, i) => num === gameState.minigameState.playerInput[i]);

                if (correct && gameState.minigameState.playerInput.length === gameState.minigameState.currentSequence.length) {
                    gameState.minigameState.score += gameState.minigameState.currentSequence.length * 10;
                    gameState.minigameState.stage++;
                    gameState.minigameState.playerInput = [];
                    updateGameDisplay("정답입니다! 다음 단계로 넘어갑니다.");
                    minigames[0].render(document.getElementById('gameArea'), document.getElementById('gameChoices'));
                    setTimeout(() => minigames[0].showSequence(), 1500);
                } else {
                    updateGameDisplay("오답입니다. 게임 종료.");
                    minigames[0].end();
                }
            }
        },
        end: () => {
            const rewards = calculateMinigameReward(minigames[0].name, gameState.minigameState.score);
            updateState({
                aesthetics: gameState.aesthetics + rewards.aesthetics,
                freedom: gameState.freedom + rewards.freedom,
                harmony: gameState.harmony + rewards.harmony,
                currentScenarioId: 'intro'
            }, rewards.message);
            gameState.minigameState = {};
        }
    },
    { name: "색 조합하기", description: "주어진 주제에 가장 어울리는 색상 조합을 만드세요.", start: (ga, cd) => { ga.innerHTML = "<p>색 조합하기 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[1].end()'>종료</button>"; gameState.minigameState = { score: 10 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[1].name, gameState.minigameState.score); updateState({ aesthetics: gameState.aesthetics + r.aesthetics, freedom: gameState.freedom + r.freedom, harmony: gameState.harmony + r.harmony, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } },
    { name: "즉흥 연주", description: "떠오르는 감정을 악기로 자유롭게 연주하세요.", start: (ga, cd) => { ga.innerHTML = "<p>즉흥 연주 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[2].end()'>종료</button>"; gameState.minigameState = { score: 15 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[2].name, gameState.minigameState.score); updateState({ aesthetics: gameState.aesthetics + r.aesthetics, freedom: gameState.freedom + r.freedom, harmony: gameState.harmony + r.harmony, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } },
    { name: "숨은 그림 찾기", description: "복잡한 그림 속에서 숨겨진 조화로운 요소를 찾아내세요.", start: (ga, cd) => { ga.innerHTML = "<p>숨은 그림 찾기 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[3].end()'>종료</button>"; gameState.minigameState = { score: 20 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[3].name, gameState.minigameState.score); updateState({ aesthetics: gameState.aesthetics + r.aesthetics, freedom: gameState.freedom + r.freedom, harmony: gameState.harmony + r.harmony, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } },
    { name: "감정 스케치", description: "주어진 감정을 스케치로 표현하여 내면의 조화를 찾으세요.", start: (ga, cd) => { ga.innerHTML = "<p>감정 스케치 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[4].end()'>종료</button>"; gameState.minigameState = { score: 25 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[4].name, gameState.minigameState.score); updateState({ aesthetics: gameState.aesthetics + r.aesthetics, freedom: gameState.freedom + r.freedom, harmony: gameState.harmony + r.harmony, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } }
];

// --- Game Actions ---
function spendActionPoint() {
    if (gameState.actionPoints <= 0) {
        updateGameDisplay("집중력이 부족합니다.");
        return false;
    }
    updateState({ actionPoints: gameState.actionPoints - 1 });
    return true;
}

const gameActions = {
    create: () => {
        if (!spendActionPoint()) return;
        if (gameState.dailyActions.created) { updateState({ dailyActions: { ...gameState.dailyActions, created: true } }, "오늘은 이미 충분히 작업했습니다."); return; }
        
        let changes = { dailyActions: { ...gameState.dailyActions, created: true } };
        let message = "새로운 작품을 구상합니다.";
        const rand = currentRandFn();
        if (rand < 0.3) { message += " 아름다운 색 조합이 떠올랐습니다. (+2 물감)"; changes.resources = { ...gameState.resources, colors: gameState.resources.colors + 2 }; }
        else if (rand < 0.6) { message += " 새로운 영감을 얻었습니다. (+2 영감)"; changes.resources = { ...gameState.resources, inspiration: gameState.resources.inspiration + 2 }; }
        else { message += " 특별한 영감은 없었습니다."; }
        
        updateState(changes, message);
    },
    talk_to_muses: () => {
        if (!spendActionPoint()) return;
        const muse = gameState.muses[Math.floor(currentRandFn() * gameState.muses.length)];
        if (gameState.dailyActions.talkedTo.includes(muse.id)) { updateState({ dailyActions: { ...gameState.dailyActions, talkedTo: [...gameState.dailyActions.talkedTo, muse.id] } }, `${muse.name}${getWaGwaParticle(muse.name)} 이미 교감했습니다.`); return; }
        
        let changes = { dailyActions: { ...gameState.dailyActions, talkedTo: [...gameState.dailyActions.talkedTo, muse.id] } };
        let message = `${muse.name}${getWaGwaParticle(muse.name)} 교감했습니다. `;
        if (muse.connection > 80) { message += "그녀와의 교감을 통해 예술적 조화가 깊어졌습니다. (+5 조화)"; changes.harmony = gameState.harmony + 5; }
        else if (muse.connection < 40) { message += "그녀는 당신의 예술 세계를 이해하지 못합니다. (-5 자유)"; changes.freedom = gameState.freedom - 5; }
        else { message += "그녀와의 대화로 새로운 영감을 얻었습니다. (+2 영감)"; changes.resources = { ...gameState.resources, inspiration: gameState.resources.inspiration + 2 }; }
        
        updateState(changes, message);
    },
    hold_exhibition: () => {
        if (!spendActionPoint()) return;
        if (gameState.dailyActions.exhibitionHeld) {
            const message = "오늘은 이미 전시회를 열었습니다. (-5 평판)";
            gameState.reputation -= 5;
            updateState({ reputation: gameState.reputation }, message);
            return;
        }
        updateState({ dailyActions: { ...gameState.dailyActions, exhibitionHeld: true } });
        const rand = currentRandFn();
        let message = "작은 전시회를 열었습니다. ";
        if (rand < 0.5) { message += "관람객들의 호평으로 평판이 상승했습니다. (+10 평판, +5 자유)"; updateState({ reputation: gameState.reputation + 10, freedom: gameState.freedom + 5 }); }
        else { message += "당신의 작품 세계를 이해하는 소수의 팬을 얻었습니다. (+5 조화)"; updateState({ harmony: gameState.harmony + 5 }); }
        updateGameDisplay(message);
    },
    manualNextDay: () => {
        if (gameState.manualDayAdvances >= 5) { updateGameDisplay("오늘은 더 이상 수동으로 날짜를 넘길 수 없습니다. 내일 다시 시도해주세요."); return; }
        updateState({
            manualDayAdvances: gameState.manualDayAdvances + 1,
            day: gameState.day + 1,
            lastPlayedDate: new Date().toISOString().slice(0, 10),
            dailyEventTriggered: false
        });
        processDailyEvents();
    },
    handle_difference: (params) => {
        if (!spendActionPoint()) return;
        const { choice } = params;
        let message = "";
        let reward = { aesthetics: 0, freedom: 0, harmony: 0 };
        
        if (choice === "my_way") {
            message = "당신의 예술적 영감을 따르기로 했습니다. (+5 자유, -2 조화)";
            reward.freedom += 5;
            reward.harmony -= 2;
        } else {
            message = "뮤즈의 의견을 존중하여 작품에 반영했습니다. (+5 조화, -2 자유)";
            reward.harmony += 5;
            reward.freedom -= 2;
        }
        
        updateState({ ...reward, currentScenarioId: 'difference_resolution_result' }, message);
    },
    mediate_difference: () => {
        if (!spendActionPoint()) return;
        const message = "뮤즈와의 협력을 통해 새로운 차원의 예술을 창조했습니다! (+10 미학, +5 조화)";
        updateState({ aesthetics: gameState.aesthetics + 10, harmony: gameState.harmony + 5, currentScenarioId: 'difference_resolution_result' }, message);
    },
    ignore_event: () => {
        if (!spendActionPoint()) return;
        const message = "작업을 멈추었습니다. 예술적 갈등이 깊어집니다. (-10 조화, -5 미학)";
        updateState({ harmony: gameState.harmony - 10, aesthetics: gameState.aesthetics - 5, currentScenarioId: 'difference_resolution_result' }, message);
    },
    show_resource_collection_options: () => updateState({ currentScenarioId: 'action_resource_collection' }),
    show_facility_options: () => updateState({ currentScenarioId: 'action_facility_management' }),
    perform_gather_colors: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.atelierLevel * 0.1) + (gameState.dailyBonus.creationSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            message = "새로운 물감을 구매했습니다! (+5 물감)";
            changes.resources = { ...gameState.resources, colors: gameState.resources.colors + 5 };
        } else {
            message = "물감 구매에 실패했습니다.";
        }
        updateState(changes, message);
    },
    perform_seek_inspiration: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.atelierLevel * 0.1) + (gameState.dailyBonus.creationSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            message = "산책 중 새로운 영감을 얻었습니다! (+5 영감)";
            changes.resources = { ...gameState.resources, inspiration: gameState.resources.inspiration + 5 };
        } else {
            message = "영감을 얻지 못했습니다.";
        }
        updateState(changes, message);
    },
    perform_manage_reputation: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.atelierLevel * 0.1) + (gameState.dailyBonus.creationSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            message = "SNS에 작품을 올려 평판을 얻었습니다! (+5 평판)";
            changes.resources = { ...gameState.resources, reputation: gameState.resources.reputation + 5 };
        } else {
            message = "평판 관리에 실패했습니다.";
        }
        updateState(changes, message);
    },
    build_sketchbook: () => {
        if (!spendActionPoint()) return;
        const cost = { colors: 50, inspiration: 20 };
        let message = "";
        let changes = {};
        if (gameState.resources.inspiration >= cost.inspiration && gameState.resources.colors >= cost.colors) {
            gameState.artworks.sketchbook.built = true;
            message = "스케치북을 아이디어로 가득 채웠습니다!";
            changes.harmony = gameState.harmony + 10;
            changes.resources = { ...gameState.resources, inspiration: gameState.resources.inspiration - cost.inspiration, colors: gameState.resources.colors - cost.colors };
        } else {
            message = "재료가 부족하여 작업할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_canvas: () => {
        if (!spendActionPoint()) return;
        const cost = { inspiration: 30, reputation: 30 };
        let message = "";
        let changes = {};
        if (gameState.resources.inspiration >= cost.inspiration && gameState.resources.reputation >= cost.reputation) {
            gameState.artworks.canvas.built = true;
            message = "캔버스에 새로운 그림을 그렸습니다!";
            changes.freedom = gameState.freedom + 10;
            changes.resources = { ...gameState.resources, inspiration: gameState.resources.inspiration - cost.inspiration, reputation: gameState.resources.reputation - cost.reputation };
        } else {
            message = "재료가 부족하여 작업할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_masterpiece: () => {
        if (!spendActionPoint()) return;
        const cost = { colors: 100, inspiration: 50, reputation: 50 };
        let message = "";
        let changes = {};
        if (gameState.resources.inspiration >= cost.inspiration && gameState.resources.reputation >= cost.reputation && gameState.resources.colors >= cost.colors) {
            gameState.artworks.masterpiece.built = true;
            message = "당신의 모든 것을 담은 걸작을 구상했습니다!";
            changes.harmony = gameState.harmony + 20;
            changes.freedom = gameState.freedom + 20;
            changes.resources = { ...gameState.resources, inspiration: gameState.resources.inspiration - cost.inspiration, reputation: gameState.resources.reputation - cost.reputation, colors: gameState.resources.colors - cost.colors };
        } else {
            message = "재료가 부족하여 작업할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_sculpture: () => {
        if (!spendActionPoint()) return;
        const cost = { inspiration: 80, reputation: 40 };
        let message = "";
        let changes = {};
        if (gameState.resources.inspiration >= cost.inspiration && gameState.resources.reputation >= cost.reputation) {
            gameState.artworks.sculpture.built = true;
            message = "조각상을 만들기 시작했습니다!";
            changes.aesthetics = gameState.aesthetics + 15;
            changes.harmony = gameState.harmony + 10;
            changes.resources = { ...gameState.resources, inspiration: gameState.resources.inspiration - cost.inspiration, reputation: gameState.resources.reputation - cost.reputation };
        } else {
            message = "재료가 부족하여 작업할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_gallery: () => {
        if (!spendActionPoint()) return;
        const cost = { inspiration: 50, reputation: 100 };
        let message = "";
        let changes = {};
        if (gameState.resources.inspiration >= cost.inspiration && gameState.resources.reputation >= cost.reputation) {
            gameState.artworks.gallery.built = true;
            message = "당신만의 작은 갤러리를 열었습니다!";
            changes.resources = { ...gameState.resources, inspiration: gameState.resources.inspiration - cost.inspiration, reputation: gameState.resources.reputation - cost.reputation };
        } else {
            message = "재료가 부족하여 열 수 없습니다.";
        }
        updateState(changes, message);
    },
    maintain_facility: (params) => {
        if (!spendActionPoint()) return;
        const facilityKey = params.facility;
        const cost = { inspiration: 10, reputation: 10 };
        let message = "";
        let changes = {};
        if (gameState.resources.inspiration >= cost.inspiration && gameState.resources.reputation >= cost.reputation) {
            gameState.artworks[facilityKey].durability = 100;
            message = `${facilityKey} 작품의 복원을 완료했습니다. 내구도가 100으로 회복되었습니다.`;
            changes.resources = { ...gameState.resources, inspiration: gameState.resources.inspiration - cost.inspiration, reputation: gameState.resources.reputation - cost.reputation };
        } else {
            message = "복원에 필요한 재료가 부족합니다.";
        }
        updateState(changes, message);
    },
    upgrade_atelier: () => {
        if (!spendActionPoint()) return;
        const cost = 20 * (gameState.atelierLevel + 1);
        if (gameState.resources.inspiration >= cost && gameState.resources.reputation >= cost) {
            gameState.atelierLevel++;
            updateState({ resources: { ...gameState.resources, inspiration: gameState.resources.inspiration - cost, reputation: gameState.resources.reputation - cost }, atelierLevel: gameState.atelierLevel });
            updateGameDisplay(`아틀리에를 업그레이드했습니다! 모든 창작 활동 성공률이 10% 증가합니다. (현재 레벨: ${gameState.atelierLevel})`);
        } else { updateGameDisplay(`업그레이드에 필요한 재료가 부족합니다. (영감 ${cost}, 평판 ${cost} 필요)`); }
        updateState({ currentScenarioId: 'intro' });
    },
    review_portfolio: () => {
        if (!spendActionPoint()) return;
        const rand = currentRandFn();
        if (rand < 0.3) { updateState({ resources: { ...gameState.resources, inspiration: gameState.resources.inspiration + 20, reputation: gameState.resources.reputation + 20 } }); updateGameDisplay("과거 포트폴리오에서 잊혀진 후원자를 발견했습니다! (+20 영감, +20 평판)"); }
        else if (rand < 0.5) { updateState({ aesthetics: gameState.aesthetics + 10, harmony: gameState.harmony + 10 }); updateGameDisplay("과거 작품에서 새로운 미적 조화를 발견했습니다. (+10 미학, +10 조화)"); }
        else { updateGameDisplay("포트폴리오를 검토했지만, 특별한 것은 발견하지 못했습니다."); }
        updateState({ currentScenarioId: 'intro' });
    },
    accept_patronage: () => {
        if (!spendActionPoint()) return;
        if (gameState.resources.reputation >= 50) {
            updateState({ resources: { ...gameState.resources, reputation: gameState.resources.reputation - 50, masterpiece_piece: (gameState.resources.masterpiece_piece || 0) + 1 } });
            updateGameDisplay("후원을 받아 걸작의 조각을 얻었습니다! 당신의 예술 세계가 깊어집니다.");
        } else { updateGameDisplay("후원을 받기에 평판이 부족합니다."); }
        updateState({ currentScenarioId: 'intro' });
    },
    decline_patronage: () => {
        if (!spendActionPoint()) return;
        updateGameDisplay("후원을 거절하고 자유로운 창작 활동을 계속하기로 했습니다.");
        updateState({ currentScenarioId: 'intro' });
    },
    return_to_intro: () => updateState({ currentScenarioId: 'intro' }),
    play_minigame: () => {
        if (gameState.dailyActions.minigamePlayed) { updateGameDisplay("오늘의 미니게임은 이미 플레이했습니다."); return; }
        if (!spendActionPoint()) return;
        
        const minigameIndex = (gameState.day - 1) % minigames.length;
        const minigame = minigames[minigameIndex];
        
        gameState.currentScenarioId = `minigame_${minigame.name}`;
        
        updateState({ dailyActions: { ...gameState.dailyActions, minigamePlayed: true } }); 
        
        updateGameDisplay(minigame.description);
        minigame.start(document.getElementById('gameArea'), document.getElementById('gameChoices'));
    }
};

function applyStatEffects() {
    let message = "";
    if (gameState.aesthetics >= 70) {
        gameState.dailyBonus.creationSuccess += 0.1;
        message += "뛰어난 미적 감각 덕분에 창작 활동 성공률이 증가합니다. ";
    }
    if (gameState.aesthetics < 30) {
        gameState.muses.forEach(m => m.connection = Math.max(0, m.connection - 5));
        message += "미적 감각이 무뎌져 뮤즈와의 교감이 약해집니다. ";
    }

    if (gameState.freedom >= 70) {
        gameState.maxActionPoints += 1;
        gameState.actionPoints = gameState.maxActionPoints;
        message += "자유로운 영혼 덕분에 하루에 더 많은 활동을 할 수 있습니다. ";
    }
    if (gameState.freedom < 30) {
        gameState.maxActionPoints = Math.max(5, gameState.maxActionPoints - 1);
        gameState.actionPoints = Math.min(gameState.actionPoints, gameState.maxActionPoints);
        message += "자유가 억압되어 활동에 제약이 생깁니다. ";
    }

    if (gameState.harmony >= 70) {
        Object.keys(gameState.artworks).forEach(key => {
            if (gameState.artworks[key].built) gameState.artworks[key].durability = Math.min(100, gameState.artworks[key].durability + 1);
        });
        message += "내면의 조화 덕분에 예술품 관리가 더 잘 이루어집니다. ";
    }
    if (gameState.harmony < 30) {
        Object.keys(gameState.artworks).forEach(key => {
            if (gameState.artworks[key].built) gameState.artworks[key].durability = Math.max(0, gameState.artworks[key].durability - 2);
        });
        message += "조화가 깨져 예술품들이 빠르게 낡아갑니다. ";
    }
    return message;
}

function generateRandomMuse() {
    const names = ["칼리오페", "클리오", "에라토", "탈리아"];
    const personalities = ["영감 어린", "서정적인", "열정적인", "신비로운"];
    const skills = ["음악", "그림", "이야기", "춤"];
    const randomId = Math.random().toString(36).substring(2, 9);

    return {
        id: randomId,
        name: names[Math.floor(currentRandFn() * names.length)],
        personality: personalities[Math.floor(currentRandFn() * personalities.length)],
        skill: skills[Math.floor(currentRandFn() * skills.length)],
        connection: 50
    };
}

// --- Daily/Initialization Logic ---
function processDailyEvents() {
    if (gameState.dailyEventTriggered) return;
    currentRandFn = mulberry32(getDailySeed() + gameState.day);

    updateState({
        actionPoints: 10,
        maxActionPoints: 10,
        dailyActions: { created: false, exhibitionHeld: false, talkedTo: [], minigamePlayed: false },
        dailyEventTriggered: true,
        dailyBonus: { creationSuccess: 0 }
    });

    const statEffectMessage = applyStatEffects();

    let skillBonusMessage = "";
    let durabilityMessage = "";

    gameState.muses.forEach(m => {
        if (m.skill === '음악') { gameState.resources.melodies++; skillBonusMessage += `${m.name}의 연주 덕분에 선율을 추가로 얻었습니다. `; }
        else if (m.skill === '그림') { gameState.resources.colors++; skillBonusMessage += `${m.name}의 그림에서 새로운 색감을 얻었습니다. `; }
        else if (m.skill === '이야기') { gameState.resources.inspiration++; skillBonusMessage += `${m.name}의 이야기에서 영감을 얻었습니다. `; }
    });

    Object.keys(gameState.artworks).forEach(key => {
        const facility = gameState.artworks[key];
        if(facility.built) {
            facility.durability -= 1;
            if(facility.durability <= 0) {
                facility.built = false;
                durabilityMessage += `${key} 작품이 훼손되었습니다! 복원이 필요합니다. `; 
            }
        }
    });

    gameState.resources.inspiration -= gameState.muses.length * 2;
    let dailyMessage = "새로운 예술의 날이 밝았습니다. ";
    dailyMessage += statEffectMessage + skillBonusMessage + durabilityMessage;
    if (gameState.resources.inspiration < 0) {
        gameState.freedom -= 10;
        dailyMessage += "영감이 부족하여 자유로운 창작이 힘듭니다! (-10 자유)";
    }
    
    const rand = currentRandFn();
    let eventId = "intro";
    if (rand < 0.15) { eventId = "daily_event_critic_review"; updateState({resources: {...gameState.resources, reputation: Math.max(0, gameState.resources.reputation - 10)}}); }
    else if (rand < 0.30) { eventId = "daily_event_inspiration_lost"; updateState({resources: {...gameState.resources, inspiration: Math.max(0, gameState.resources.inspiration - 10)}}); }
    else if (rand < 0.5 && gameState.muses.length >= 2) { eventId = "daily_event_artistic_difference"; }
    else if (rand < 0.7 && gameState.artworks.masterpiece.built && gameState.muses.length < gameState.maxMuses) {
        eventId = "daily_event_new_muse";
        const newMuse = generateRandomMuse();
        gameState.pendingNewMuse = newMuse;
        gameScenarios["daily_event_new_muse"].text = `새로운 뮤즈 ${newMuse.name}(${newMuse.personality}, ${newMuse.skill})가 아틀리에에 방문했습니다. (현재 뮤즈 수: ${gameState.muses.length} / ${gameState.maxMuses})`;
    }
    else if (rand < 0.85 && gameState.artworks.masterpiece.built) { eventId = "daily_event_patron"; }
    
    gameState.currentScenarioId = eventId;
    updateGameDisplay(dailyMessage + (gameScenarios[eventId]?.text || ''));
    renderChoices(gameScenarios[eventId].choices);
    saveGameState();
}

function initDailyGame() {
    loadGameState();
}

function resetGame() {
    if (confirm("정말로 아틀리에를 초기화하시겠습니까? 모든 작품과 영감이 사라집니다.")) {
        localStorage.removeItem('isfpAtelierGame');
        resetGameState();
        saveGameState();
        location.reload();
    }
}

window.onload = function() {
    try {
        initDailyGame();
        document.getElementById('resetGameBtn').addEventListener('click', resetGame);
        document.getElementById('nextDayBtn').addEventListener('click', gameActions.manualNextDay);
    } catch (e) {
        console.error("오늘의 게임 생성 중 오류 발생:", e);
        document.getElementById('gameDescription').innerText = "콘텐츠를 불러오는 데 실패했습니다. 페이지를 새로고침해 주세요.";
    }
};
