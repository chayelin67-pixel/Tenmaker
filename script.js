// ==========================================
// 10 만들기 마법 왕국 (Make 10 Kingdom) Game Engine
// ==========================================
console.log("[Tenmaker Game] Script loading...");

// 기존 브라우저 localStorage 가짜 데이터 정리 마이그레이션
(function clearOldFakeRankings() {
    try {
        if (!localStorage.getItem('m10_cleaned_v2')) {
            localStorage.removeItem('m10_lb_boss_time');
            localStorage.removeItem('m10_lb_gold');
            localStorage.removeItem('m10_lb_clears');
            localStorage.setItem('m10_cleaned_v2', 'true');
        }
    } catch(e) {
        console.warn("[Tenmaker Game] LocalStorage migration error:", e);
    }
})();

// --- 게임 상태 변수 ---
window.gameState = {
    playerName: localStorage.getItem('m10_player_name') || '10마법사',
    gold: parseInt(localStorage.getItem('m10_gold')) || 100, // 기본 100골드
    clears: parseInt(localStorage.getItem('m10_clears')) || 0,
    bossBestTime: parseFloat(localStorage.getItem('m10_boss_best')) || null,
    soundEnabled: true
};
let gameState = window.gameState;

// 미니게임 상태
let currentActiveGame = null;
let gameTimer = null;
let gameTimeLeft = 0;
let currentGameScore = 0;

// 미니게임 1 상태
let g1Tiles = [];
let g1Selected = [];

// 미니게임 2 상태
let g2Bubbles = [];
let g2SelectedBubbles = [];
let g2AnimationId = null;

// 보스전 상태
let bossState = {
    currentQIndex: 0,
    startTime: 0,
    timerInterval: null,
    elapsedTime: 0,
    currentCorrectAnswer: 0
};

// --- Web Audio API 효과음 ---
let audioCtx = null;
function playSound(type) {
    if (!gameState.soundEnabled) return;
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        const now = audioCtx.currentTime;

        if (type === 'click') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'match') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(523.25, now);
            osc.frequency.setValueAtTime(659.25, now + 0.08);
            osc.frequency.setValueAtTime(783.99, now + 0.16);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);
        } else if (type === 'wrong') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.setValueAtTime(150, now + 0.1);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'boss_hit') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
            gain.gain.setValueAtTime(0.4, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 'victory') {
            const notes = [523.25, 659.25, 783.99, 1046.50];
            notes.forEach((freq, idx) => {
                const noteOsc = audioCtx.createOscillator();
                const noteGain = audioCtx.createGain();
                noteOsc.connect(noteGain);
                noteGain.connect(audioCtx.destination);
                noteOsc.frequency.setValueAtTime(freq, now + idx * 0.1);
                noteGain.gain.setValueAtTime(0.3, now + idx * 0.1);
                noteGain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.2);
                noteOsc.start(now + idx * 0.1);
                noteOsc.stop(now + idx * 0.1 + 0.2);
            });
        }
    } catch(e) {
        console.warn("[Tenmaker Game] Audio play error:", e);
    }
}

// --- 기본 랭킹 데이터 ---
const defaultBossTimeRankings = [];
const defaultGoldRankings = [];
const defaultClearRankings = [];

// --- UI 갱신 ---
function updateUIHeader() {
    try {
        const goldEl = document.getElementById('player-gold');
        const clearsEl = document.getElementById('player-clears');
        const nameEl = document.getElementById('player-name-input');

        if (goldEl) goldEl.textContent = gameState.gold.toLocaleString();
        if (clearsEl) clearsEl.textContent = gameState.clears;
        if (nameEl) nameEl.value = gameState.playerName;

        localStorage.setItem('m10_gold', gameState.gold);
        localStorage.setItem('m10_clears', gameState.clears);
        localStorage.setItem('m10_player_name', gameState.playerName);
    } catch(e) {
        console.error("[Tenmaker Game] UI Header update error:", e);
    }
}

// 초기화 및 이벤트 리스너 설정
document.addEventListener('DOMContentLoaded', () => {
    console.log("[Tenmaker Game] DOM Content Loaded.");
    updateUIHeader();
    setupEventListeners();
});

