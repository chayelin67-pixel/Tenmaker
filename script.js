// ==========================================
// 10 만들기 마법 왕국 (Make 10 Kingdom) Logic
// ==========================================

// 기존 브라우저 localStorage에 잔존하는 가짜 랭킹 데이터 삭제 마이그레이션
(function clearOldFakeRankings() {
    if (!localStorage.getItem('m10_cleaned_v2')) {
        localStorage.removeItem('m10_lb_boss_time');
        localStorage.removeItem('m10_lb_gold');
        localStorage.removeItem('m10_lb_clears');
        localStorage.setItem('m10_cleaned_v2', 'true');
    }
})();

// --- 게임 상태 변수 ---
let gameState = {
    playerName: localStorage.getItem('m10_player_name') || '10마법사',
    gold: parseInt(localStorage.getItem('m10_gold')) || 100, // 기본 100골드 지급
    clears: parseInt(localStorage.getItem('m10_clears')) || 0,
    bossBestTime: parseFloat(localStorage.getItem('m10_boss_best')) || null,
    soundEnabled: true
};

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

// --- Web Audio API 합성 효과음 ---
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
            osc.frequency.setValueAtTime(523.25, now); // C5
            osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
            osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
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
            osc.type = 'sine';
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
        console.log("Audio error:", e);
    }
}

// --- 기본 랭킹 데이터 (초기 상태는 빈 배열) ---
const defaultBossTimeRankings = [];
const defaultGoldRankings = [];
const defaultClearRankings = [];

// --- 초기화 및 UI 갱신 ---
document.addEventListener('DOMContentLoaded', () => {
    updateUIHeader();
    setupEventListeners();
});

function updateUIHeader() {
    document.getElementById('player-gold').textContent = gameState.gold.toLocaleString();
    document.getElementById('player-clears').textContent = gameState.clears;
    document.getElementById('player-name-input').value = gameState.playerName;
    
    localStorage.setItem('m10_gold', gameState.gold);
    localStorage.setItem('m10_clears', gameState.clears);
    localStorage.setItem('m10_player_name', gameState.playerName);
}

function setupEventListeners() {
    document.getElementById('player-name-input').addEventListener('change', (e) => {
        const val = e.target.value.trim();
        if (val) {
            gameState.playerName = val;
            updateUIHeader();
        }
    });

    document.getElementById('btn-sound-toggle').addEventListener('click', () => {
        gameState.soundEnabled = !gameState.soundEnabled;
        document.getElementById('btn-sound-toggle').textContent = gameState.soundEnabled ? '🔊' : '🔇';
    });

    document.getElementById('btn-hall-of-fame').addEventListener('click', openHallOfFame);

    // --- Firebase Auth 이벤트 핸들러 ---
    const btnGoogle = document.getElementById('btn-google-login');
    const btnLogout = document.getElementById('btn-logout');

    if (btnGoogle) {
        btnGoogle.addEventListener('click', () => {
            if (window.FirebaseService) {
                window.FirebaseService.loginWithGoogle().catch(err => console.log("Login error or canceled:", err));
            }
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            if (window.FirebaseService) {
                window.FirebaseService.logoutUser();
            }
        });
    }

    // Firebase Auth 상태 관찰
    setTimeout(() => {
        if (window.FirebaseService && window.FirebaseService.listenAuthState) {
            window.FirebaseService.listenAuthState((user) => {
                const imgEl = document.getElementById('user-photo');
                const iconEl = document.getElementById('user-avatar-icon');
                const nameInput = document.getElementById('player-name-input');

                if (user) {
                    // 로그인 성공
                    btnGoogle.classList.add('hidden');
                    btnLogout.classList.remove('hidden');

                    if (user.photoURL) {
                        imgEl.src = user.photoURL;
                        imgEl.classList.remove('hidden');
                        iconEl.classList.add('hidden');
                    }
                    if (user.displayName) {
                        gameState.playerName = user.displayName;
                        nameInput.value = user.displayName;
                    }
                } else {
                    // 로그아웃 상태
                    btnGoogle.classList.remove('hidden');
                    btnLogout.classList.add('hidden');
                    imgEl.classList.add('hidden');
                    iconEl.classList.remove('hidden');
                }
            });
        }
    }, 500);
}

