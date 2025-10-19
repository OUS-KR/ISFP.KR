// today-game.js - ISFP - 나만의 아틀리에 꾸미기 (Decorating My Own Atelier)

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

function getRandomValue(base, variance) {
    const min = base - variance;
    const max = base + variance;
    return Math.floor(currentRandFn() * (max - min + 1)) + min;
}

function getEulReParticle(word) {
    if (!word || word.length === 0) return "를";
    const lastChar = word[word.length - 1];
    const uni = lastChar.charCodeAt(0);
    if (uni < 0xAC00 || uni > 0xD7A3) return "를";
    return (uni - 0xAC00) % 28 > 0 ? "을" : "를";
}

function getWaGwaParticle(word) {
    if (!word || word.length === 0) return "와";
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
        inspiration: 50,
        reputation: 50,
        actionPoints: 10, // Represents '집중력'
        maxActionPoints: 10,
        resources: { paints: 10, inspiration_points: 10, reputation_points: 5, masterpiece_fragments: 0 },
        muses: [
            { id: "lyra", name: "라이라", personality: "자유로운", skill: "음악", communion: 70 },
            { id: "iris", name: "아이리스", personality: "섬세한", skill: "그림", communion: 60 }
        ],
        maxMuses: 5,
        currentScenarioId: "intro",
        lastPlayedDate: new Date().toISOString().slice(0, 10),
        manualDayAdvances: 0,
        dailyEventTriggered: false,
        dailyBonus: { creationSuccess: 0 },
        dailyActions: { conceptualized: false, heldExhibition: false, communedWith: [], minigamePlayed: false },
        artworks: {
            sketchbook: { built: false, durability: 100, name: "스케치북", description: "순간의 영감을 기록합니다.", effect_description: "영감 자동 생성 및 미학 보너스." },
            canvas: { built: false, durability: 100, name: "캔버스", description: "본격적인 작품 활동을 시작합니다.", effect_description: "물감 생성 및 자유도 향상." },
            masterpiece: { built: false, durability: 100, name: "걸작", description: "당신의 예술혼이 담긴 역작입니다.", effect_description: "새로운 뮤즈와의 만남 및 조화 강화." },
            sculpture: { built: false, durability: 100, name: "조각상", description: "입체적인 아름다움을 표현합니다.", effect_description: "과거 기록을 통해 스탯 및 자원 획득." },
            personalGallery: { built: false, durability: 100, name: "개인 갤러리", description: "당신의 작품을 세상에 선보입니다.", effect_description: "걸작의 조각 획득 및 고급 활동 잠금 해제." }
        },
        artLevel: 0,
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
        if (!loaded.artworks) {
            loaded.artworks = {
                sketchbook: { built: false, durability: 100, name: "스케치북" },
                canvas: { built: false, durability: 100, name: "캔버스" },
                masterpiece: { built: false, durability: 100, name: "걸작" },
                sculpture: { built: false, durability: 100, name: "조각상" },
                personalGallery: { built: false, durability: 100, name: "개인 갤러리" }
            };
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
    const museListHtml = gameState.muses.map(m => `<li>${m.name} (${m.skill}) - 교감: ${m.communion}</li>`).join('');
    statsDiv.innerHTML = `
        <p><b>${gameState.day}일차 작업</b></p>
        <p><b>집중력:</b> ${gameState.actionPoints}/${gameState.maxActionPoints}</p>
        <p><b>미학:</b> ${gameState.aesthetics} | <b>자유:</b> ${gameState.freedom} | <b>조화:</b> ${gameState.harmony} | <b>영감:</b> ${gameState.inspiration} | <b>평판:</b> ${gameState.reputation}</p>
        <p><b>자원:</b> 물감 ${gameState.resources.paints}, 영감 ${gameState.resources.inspiration_points}, 평판 ${gameState.resources.reputation_points}, 걸작의 조각 ${gameState.resources.masterpiece_fragments || 0}</p>
        <p><b>예술 레벨:</b> ${gameState.artLevel}</p>
        <p><b>나의 뮤즈 (${gameState.muses.length}/${gameState.maxMuses}):</b></p>
        <ul>${museListHtml}</ul>
        <p><b>창조된 예술품:</b></p>
        <ul>${Object.values(gameState.artworks).filter(a => a.built).map(a => `<li>${a.name} (내구성: ${a.durability})</li>`).join('') || '없음'}</ul>
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
    } else if (gameState.currentScenarioId === 'action_artwork_management') {
        dynamicChoices = [];
        if (!gameState.artworks.sketchbook.built) dynamicChoices.push({ text: "스케치북 마련 (영감 50, 평판 20)", action: "build_sketchbook" });
        if (!gameState.artworks.canvas.built) dynamicChoices.push({ text: "캔버스 마련 (평판 30, 물감 30)", action: "build_canvas" });
        if (!gameState.artworks.masterpiece.built) dynamicChoices.push({ text: "걸작 구상 (영감 100, 평판 50)", action: "build_masterpiece" });
        if (!gameState.artworks.sculpture.built) dynamicChoices.push({ text: "조각상 제작 (평판 80, 물감 40)", action: "build_sculpture" });
        if (gameState.artworks.canvas.built && !gameState.artworks.personalGallery.built) {
            dynamicChoices.push({ text: "개인 갤러리 열기 (평판 150, 걸작의 조각 5)", action: "build_personalGallery" });
        }
        Object.keys(gameState.artworks).forEach(key => {
            const artwork = gameState.artworks[key];
            if (artwork.built && artwork.durability < 100) {
                dynamicChoices.push({ text: `${artwork.name} 복원 (영감 10, 평판 10)`, action: "maintain_artwork", params: { artwork: key } });
            }
        });
        dynamicChoices.push({ text: "취소", action: "return_to_intro" });
    } else {
        dynamicChoices = choices ? [...choices] : [];
    }

    choicesDiv.innerHTML = dynamicChoices.map(choice => `<button class="choice-btn" data-action="${choice.action}" data-params='${JSON.stringify(choice.params || {})}' >${choice.text}</button>`).join('');
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

// --- Game Data (ISFP Themed) ---
const gameScenarios = {
    "intro": { text: "오늘은 아틀리에에서 무엇을 할까요?", choices: [
        { text: "작업 구상", action: "conceptualize" },
        { text: "뮤즈와 교감", action: "commune_with_muse" },
        { text: "작은 전시회 열기", action: "hold_exhibition" },
        { text: "재료 수집", action: "show_resource_gathering_options" },
        { text: "예술품 관리", action: "show_artwork_management_options" },
        { text: "자유 시간", action: "show_free_time_options" },
        { text: "오늘의 창작 활동", action: "play_minigame" }
    ]},
    "action_resource_gathering": {
        text: "어떤 재료를 수집하시겠습니까?",
        choices: [
            { text: "물감 수집", action: "gather_paints" },
            { text: "영감 모으기", action: "gather_inspiration" },
            { text: "평판 쌓기", action: "build_reputation" },
            { text: "취소", action: "return_to_intro" }
        ]
    },
    "action_artwork_management": { text: "어떤 예술품을 관리하시겠습니까?", choices: [] },
    "free_time_menu": {
        text: "어떤 자유 시간을 보내시겠습니까?",
        choices: [
            { text: "즉흥 연주 (집중력 1 소모)", action: "play_impromptu_music" },
            { text: "산책 (집중력 1 소모)", action: "take_a_walk" },
            { text: "취소", action: "return_to_intro" }
        ]
    },
    // Game Over Scenarios
    "game_over_aesthetics": { text: "미학적 감각을 잃었습니다. 더 이상 아름다움을 창조할 수 없습니다.", choices: [], final: true },
    "game_over_freedom": { text: "자유를 잃은 당신의 예술은 더 이상 빛나지 않습니다.", choices: [], final: true },
    "game_over_harmony": { text: "조화를 잃은 아틀리에는 비평가들의 혹평 속에 잊혀집니다.", choices: [], final: true },
    "game_over_resources": { text: "창작을 위한 재료가 모두 소진되었습니다.", choices: [], final: true },
};

const conceptualizeOutcomes = [
    { weight: 30, condition: (gs) => gs.inspiration > 60, effect: (gs) => { const v = getRandomValue(10, 5); return { changes: { aesthetics: gs.aesthetics + v }, message: `새로운 영감으로 미학적 감각이 깨어났습니다! (+${v} 미학)` }; } },
    { weight: 25, condition: () => true, effect: (gs) => { const v = getRandomValue(5, 2); return { changes: { harmony: gs.harmony + v }, message: `작업을 구상하며 내면의 조화를 찾았습니다. (+${v} 조화)` }; } },
    { weight: 20, condition: () => true, effect: (gs) => { const v = getRandomValue(5, 2); return { changes: { resources: { ...gs.resources, inspiration_points: gs.resources.inspiration_points - v } }, message: `구상에 너무 몰두하여 영감을 소진했습니다. (-${v} 영감)` }; } },
    { weight: 15, condition: (gs) => gs.inspiration < 40, effect: (gs) => { const v = getRandomValue(5, 2); return { changes: { freedom: gs.freedom - v }, message: `아무런 아이디어도 떠오르지 않아 답답합니다. (-${v} 자유)` }; } },
];

const communeOutcomes = [
    { weight: 40, condition: (gs, muse) => muse.communion < 80, effect: (gs, muse) => { const v = getRandomValue(10, 5); const updated = gs.muses.map(m => m.id === muse.id ? { ...m, communion: Math.min(100, m.communion + v) } : m); return { changes: { muses: updated }, message: `${muse.name}${getWaGwaParticle(muse.name)} 깊이 교감하여 교감도가 상승했습니다. (+${v} 교감)` }; } },
    { weight: 30, condition: () => true, effect: (gs, muse) => { const v = getRandomValue(5, 2); return { changes: { aesthetics: gs.aesthetics + v }, message: `${muse.name}에게서 예술적 영감을 받았습니다. (+${v} 미학)` }; } },
    { weight: 20, condition: (gs) => gs.harmony < 40, effect: (gs, muse) => { const v = getRandomValue(10, 3); const updated = gs.muses.map(m => m.id === muse.id ? { ...m, communion: Math.max(0, m.communion - v) } : m); return { changes: { muses: updated }, message: `당신의 내면이 조화롭지 못하여 ${muse.name}이(가) 멀어집니다. (-${v} 교감)` }; } },
];

const exhibitionOutcomes = [
    { weight: 40, condition: (gs) => gs.aesthetics > 60, effect: (gs) => { const v = getRandomValue(10, 3); return { changes: { reputation: gs.reputation + v }, message: `아름다운 작품들로 작은 전시회가 성공적으로 끝났습니다. (+${v} 평판)` }; } },
    { weight: 30, condition: () => true, effect: (gs) => { const v = getRandomValue(10, 3); return { changes: { inspiration: gs.inspiration + v }, message: `전시회를 통해 새로운 영감을 얻었습니다. (+${v} 영감)` }; } },
    { weight: 20, condition: (gs) => gs.harmony < 40, effect: (gs) => { const v = getRandomValue(10, 4); return { changes: { reputation: gs.reputation - v }, message: `조화롭지 못한 전시 구성으로 비평을 받았습니다. (-${v} 평판)` }; } },
];

const minigames = [
    {
        name: "색 조합하기",
        description: "주어진 주제에 가장 어울리는 색들을 조합하여 팔레트를 완성하세요.",
        start: (gameArea, choicesDiv) => {
            const themes = ["노을", "새벽 숲", "도시의 밤"];
            const colors = ["빨강", "파랑", "노랑", "초록", "보라"];
            gameState.minigameState = { score: 0, theme: themes[Math.floor(currentRandFn() * themes.length)], selectedColors: [] };
            minigames[0].render(gameArea, choicesDiv);
        },
        render: (gameArea, choicesDiv) => {
            const state = gameState.minigameState;
            gameArea.innerHTML = `<p><b>주제:</b> ${state.theme}</p><p>선택한 색: ${state.selectedColors.join(", ")}</p>`;
            choicesDiv.innerHTML = ["빨강", "파랑", "노랑", "초록", "보라"].map(color => `<button class="choice-btn">${color}</button>`).join('');
            choicesDiv.querySelectorAll('.choice-btn').forEach(button => button.addEventListener('click', () => minigames[0].processAction('select_color', button.innerText)));
        },
        processAction: (actionType, value) => {
            if (actionType === 'select_color') {
                const state = gameState.minigameState;
                state.selectedColors.push(value);
                minigames[0].render(document.getElementById('gameArea'), document.getElementById('gameChoices'));
                if (state.selectedColors.length === 3) {
                    // Simplified scoring
                    state.score = 100;
                    minigames[0].end();
                }
            }
        },
        end: () => {
            const rewards = calculateMinigameReward(minigames[0].name, gameState.minigameState.score);
            updateState({ aesthetics: gameState.aesthetics + rewards.aesthetics, inspiration: gameState.inspiration + rewards.inspiration, currentScenarioId: 'intro' }, rewards.message);
        }
    },
];

function calculateMinigameReward(minigameName, score) {
    let rewards = { aesthetics: 0, inspiration: 0, message: "" };
    if (score >= 100) { rewards.aesthetics = 15; rewards.inspiration = 10; rewards.message = "완벽한 색 조합입니다! (+15 미학, +10 영감)"; } 
    else { rewards.aesthetics = 5; rewards.message = "아름다운 팔레트입니다. (+5 미학)"; }
    return rewards;
}

function spendActionPoint() {
    if (gameState.actionPoints <= 0) { updateGameDisplay("집중력이 부족합니다."); return false; }
    updateState({ actionPoints: gameState.actionPoints - 1 });
    return true;
}

const gameActions = {
    conceptualize: () => {
        if (!spendActionPoint()) return;
        const possibleOutcomes = conceptualizeOutcomes.filter(o => !o.condition || o.condition(gameState));
        const totalWeight = possibleOutcomes.reduce((sum, o) => sum + o.weight, 0);
        const rand = currentRandFn() * totalWeight;
        let cumulativeWeight = 0;
        let chosenOutcome = possibleOutcomes.find(o => (cumulativeWeight += o.weight) >= rand) || possibleOutcomes[0];
        const result = chosenOutcome.effect(gameState);
        updateState(result.changes, result.message);
    },
    commune_with_muse: () => {
        if (!spendActionPoint()) return;
        const muse = gameState.muses[Math.floor(currentRandFn() * gameState.muses.length)];
        const possibleOutcomes = communeOutcomes.filter(o => !o.condition || o.condition(gameState, muse));
        const totalWeight = possibleOutcomes.reduce((sum, o) => sum + o.weight, 0);
        const rand = currentRandFn() * totalWeight;
        let cumulativeWeight = 0;
        let chosenOutcome = possibleOutcomes.find(o => (cumulativeWeight += o.weight) >= rand) || possibleOutcomes[0];
        const result = chosenOutcome.effect(gameState, muse);
        updateState(result.changes, result.message);
    },
    hold_exhibition: () => {
        if (!spendActionPoint()) return;
        const possibleOutcomes = exhibitionOutcomes.filter(o => !o.condition || o.condition(gameState));
        const totalWeight = possibleOutcomes.reduce((sum, o) => sum + o.weight, 0);
        const rand = currentRandFn() * totalWeight;
        let cumulativeWeight = 0;
        let chosenOutcome = possibleOutcomes.find(o => (cumulativeWeight += o.weight) >= rand) || possibleOutcomes[0];
        const result = chosenOutcome.effect(gameState);
        updateState(result.changes, result.message);
    },
    show_resource_gathering_options: () => updateState({ currentScenarioId: 'action_resource_gathering' }),
    show_artwork_management_options: () => updateState({ currentScenarioId: 'action_artwork_management' }),
    show_free_time_options: () => updateState({ currentScenarioId: 'free_time_menu' }),
    gather_paints: () => {
        if (!spendActionPoint()) return;
        const gain = getRandomValue(10, 4);
        updateState({ resources: { ...gameState.resources, paints: gameState.resources.paints + gain } }, "물감을 얻었습니다. (+${gain} 물감)");
    },
    gather_inspiration: () => {
        if (!spendActionPoint()) return;
        const gain = getRandomValue(10, 4);
        updateState({ resources: { ...gameState.resources, inspiration_points: gameState.resources.inspiration_points + gain } }, "영감을 얻었습니다. (+${gain} 영감)");
    },
    build_reputation: () => {
        if (!spendActionPoint()) return;
        const gain = getRandomValue(5, 2);
        updateState({ resources: { ...gameState.resources, reputation_points: gameState.resources.reputation_points + gain } }, "평판을 쌓았습니다. (+${gain} 평판)");
    },
    build_sketchbook: () => {
        if (!spendActionPoint()) return;
        const cost = { inspiration_points: 50, reputation_points: 20 };
        if (gameState.resources.inspiration_points >= cost.inspiration_points && gameState.resources.reputation_points >= cost.reputation_points) {
            gameState.artworks.sketchbook.built = true;
            const v = getRandomValue(10, 3);
            updateState({ aesthetics: gameState.aesthetics + v, resources: { ...gameState.resources, inspiration_points: gameState.resources.inspiration_points - cost.inspiration_points, reputation_points: gameState.resources.reputation_points - cost.reputation_points } }, "스케치북을 마련했습니다! (+${v} 미학)");
        } else { updateState({}, "자원이 부족합니다."); }
    },
    build_canvas: () => {
        if (!spendActionPoint()) return;
        const cost = { reputation_points: 30, paints: 30 };
        if (gameState.resources.reputation_points >= cost.reputation_points && gameState.resources.paints >= cost.paints) {
            gameState.artworks.canvas.built = true;
            const v = getRandomValue(10, 3);
            updateState({ freedom: gameState.freedom + v, resources: { ...gameState.resources, reputation_points: gameState.resources.reputation_points - cost.reputation_points, paints: gameState.resources.paints - cost.paints } }, "캔버스를 마련했습니다! (+${v} 자유)");
        } else { updateState({}, "자원이 부족합니다."); }
    },
    build_masterpiece: () => {
        if (!spendActionPoint()) return;
        const cost = { inspiration_points: 100, reputation_points: 50 };
        if (gameState.resources.inspiration_points >= cost.inspiration_points && gameState.resources.reputation_points >= cost.reputation_points) {
            gameState.artworks.masterpiece.built = true;
            const v = getRandomValue(15, 5);
            updateState({ harmony: gameState.harmony + v, resources: { ...gameState.resources, inspiration_points: gameState.resources.inspiration_points - cost.inspiration_points, reputation_points: gameState.resources.reputation_points - cost.reputation_points } }, "걸작을 구상했습니다! (+${v} 조화)");
        } else { updateState({}, "자원이 부족합니다."); }
    },
    build_sculpture: () => {
        if (!spendActionPoint()) return;
        const cost = { reputation_points: 80, paints: 40 };
        if (gameState.resources.reputation_points >= cost.reputation_points && gameState.resources.paints >= cost.paints) {
            gameState.artworks.sculpture.built = true;
            const v = getRandomValue(15, 5);
            updateState({ aesthetics: gameState.aesthetics + v, resources: { ...gameState.resources, reputation_points: gameState.resources.reputation_points - cost.reputation_points, paints: gameState.resources.paints - cost.paints } }, "조각상을 제작했습니다! (+${v} 미학)");
        } else { updateState({}, "자원이 부족합니다."); }
    },
    build_personalGallery: () => {
        if (!spendActionPoint()) return;
        const cost = { reputation_points: 150, masterpiece_fragments: 5 };
        if (gameState.resources.reputation_points >= cost.reputation_points && gameState.resources.masterpiece_fragments >= cost.masterpiece_fragments) {
            gameState.artworks.personalGallery.built = true;
            const v = getRandomValue(20, 5);
            updateState({ freedom: gameState.freedom + v, resources: { ...gameState.resources, reputation_points: gameState.resources.reputation_points - cost.reputation_points, masterpiece_fragments: gameState.resources.masterpiece_fragments - cost.masterpiece_fragments } }, "개인 갤러리를 열었습니다! (+${v} 자유)");
        } else { updateState({}, "자원이 부족합니다."); }
    },
    maintain_artwork: (params) => {
        if (!spendActionPoint()) return;
        const artworkKey = params.artwork;
        const cost = { inspiration_points: 10, reputation_points: 10 };
        if (gameState.resources.inspiration_points >= cost.inspiration_points && gameState.resources.reputation_points >= cost.reputation_points) {
            gameState.artworks[artworkKey].durability = 100;
            updateState({ resources: { ...gameState.resources, inspiration_points: gameState.resources.inspiration_points - cost.inspiration_points, reputation_points: gameState.resources.reputation_points - cost.reputation_points } }, `${gameState.artworks[artworkKey].name}을(를) 복원했습니다.`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    play_impromptu_music: () => {
        if (!spendActionPoint()) return;
        const rand = currentRandFn();
        if (rand < 0.5) {
            const v = getRandomValue(10, 5);
            updateState({ inspiration: gameState.inspiration + v }, "즉흥 연주로 새로운 영감을 얻었습니다! (+${v} 영감)");
        } else {
            const v = getRandomValue(5, 2);
            updateState({ harmony: gameState.harmony - v }, "연주가 조화롭지 못했습니다. (-${v} 조화)");
        }
    },
    take_a_walk: () => {
        if (!spendActionPoint()) return;
        const rand = currentRandFn();
        if (rand < 0.6) {
            const v = getRandomValue(10, 5);
            updateState({ freedom: gameState.freedom + v }, "산책을 하며 자유를 만끽했습니다. (+${v} 자유)");
        } else {
            updateState({}, "평범한 산책이었습니다.");
        }
    },
    play_minigame: () => {
        if (!spendActionPoint()) return;
        const minigame = minigames[0];
        gameState.currentScenarioId = `minigame_${minigame.name}`;
        updateState({ dailyActions: { ...gameState.dailyActions, minigamePlayed: true } }); 
        updateGameDisplay(minigame.description);
        minigame.start(document.getElementById('gameArea'), document.getElementById('gameChoices'));
    },
    return_to_intro: () => updateState({ currentScenarioId: 'intro' }),
    manualNextDay: () => {
        if (gameState.manualDayAdvances >= 5) { updateGameDisplay("오늘은 더 이상 다음 날로 넘어갈 수 없습니다."); return; }
        updateState({
            manualDayAdvances: gameState.manualDayAdvances + 1,
            day: gameState.day + 1,
            dailyEventTriggered: false
        });
        processDailyEvents();
    },
};

function applyStatEffects() {
    let message = "";
    if (gameState.aesthetics >= 70) { message += "뛰어난 미학적 감각으로 아틀리에의 평판이 오릅니다. "; }
    if (gameState.freedom >= 70) { const v = getRandomValue(5, 2); gameState.resources.inspiration_points += v; message += `자유로운 영혼이 새로운 영감을 불러옵니다. (+${v} 영감) `; }
    if (gameState.harmony >= 70) { const v = getRandomValue(2, 1); gameState.muses.forEach(m => m.communion = Math.min(100, m.communion + v)); message += `내면의 조화가 뮤즈와의 교감을 깊게 합니다. (+${v} 교감) `; }
    if (gameState.inspiration < 30) { gameState.actionPoints -= 1; message += "영감이 떠오르지 않아 집중력이 1 감소합니다. "; }
    if (gameState.reputation < 30) { Object.keys(gameState.artworks).forEach(key => { if(gameState.artworks[key].built) gameState.artworks[key].durability -= 1; }); message += "평판이 하락하여 예술품들이 훼손됩니다. "; }
    return message;
}

const weightedDailyEvents = [
    { id: "critic_visit", weight: 10, condition: () => gameState.reputation > 30, onTrigger: () => { const v = getRandomValue(10, 3); updateState({ reputation: gameState.reputation - v, harmony: gameState.harmony - v }, `비평가의 혹평으로 평판과 조화가 감소했습니다. (-${v} 평판, -${v} 조화)`); } },
    { id: "inspiration_drought", weight: 5, condition: () => true, onTrigger: () => { const v = getRandomValue(15, 5); updateState({ resources: { ...gameState.resources, inspiration_points: Math.max(0, gameState.resources.inspiration_points - v) }, freedom: gameState.freedom - 5 }, `영감의 가뭄이 찾아왔습니다. (-${v} 영감, -5 자유)`); } },
    { id: "new_muse", weight: 15, condition: () => true, onTrigger: () => { const v = getRandomValue(10, 5); updateState({ inspiration: gameState.inspiration + v }, `새로운 뮤즈가 나타나 영감을 주었습니다! (+${v} 영감)`); } },
];

function processDailyEvents() {
    if (gameState.dailyEventTriggered) return;
    currentRandFn = mulberry32(getDailySeed() + gameState.day);
    updateState({ actionPoints: 10, dailyEventTriggered: true });
    const statEffectMessage = applyStatEffects();
    let dailyMessage = "아틀리에에 새로운 아침이 밝았습니다. " + statEffectMessage;

    if (gameState.aesthetics <= 0) { gameState.currentScenarioId = "game_over_aesthetics"; }
    else if (gameState.freedom <= 0) { gameState.currentScenarioId = "game_over_freedom"; }
    else if (gameState.harmony <= 0) { gameState.currentScenarioId = "game_over_harmony"; }
    else if (gameState.resources.paints <= 0 && gameState.day > 1) { gameState.currentScenarioId = "game_over_resources"; }

    let eventId = "intro";
    const possibleEvents = weightedDailyEvents.filter(event => !event.condition || event.condition());
    if (possibleEvents.length > 0) {
        const totalWeight = possibleEvents.reduce((sum, event) => sum + event.weight, 0);
        const rand = currentRandFn() * totalWeight;
        let cumulativeWeight = 0;
        let chosenEvent = possibleEvents.find(event => (cumulativeWeight += event.weight) >= rand);
        if (chosenEvent) {
            eventId = chosenEvent.id;
            if (chosenEvent.onTrigger) chosenEvent.onTrigger();
        }
    }
    if (!gameScenarios[gameState.currentScenarioId]) {
        gameState.currentScenarioId = eventId;
    }
    updateGameDisplay(dailyMessage + (gameScenarios[gameState.currentScenarioId]?.text || ''));
    renderChoices(gameScenarios[gameState.currentScenarioId]?.choices || []);
    saveGameState();
}

function initDailyGame() {
    loadGameState();
}

function resetGame() {
    if (confirm("정말로 아틀리에를 처음부터 다시 꾸미시겠습니까? 모든 작품이 사라집니다.")) {
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