function setupEventListeners() {
    try {
        const nameInput = document.getElementById('player-name-input');
        if (nameInput) {
            nameInput.addEventListener('change', (e) => {
                const val = e.target.value.trim();
                if (val) {
                    gameState.playerName = val;
                    updateUIHeader();
                }
            });
        }

        const soundBtn = document.getElementById('btn-sound-toggle');
        if (soundBtn) {
            soundBtn.addEventListener('click', () => {
                gameState.soundEnabled = !gameState.soundEnabled;
                soundBtn.textContent = gameState.soundEnabled ? '🔊' : '🔇';
            });
        }

        const fameBtn = document.getElementById('btn-hall-of-fame');
        if (fameBtn) {
            fameBtn.addEventListener('click', openHallOfFame);
        }

        // 미니게임 카드 & 버튼 클릭 바인딩
        document.querySelectorAll('.start-game-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const gId = parseInt(btn.dataset.game || btn.getAttribute('data-game'));
                console.log("[Tenmaker Game] Start game button clicked:", gId);
                startGame(gId);
            });
        });

        // 보스전 버튼 바인딩
        const bossBtn = document.getElementById('btn-start-boss');
        if (bossBtn) {
            bossBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("[Tenmaker Game] Start boss button clicked.");
                startBossBattle();
            });
        }
    } catch(e) {
        console.error("[Tenmaker Game] setupEventListeners error:", e);
    }
}

// 뷰 전환 함수
function showView(viewId) {
    try {
        console.log("[Tenmaker Game] Switching view to:", viewId);
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
            v.style.display = 'none';
        });
        const target = document.getElementById(viewId);
        if (target) {
            target.classList.add('active');
            target.style.display = 'flex';
        }
    } catch(e) {
        console.error("[Tenmaker Game] showView error:", e);
    }
}

function quitGame() {
    playSound('click');
    clearInterval(gameTimer);
    clearInterval(bossState.timerInterval);
    if (g2AnimationId) cancelAnimationFrame(g2AnimationId);
    showView('lobby-view');
}

// 미니게임 시작 공통 트리거 (기존 타이머 완전 청소 및 중복 방지)
function startGame(gameId) {
    try {
        console.log("[Tenmaker Game] Starting game ID:", gameId);
        playSound('click');

        // 이전 타이머 및 애니메이션 완전 강제 청소
        if (gameTimer) {
            clearInterval(gameTimer);
            gameTimer = null;
        }
        if (g2AnimationId) {
            cancelAnimationFrame(g2AnimationId);
            g2AnimationId = null;
        }
        isEndingGame = false;

        if (gameId === 1) startGame1();
        else if (gameId === 2) startGame2();
        else if (gameId === 3) startGame3();
    } catch (e) {
        console.error("[Tenmaker Game] startGame error:", e);
    }
}

// ==========================================
// 미니게임 1: 스피드 짝맞추기 (25초)
// ==========================================
function startGame1() {
    if (gameTimer) { clearInterval(gameTimer); gameTimer = null; }
    currentActiveGame = 1;
    gameTimeLeft = 25;
    currentGameScore = 0;
    g1Selected = [];

    document.getElementById('g1-timer').textContent = gameTimeLeft;
    document.getElementById('g1-score').textContent = currentGameScore;

    initG1Grid();
    showView('game1-view');

    gameTimer = setInterval(() => {
        gameTimeLeft--;
        document.getElementById('g1-timer').textContent = gameTimeLeft;
        if (gameTimeLeft <= 0) {
            endMiniGame(1);
        }
    }, 1000);
}

function initG1Grid() {
    const gridEl = document.getElementById('g1-grid');
    gridEl.innerHTML = '';
    g1Tiles = [];

    for (let i = 0; i < 8; i++) {
        const num1 = Math.floor(Math.random() * 9) + 1;
        const num2 = 10 - num1;
        g1Tiles.push(num1, num2);
    }
    g1Tiles.sort(() => Math.random() - 0.5);

    g1Tiles.forEach((num, index) => {
        const tile = document.createElement('div');
        tile.className = 'num-tile';
        tile.textContent = num;
        tile.dataset.index = index;
        tile.dataset.val = num;
        tile.addEventListener('click', () => onG1TileClick(tile, index, num));
        gridEl.appendChild(tile);
    });
}