// 뷰 전환 함수
function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

function quitGame() {
    playSound('click');
    clearInterval(gameTimer);
    clearInterval(bossState.timerInterval);
    if (g2AnimationId) cancelAnimationFrame(g2AnimationId);
    showView('lobby-view');
}

// ==========================================
// 미니게임 1: 스피드 짝맞추기 (25초)
// ==========================================
function startGame1() {
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

    // 16개 타일 생성 (쌍이 항상 10이 될 수 있도록 생성)
    for (let i = 0; i < 8; i++) {
        const num1 = Math.floor(Math.random() * 9) + 1; // 1~9
        const num2 = 10 - num1;
        g1Tiles.push(num1, num2);
    }
    // 셔플
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
            // 정답! 10 매칭 성공
            playSound('match');
            first.element.classList.remove('selected');
            second.element.classList.remove('selected');
            first.element.classList.add('matched');
            second.element.classList.add('matched');

            currentGameScore += 10;
            document.getElementById('g1-score').textContent = currentGameScore;
            g1Selected = [];

            // 타일 채우기
            setTimeout(() => {
                replaceG1Tiles(first.element, second.element);
            }, 300);
        } else {
            // 틀림
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

    // 7개의 버블 주기적 스폰
    for (let i = 0; i < 6; i++) {
        spawnG2Bubble(stage);
    }

    function loop() {
        g2Bubbles.forEach(b => {
            b.y += b.speed;
            if (b.y > 320) {
                b.y = -60;
                b.x = Math.random() * (stage.clientWidth - 70);
            }
            b.el.style.top = b.y + 'px';
            b.el.style.left = b.x + 'px';
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
    const val = Math.floor(Math.random() * 9) + 1;
    el.textContent = val;

    const x = Math.random() * (stage.clientWidth - 70);
    const y = Math.random() * -300;
    const speed = 1 + Math.random() * 1.2;

    const bObj = { el, val, x, y, speed, id: Math.random() };
    g2Bubbles.push(bObj);

    el.addEventListener('click', () => onG2BubbleClick(bObj, stage));
    stage.appendChild(el);
}

function onG2BubbleClick(bObj, stage) {
    if (g2SelectedBubbles.includes(bObj)) return;
    playSound('click');

    bObj.el.classList.add('selected');
    g2SelectedBubbles.push(bObj);

    if (g2SelectedBubbles.length === 2) {
        const [b1, b2] = g2SelectedBubbles;
        if (b1.val + b2.val === 10) {
            // 버블 팝!
            playSound('match');
            currentGameScore += 10;
            document.getElementById('g2-score').textContent = currentGameScore;

            // 제거 후 재생성
            [b1, b2].forEach(b => {
                b.el.remove();
                g2Bubbles = g2Bubbles.filter(item => item !== b);
                spawnG2Bubble(stage);
            });
            g2SelectedBubbles = [];
        } else {
            playSound('wrong');
            setTimeout(() => {
                b1.el.classList.remove('selected');
                b2.el.classList.remove('selected');
                g2SelectedBubbles = [];
            }, 300);
        }
    }
}

// ==========================================
// 미니게임 3: 초스피드 10 퀴즈 (20초)
// ==========================================
function startGame3() {
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
        // ? + A = 10
        const a = Math.floor(Math.random() * 9) + 1;
        correctAns = 10 - a;
        qText = `? + ${a} = 10`;
    } else if (qType === 1) {
        // 10 - B = ?
        const b = Math.floor(Math.random() * 9) + 1;
        correctAns = 10 - b;
        qText = `10 - ${b} = ?`;
    } else {
        // A + ? + B = 10
        const a = Math.floor(Math.random() * 5) + 1;
        const b = Math.floor(Math.random() * (9 - a)) + 1;
        correctAns = 10 - (a + b);
        qText = `${a} + ? + ${b} = 10`;
    }

    document.getElementById('g3-question').textContent = qText;

    // 보기 4개 생성
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

// 미니게임 시작 공통 트리거
function startGame(gameId) {
    if (gameId === 1) startGame1();
    else if (gameId === 2) startGame2();
    else if (gameId === 3) startGame3();
}

// 미니게임 종결 후 보상
function endMiniGame(gameId) {
    clearInterval(gameTimer);
    if (g2AnimationId) cancelAnimationFrame(g2AnimationId);

    const earnedGold = Math.floor(currentGameScore * 1.5);
    gameState.gold += earnedGold;
    gameState.clears += 1;

    updateUIHeader();
    saveToLeaderboards(earnedGold);

    // 결과 모달 표시
    document.getElementById('result-title').textContent = '🎮 미니게임 클리어!';
    document.getElementById('result-icon').textContent = '🎉';
    document.getElementById('result-desc').textContent = `획득 점수: ${currentGameScore}점! 순발력이 돋보였습니다!`;
    document.getElementById('result-gold').textContent = earnedGold;
    document.getElementById('boss-time-result-box').classList.add('hidden');

    document.getElementById('result-modal').classList.add('active');
    playSound('victory');
}

// ==========================================
// 👹 보스전 (Boss Challenge)
// ==========================================
function startBossBattle() {
    if (gameState.gold < 100) {
        alert('🪙 보스전에 도전하려면 최소 100 Gold가 필요합니다! 미니게임을 먼저 플레이하세요.');
        return;
    }

    // 골드 차감
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

    // 스톱워치 인터벌 (10ms 단위 갱신)
    bossState.timerInterval = setInterval(() => {
        const now = Date.now();
        const diff = (now - bossState.startTime) / 1000;
        bossState.elapsedTime = diff;
        document.getElementById('boss-stopwatch').textContent = diff.toFixed(2);
    }, 30);

    generateBossQuestion();
}

function generateBossQuestion() {
    bossState.currentQIndex++;
    document.getElementById('boss-current-q').textContent = bossState.currentQIndex;

    const hpPercent = ((10 - (bossState.currentQIndex - 1)) / 10) * 100;
    document.getElementById('boss-hp-fill').style.width = hpPercent + '%';

    // 10의 마왕 문제 출제 (점진적 난이도 증가)
    let qText = '';
    let correctAns = 0;

    if (bossState.currentQIndex <= 4) {
        // 단일 미지수: A + ? = 10
        const a = Math.floor(Math.random() * 9) + 1;
        correctAns = 10 - a;
        qText = `${a} + ? = 10`;
    } else if (bossState.currentQIndex <= 7) {
        // 3개 연산: A + ? + B = 10
        const a = Math.floor(Math.random() * 4) + 1;
        const b = Math.floor(Math.random() * (9 - a)) + 1;
        correctAns = 10 - (a + b);
        qText = `${a} + ? + ${b} = 10`;
    } else {
        // 혼합 연산: 10 - A - ? = B
        const a = Math.floor(Math.random() * 4) + 1; // 1~4
        const ans = Math.floor(Math.random() * (9 - a)) + 1;
        const b = 10 - a - ans;
        correctAns = ans;
        qText = `10 - ${a} - ? = ${b}`;
    }

    bossState.currentCorrectAnswer = correctAns;
    document.getElementById('boss-question-text').textContent = qText;

    // 보기 4개 생성
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
        // 맞춤!
        playSound('boss_hit');
        const bossAvatar = document.getElementById('boss-avatar');
        bossAvatar.classList.add('hit');
        setTimeout(() => bossAvatar.classList.remove('hit'), 300);

        if (bossState.currentQIndex >= 10) {
            // 보스 완파 성공!
            finishBossBattle();
        } else {
            generateBossQuestion();
        }
    } else {
        // 틀림 -> 시간 페널티 +1.5초!
        playSound('wrong');
        bossState.startTime -= 1500; // 스톱워치 1.5초 추가 효과
    }
}

function finishBossBattle() {
    clearInterval(bossState.timerInterval);
    const finalTime = parseFloat(bossState.elapsedTime.toFixed(2));

    const rewardGold = 500;
    gameState.gold += rewardGold;
    updateUIHeader();

    // 최단 기록 업데이트 확인
    if (!gameState.bossBestTime || finalTime < gameState.bossBestTime) {
        gameState.bossBestTime = finalTime;
        localStorage.setItem('m10_boss_best', finalTime);
    }

    // 랭킹 저장
    saveBossTimeLeaderboard(finalTime);

    // 결과 창
    document.getElementById('result-title').textContent = '👹 보스 퇴치 성공!';
    document.getElementById('result-icon').textContent = '👑';
    document.getElementById('result-desc').textContent = `10의 마왕 텐크라켄을 무찔렀습니다! 명예의 전당 기록에 업로드되었습니다.`;
    document.getElementById('result-gold').textContent = rewardGold;
    document.getElementById('result-boss-time').textContent = finalTime.toFixed(2);
    document.getElementById('boss-time-result-box').classList.remove('hidden');

    document.getElementById('result-modal').classList.add('active');
    playSound('victory');
}

function closeResultModal() {
    document.getElementById('result-modal').classList.remove('active');
    quitGame();
}

// ==========================================
// 🏆 명예의 전당 (Leaderboard) 저장 및 처리
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

function saveBossTimeLeaderboard(time) {
    // 1. LocalStorage 저장
    let list = getLeaderboard('m10_lb_boss_time', defaultBossTimeRankings);
    list.push({ name: gameState.playerName, time: time });
    list.sort((a, b) => a.time - b.time);
    list = list.slice(0, 10);
    localStorage.setItem('m10_lb_boss_time', JSON.stringify(list));

    // 2. Firebase Cloud Firestore 저장
    if (window.FirebaseService && window.FirebaseService.isReady()) {
        window.FirebaseService.saveBossTimeRecordToCloud(gameState.playerName, time);
    }
}

function saveToLeaderboards(earnedGold) {
    // 1. LocalStorage 저장
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

    // 2. Firebase Cloud Firestore 저장
    if (window.FirebaseService && window.FirebaseService.isReady()) {
        window.FirebaseService.saveGoldRecordToCloud(gameState.playerName, gameState.gold);
        window.FirebaseService.saveClearRecordToCloud(gameState.playerName, gameState.clears);
    }
}

async function renderHallOfFame() {
    // Firebase Cloud 데이터 시도 후 Local fallback
    let bossList = null;
    let goldList = null;
    let clearList = null;

    if (window.FirebaseService && window.FirebaseService.isReady()) {
        bossList = await window.FirebaseService.fetchTop10CloudLeaderboard('boss-time');
        goldList = await window.FirebaseService.fetchTop10CloudLeaderboard('gold');
        clearList = await window.FirebaseService.fetchTop10CloudLeaderboard('clears');
    }

    if (!bossList) bossList = getLeaderboard('m10_lb_boss_time', defaultBossTimeRankings);
    if (!goldList) goldList = getLeaderboard('m10_lb_gold', defaultGoldRankings);
    if (!clearList) clearList = getLeaderboard('m10_lb_clears', defaultClearRankings);

    // 1. 보스 타임어택
    const bossUl = document.getElementById('list-boss-time');
    bossUl.innerHTML = '';
    if (!bossList || bossList.length === 0) {
        bossUl.innerHTML = '<li class="empty-rank">아직 등록된 기록이 없습니다. 보스를 물리치고 첫 랭커가 되어보세요! 👹</li>';
    } else {
        bossList.forEach((item, idx) => {
            const t = typeof item.time === 'number' ? item.time.toFixed(2) : item.time;
            bossUl.appendChild(createRankItem(idx + 1, item.name, `${t}초`));
        });
    }

    // 2. 골드
    const goldUl = document.getElementById('list-gold');
    goldUl.innerHTML = '';
    if (!goldList || goldList.length === 0) {
        goldUl.innerHTML = '<li class="empty-rank">아직 등록된 골드 랭킹이 없습니다. 미니게임을 플레이해보세요! 🪙</li>';
    } else {
        goldList.forEach((item, idx) => {
            const g = typeof item.gold === 'number' ? item.gold.toLocaleString() : item.gold;
            goldUl.appendChild(createRankItem(idx + 1, item.name, `${g} Gold`));
        });
    }

    // 3. 미니게임 클리어
    const clearUl = document.getElementById('list-clears');
    clearUl.innerHTML = '';
    if (!clearList || clearList.length === 0) {
        clearUl.innerHTML = '<li class="empty-rank">아직 등록된 클리어 랭킹이 없습니다. 미니게임에 도전해보세요! 🎮</li>';
    } else {
        clearList.forEach((item, idx) => {
            clearUl.appendChild(createRankItem(idx + 1, item.name, `${item.clears}회 클리어`));
        });
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
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