function onG1TileClick(tileEl, index, val) {
    if (tileEl.classList.contains('matched') || tileEl.classList.contains('selected')) return;
    playSound('click');

    tileEl.classList.add('selected');
    g1Selected.push({ element: tileEl, index, val });

    if (g1Selected.length === 2) {
        const [first, second] = g1Selected;
        if (first.val + second.val === 10) {
            playSound('match');
            first.element.classList.remove('selected');
            second.element.classList.remove('selected');
            first.element.classList.add('matched');
            second.element.classList.add('matched');

            currentGameScore += 10;
            document.getElementById('g1-score').textContent = currentGameScore;
            g1Selected = [];

            setTimeout(() => {
                replaceG1Tiles(first.element, second.element);
            }, 300);
        } else {
            playSound('wrong');
            setTimeout(() => {
                first.element.classList.remove('selected');
                second.element.classList.remove('selected');
                g1Selected = [];
            }, 300);
        }
    }
}

function replaceG1Tiles(el1, el2) {
    const num1 = Math.floor(Math.random() * 9) + 1;
    const num2 = 10 - num1;

    [ {el: el1, val: num1}, {el: el2, val: num2} ].forEach(item => {
        item.el.classList.remove('matched');
        item.el.textContent = item.val;
        item.el.dataset.val = item.val;
    });
}

// ==========================================
// 미니게임 2: 10 버블 팝 (30초)
// ==========================================
function startGame2() {
    if (gameTimer) { clearInterval(gameTimer); gameTimer = null; }
    currentActiveGame = 2;
    gameTimeLeft = 30;
    currentGameScore = 0;
    g2Bubbles = [];
    g2SelectedBubbles = [];

    document.getElementById('g2-timer').textContent = gameTimeLeft;
    document.getElementById('g2-score').textContent = currentGameScore;

    showView('game2-view');
    initG2Stage();

    gameTimer = setInterval(() => {
        gameTimeLeft--;
        document.getElementById('g2-timer').textContent = gameTimeLeft;
        if (gameTimeLeft <= 0) {
            endMiniGame(2);
        }
    }, 1000);
}

function initG2Stage() {
    const stage = document.getElementById('g2-canvas-area');
    stage.innerHTML = '';
    g2Bubbles = [];

    // 7개의 다양한 숫자 방울 생성
    for (let i = 0; i < 7; i++) {
        spawnG2Bubble(stage);
    }

    function loop() {
        // 터지지 않고 살아있는 방울들만 이동 틱 처리
        g2Bubbles.forEach(b => {
            if (b.isPopped) return;
            b.y += b.speed;
            if (b.y > 325) {
                b.y = -60;
                b.x = Math.random() * (stage.clientWidth - 70);
            }
            if (b.el && b.el.parentNode) {
                b.el.style.top = b.y + 'px';
                b.el.style.left = b.x + 'px';
            }
        });

        if (currentActiveGame === 2 && gameTimeLeft > 0) {
            g2AnimationId = requestAnimationFrame(loop);
        }
    }
    g2AnimationId = requestAnimationFrame(loop);
}

function spawnG2Bubble(stage) {
    const el = document.createElement('div');
    el.className = 'bubble';
    
    // 1~9 사이의 다양하고 풍성한 숫자 조합
    let val = Math.floor(Math.random() * 9) + 1;
    if (g2Bubbles.length > 1 && Math.random() < 0.5) {
        const liveBubbles = g2Bubbles.filter(b => !b.isPopped);
        if (liveBubbles.length > 0) {
            const targetB = liveBubbles[Math.floor(Math.random() * liveBubbles.length)];
            val = 10 - targetB.val;
        }
    }
    
    val = Math.max(1, Math.min(9, val));
    el.textContent = val;

    const x = Math.random() * (stage.clientWidth - 70);
    const y = Math.random() * -300;
    const speed = 0.9 + Math.random() * 1.3;

    const bObj = { el, val, x, y, speed, isPopped: false, id: Math.random() };
    g2Bubbles.push(bObj);

    el.addEventListener('click', () => onG2BubbleClick(bObj, stage));
    stage.appendChild(el);
}

function onG2BubbleClick(bObj, stage) {
    if (bObj.isPopped || g2SelectedBubbles.includes(bObj)) return;
    playSound('click');

    bObj.el.classList.add('selected');
    g2SelectedBubbles.push(bObj);

    if (g2SelectedBubbles.length === 2) {
        const [b1, b2] = g2SelectedBubbles;
        if (b1.val + b2.val === 10) {
            // 선택한 2개 방울 팝 터뜨리기 (화면에서 완전히 제거)
            playSound('match');
            currentGameScore += 10;
            document.getElementById('g2-score').textContent = currentGameScore;

            [b1, b2].forEach(b => {
                b.isPopped = true;
                if (b.el && b.el.parentNode) {
                    b.el.style.transform = "scale(1.4)";
                    b.el.style.opacity = "0";
                    setTimeout(() => b.el.remove(), 150);
                }
                g2Bubbles = g2Bubbles.filter(item => item !== b);
                spawnG2Bubble(stage);
            });
            g2SelectedBubbles = [];
        } else {
            playSound('wrong');
            setTimeout(() => {
                if (b1.el) b1.el.classList.remove('selected');
                if (b2.el) b2.el.classList.remove('selected');
                g2SelectedBubbles = [];
            }, 300);
        }
    }
}

// ==========================================
// 미니게임 3: 초스피드 10 퀴즈 (20초)
// ==========================================
function startGame3() {
    if (gameTimer) { clearInterval(gameTimer); gameTimer = null; }
    currentActiveGame = 3;
    gameTimeLeft = 20;
    currentGameScore = 0;

    document.getElementById('g3-timer').textContent = gameTimeLeft;
    document.getElementById('g3-score').textContent = currentGameScore;

    showView('game3-view');
    generateG3Question();

    gameTimer = setInterval(() => {
        gameTimeLeft--;
        document.getElementById('g3-timer').textContent = gameTimeLeft;
        if (gameTimeLeft <= 0) {
            endMiniGame(3);
        }
    }, 1000);
}

function generateG3Question() {
    const qType = Math.floor(Math.random() * 3);
    let qText = '';
    let correctAns = 0;

    if (qType === 0) {
        const a = Math.floor(Math.random() * 9) + 1;
        correctAns = 10 - a;
        qText = `? + ${a} = 10`;
    } else if (qType === 1) {
        const b = Math.floor(Math.random() * 9) + 1;
        correctAns = 10 - b;
        qText = `10 - ${b} = ?`;
    } else {
        const a = Math.floor(Math.random() * 5) + 1;
        const b = Math.floor(Math.random() * (9 - a)) + 1;
        correctAns = 10 - (a + b);
        qText = `${a} + ? + ${b} = 10`;
    }

    document.getElementById('g3-question').textContent = qText;

    const options = new Set([correctAns]);
    while (options.size < 4) {
        const fake = Math.floor(Math.random() * 9) + 1;
        options.add(fake);
    }
    const optArray = Array.from(options).sort(() => Math.random() - 0.5);

    const optGrid = document.getElementById('g3-options');
    optGrid.innerHTML = '';

    optArray.forEach(val => {
        const btn = document.createElement('button');
        btn.className = 'quiz-opt-btn';
        btn.textContent = val;
        btn.onclick = () => {
            if (val === correctAns) {
                playSound('match');
                currentGameScore += 10;
                document.getElementById('g3-score').textContent = currentGameScore;
                generateG3Question();
            } else {
                playSound('wrong');
            }
        };
        optGrid.appendChild(btn);
    });
}

let isEndingGame = false;

// 미니게임 종결 후 보상
function endMiniGame(gameId) {
    if (isEndingGame) return;
    isEndingGame = true;

    if (gameTimer) {
        clearInterval(gameTimer);
        gameTimer = null;
    }
    if (g2AnimationId) {
        cancelAnimationFrame(g2AnimationId);
        g2AnimationId = null;
    }

    const earnedGold = Math.floor(currentGameScore * 1.5);
    gameState.gold += earnedGold;
    gameState.clears += 1;

    updateUIHeader();
    saveToLeaderboards(earnedGold);

    document.getElementById('result-title').textContent = '🎮 미니게임 클리어!';
    document.getElementById('result-icon').textContent = '🎉';
    document.getElementById('result-desc').textContent = `획득 점수: ${currentGameScore}점! 순발력이 돋보였습니다!`;
    document.getElementById('result-gold').textContent = earnedGold;
    document.getElementById('boss-time-result-box').classList.add('hidden');

    document.getElementById('result-modal').classList.add('active');
    playSound('victory');
}

let isStartingBoss = false;

// ==========================================
// 👹 보스전 (Boss Challenge)
// ==========================================
function startBossBattle() {
    try {
        if (isStartingBoss) return;
        isStartingBoss = true;

        console.log("[Tenmaker Game] Starting Boss Battle...");
        if (gameState.gold < 100) {
            isStartingBoss = false;
            alert('🪙 보스전에 도전하려면 최소 100 Gold가 필요합니다! 미니게임을 먼저 플레이하여 골드를 모으세요.');
            return;
        }

        // 100 Gold 단 1회 정확하게 차감
        gameState.gold -= 100;
        updateUIHeader();
        playSound('boss_hit');

        bossState.currentQIndex = 0;
        bossState.elapsedTime = 0;
        bossState.startTime = Date.now();

        document.getElementById('boss-hp-fill').style.width = '100%';
        document.getElementById('boss-current-q').textContent = '1';
        document.getElementById('boss-stopwatch').textContent = '00.00';

        showView('boss-view');

        bossState.timerInterval = setInterval(() => {
            const now = Date.now();
            const diff = (now - bossState.startTime) / 1000;
            bossState.elapsedTime = diff;
            document.getElementById('boss-stopwatch').textContent = diff.toFixed(2);
        }, 30);

        generateBossQuestion();
        setTimeout(() => { isStartingBoss = false; }, 500);
    } catch(e) {
        isStartingBoss = false;
        console.error("[Tenmaker Game] startBossBattle error:", e);
    }
}

function generateBossQuestion() {
    bossState.currentQIndex++;
    document.getElementById('boss-current-q').textContent = bossState.currentQIndex;

    const hpPercent = ((10 - (bossState.currentQIndex - 1)) / 10) * 100;
    document.getElementById('boss-hp-fill').style.width = hpPercent + '%';

    let qText = '';
    let correctAns = 0;

    if (bossState.currentQIndex <= 4) {
        const a = Math.floor(Math.random() * 9) + 1;
        correctAns = 10 - a;
        qText = `${a} + ? = 10`;
    } else if (bossState.currentQIndex <= 7) {
        const a = Math.floor(Math.random() * 4) + 1;
        const b = Math.floor(Math.random() * (9 - a)) + 1;
        correctAns = 10 - (a + b);
        qText = `${a} + ? + ${b} = 10`;
    } else {
        const a = Math.floor(Math.random() * 4) + 1;
        const ans = Math.floor(Math.random() * (9 - a)) + 1;
        const b = 10 - a - ans;
        correctAns = ans;
        qText = `10 - ${a} - ? = ${b}`;
    }

    bossState.currentCorrectAnswer = correctAns;
    document.getElementById('boss-question-text').textContent = qText;

    const options = new Set([correctAns]);
    while (options.size < 4) {
        const fake = Math.floor(Math.random() * 9) + 1;
        options.add(fake);
    }
    const optArray = Array.from(options).sort(() => Math.random() - 0.5);

    const grid = document.getElementById('boss-options-grid');
    grid.innerHTML = '';

    optArray.forEach(val => {
        const btn = document.createElement('button');
        btn.className = 'quiz-opt-btn';
        btn.textContent = val;
        btn.onclick = () => onBossAnswerSelect(val);
        grid.appendChild(btn);
    });
}

function onBossAnswerSelect(val) {
    if (val === bossState.currentCorrectAnswer) {
        playSound('boss_hit');
        const bossAvatar = document.getElementById('boss-avatar');
        bossAvatar.classList.add('hit');
        setTimeout(() => bossAvatar.classList.remove('hit'), 300);

        if (bossState.currentQIndex >= 10) {
            finishBossBattle();
        } else {
            generateBossQuestion();
        }
    } else {
        playSound('wrong');
        bossState.startTime -= 1500;
    }
}

function finishBossBattle() {
    clearInterval(bossState.timerInterval);
    const finalTime = parseFloat(bossState.elapsedTime.toFixed(2));

    const rewardGold = 500;
    gameState.gold += rewardGold;
    updateUIHeader();

    if (!gameState.bossBestTime || finalTime < gameState.bossBestTime) {
        gameState.bossBestTime = finalTime;
        localStorage.setItem('m10_boss_best', finalTime);
    }

    saveBossTimeLeaderboard(finalTime);

    document.getElementById('result-title').textContent = '👹 보스 퇴치 성공!';
    document.getElementById('result-icon').textContent = '👑';
    document.getElementById('result-desc').textContent = `10의 마왕 텐크라켄을 무찔렀습니다! ${gameState.playerName}님의 기록이 명예의 전당 클라우드에 업로드되었습니다.`;
    document.getElementById('result-gold').textContent = rewardGold;
    document.getElementById('result-boss-time').textContent = finalTime.toFixed(2);
    document.getElementById('boss-time-result-box').classList.remove('hidden');

    document.getElementById('result-modal').classList.add('active');
    playSound('victory');
}

function closeResultModal() {
    isEndingGame = false;
    document.getElementById('result-modal').classList.remove('active');
    quitGame();
}

// ==========================================
// 🏆 명예의 전당 (Leaderboard) 처리
// ==========================================
function getLeaderboard(key, defaultData) {
    const stored = localStorage.getItem(key);
    if (!stored) return defaultData;
    try {
        return JSON.parse(stored);
    } catch(e) {
        return defaultData;
    }
}

function resetGameStateToDefault() {
    console.log("[Tenmaker Game] Resetting game state to default (logged out).");
    gameState.gold = 0;
    gameState.clears = 0;
    gameState.bossBestTime = null;
    gameState.playerName = '10마법사';
    localStorage.removeItem('m10_gold');
    localStorage.removeItem('m10_clears');
    localStorage.setItem('m10_player_name', '10마법사');
    updateUIHeader();
}

window.resetGameStateToDefault = resetGameStateToDefault;
window.updateUIHeader = updateUIHeader;

function saveBossTimeLeaderboard(time) {
    let list = getLeaderboard('m10_lb_boss_time', defaultBossTimeRankings);
    list.push({ name: gameState.playerName, time: time });
    list.sort((a, b) => a.time - b.time);
    list = list.slice(0, 10);
    localStorage.setItem('m10_lb_boss_time', JSON.stringify(list));

    if (window.FirebaseService && window.FirebaseService.isReady()) {
        window.FirebaseService.saveBossTimeRecordToCloud(gameState.playerName, time);
        window.FirebaseService.saveUserDataToCloud(gameState);
    }
}

function saveToLeaderboards(earnedGold) {
    let goldList = getLeaderboard('m10_lb_gold', defaultGoldRankings);
    const existingG = goldList.find(x => x.name === gameState.playerName);
    if (existingG) {
        existingG.gold = Math.max(existingG.gold, gameState.gold);
    } else {
        goldList.push({ name: gameState.playerName, gold: gameState.gold });
    }
    goldList.sort((a, b) => b.gold - a.gold);
    localStorage.setItem('m10_lb_gold', JSON.stringify(goldList.slice(0, 10)));

    let clearList = getLeaderboard('m10_lb_clears', defaultClearRankings);
    const existingC = clearList.find(x => x.name === gameState.playerName);
    if (existingC) {
        existingC.clears = gameState.clears;
    } else {
        clearList.push({ name: gameState.playerName, clears: gameState.clears });
    }
    clearList.sort((a, b) => b.clears - a.clears);
    localStorage.setItem('m10_lb_clears', JSON.stringify(clearList.slice(0, 10)));

    // ☁️ 로그인한 계정의 Firestore 클라우드 통합 저장 (골드, 클리어 수, 닉네임)
    if (window.FirebaseService && window.FirebaseService.isReady()) {
        window.FirebaseService.saveGoldRecordToCloud(gameState.playerName, gameState.gold);
        window.FirebaseService.saveClearRecordToCloud(gameState.playerName, gameState.clears);
        window.FirebaseService.saveUserDataToCloud(gameState);
    }
}

async function openHallOfFame() {
    try {
        if (typeof playSound === 'function') playSound('click');
    } catch(e) {}
    const modal = document.getElementById('hall-modal');
    if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
    }
    await renderHallOfFame();
}

function closeHallOfFame() {
    const modal = document.getElementById('hall-modal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

function switchHallTab(tabName) {
    playSound('click');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

    document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
}

async function renderHallOfFame() {
    console.log("[Tenmaker Game] Rendering Hall of Fame...");
    const bossUl = document.getElementById('list-boss-time');
    const goldUl = document.getElementById('list-gold');
    const clearUl = document.getElementById('list-clears');

    const loadingHtml = '<li class="empty-rank">⏳ 랭킹 목록을 불러오는 중...</li>';
    if (bossUl) bossUl.innerHTML = loadingHtml;
    if (goldUl) goldUl.innerHTML = loadingHtml;
    if (clearUl) clearUl.innerHTML = loadingHtml;

    let bossList = null;
    let goldList = null;
    let clearList = null;

    if (window.FirebaseService && window.FirebaseService.isReady()) {
        try {
            bossList = await window.FirebaseService.fetchTop10CloudLeaderboard('boss-time');
            goldList = await window.FirebaseService.fetchTop10CloudLeaderboard('gold');
            clearList = await window.FirebaseService.fetchTop10CloudLeaderboard('clears');
        } catch (e) {
            console.error("[Tenmaker Game] Cloud leaderboard fetch error:", e);
        }
    }

    if (!bossList || bossList.length === 0) bossList = getLeaderboard('m10_lb_boss_time', defaultBossTimeRankings);
    if (!goldList || goldList.length === 0) goldList = getLeaderboard('m10_lb_gold', defaultGoldRankings);
    if (!clearList || clearList.length === 0) clearList = getLeaderboard('m10_lb_clears', defaultClearRankings);

    // 1. 보스 타임어택
    if (bossUl) {
        bossUl.innerHTML = '';
        if (!bossList || bossList.length === 0) {
            bossUl.innerHTML = '<li class="empty-rank">아직 등록된 기록이 없습니다. 보스를 물리치고 첫 랭커가 되어보세요! 👹</li>';
        } else {
            bossList.forEach((item, idx) => {
                const t = typeof item.time === 'number' ? item.time.toFixed(2) : (item.time || "0.00");
                bossUl.appendChild(createRankItem(idx + 1, item.name, `${t}초`));
            });
        }
    }

    // 2. 골드
    if (goldUl) {
        goldUl.innerHTML = '';
        if (!goldList || goldList.length === 0) {
            goldUl.innerHTML = '<li class="empty-rank">아직 등록된 골드 랭킹이 없습니다. 미니게임을 플레이해보세요! 🪙</li>';
        } else {
            goldList.forEach((item, idx) => {
                const g = typeof item.gold === 'number' ? item.gold.toLocaleString() : (item.gold || 0);
                goldUl.appendChild(createRankItem(idx + 1, item.name, `${g} Gold`));
            });
        }
    }

    // 3. 미니게임 클리어
    if (clearUl) {
        clearUl.innerHTML = '';
        if (!clearList || clearList.length === 0) {
            clearUl.innerHTML = '<li class="empty-rank">아직 등록된 클리어 랭킹이 없습니다. 미니게임에 도전해보세요! 🎮</li>';
        } else {
            clearList.forEach((item, idx) => {
                const c = item.clears || 0;
                clearUl.appendChild(createRankItem(idx + 1, item.name, `${c}회 클리어`));
            });
        }
    }
}

function resetLeaderboardData() {
    if (confirm('모든 명예의 전당 랭킹 기록을 초기화하시겠습니까?')) {
        localStorage.removeItem('m10_lb_boss_time');
        localStorage.removeItem('m10_lb_gold');
        localStorage.removeItem('m10_lb_clears');
        renderHallOfFame();
        alert('모든 랭킹 기록이 깔끔하게 초기화되었습니다!');
    }
}

function createRankItem(rank, name, valueStr) {
    const li = document.createElement('li');
    li.className = 'ranking-item';
    if (name === gameState.playerName) li.classList.add('my-rank');

    let badgeClass = '';
    if (rank === 1) badgeClass = 'rank-1';
    else if (rank === 2) badgeClass = 'rank-2';
    else if (rank === 3) badgeClass = 'rank-3';

    li.innerHTML = `
        <div class="rank-badge ${badgeClass}">${rank}</div>
        <div class="rank-user-info">
            <span class="rank-name">${escapeHtml(name)}</span>
        </div>
        <div class="rank-value">${valueStr}</div>
    `;
    return li;
}

function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// --- 전역 함수 명시적 바인딩 ---
window.startGame = startGame;
window.startBossBattle = startBossBattle;
window.quitGame = quitGame;
window.closeResultModal = closeResultModal;
window.switchHallTab = switchHallTab;
window.openHallOfFame = openHallOfFame;
window.closeHallOfFame = closeHallOfFame;
window.resetLeaderboardData = resetLeaderboardData;

console.log("[Tenmaker Game] Script fully initialized.");
