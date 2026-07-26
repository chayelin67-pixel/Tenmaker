// ===================================================
// Firebase & Auth Master Manager Module
// ===================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithRedirect,
    getRedirectResult, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    orderBy, 
    limit, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 환경변수 또는 발급받은 Firebase 키 적용
const env = window.__FIREBASE_ENV__ || {};

const firebaseConfig = {
    apiKey: (env.apiKey && !env.apiKey.includes("%")) ? env.apiKey : "AIzaSyCSUWNWUOf3fSTALAhKVJYOh5K60d-MyNo",
    authDomain: (env.authDomain && !env.authDomain.includes("%")) ? env.authDomain : "tenmaker-b5cfb.firebaseapp.com",
    projectId: (env.projectId && !env.projectId.includes("%")) ? env.projectId : "tenmaker-b5cfb",
    storageBucket: (env.storageBucket && !env.storageBucket.includes("%")) ? env.storageBucket : "tenmaker-b5cfb.firebasestorage.app",
    messagingSenderId: (env.messagingSenderId && !env.messagingSenderId.includes("%")) ? env.messagingSenderId : "426782247861",
    appId: (env.appId && !env.appId.includes("%")) ? env.appId : "1:426782247861:web:f46014348187d4d39667fc"
};

let app, auth, db;
let isFirebaseReady = false;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    isFirebaseReady = true;
    console.log("🔥 Firebase Master Module Ready!");
} catch (e) {
    console.error("Firebase Initialization Error:", e);
}

// 100% 확실하게 구글 로그인 실행하는 핵심 함수
export function executeGoogleLogin() {
    console.log("--> executeGoogleLogin triggered!");
    if (!isFirebaseReady || !auth) {
        alert("Firebase가 아직 로딩 중입니다. 1~2초 후 다시 눌러주세요.");
        return;
    }
    const provider = new GoogleAuthProvider();
    signInWithRedirect(auth, provider).catch((err) => {
        console.error("Redirect Login Error:", err);
        alert(`로그인 오류 (${err.code}): ${err.message}`);
    });
}

// 로그아웃
export function executeLogout() {
    if (auth) signOut(auth);
}

let hasShownWelcome = false;

// 리다이렉트 성공 감지 및 Auth 상태 구독
if (auth) {
    getRedirectResult(auth).then((result) => {
        if (result && result.user) {
            console.log("Redirect login result user:", result.user.displayName);
        }
    }).catch(err => console.error("Redirect Error:", err));

    onAuthStateChanged(auth, (user) => {
        const btnLogin = document.getElementById('btn-google-login');
        const btnLogout = document.getElementById('btn-logout');
        const imgEl = document.getElementById('user-photo');
        const iconEl = document.getElementById('user-avatar-icon');
        const nameInput = document.getElementById('player-name-input');

        if (user) {
            console.log("User authenticated:", user.displayName || user.email);
            
            // UI 교체
            if (btnLogin) {
                btnLogin.style.display = 'none';
                btnLogin.classList.add('hidden');
            }
            if (btnLogout) {
                btnLogout.style.display = 'inline-flex';
                btnLogout.classList.remove('hidden');
            }

            if (user.photoURL && imgEl) {
                imgEl.src = user.photoURL;
                imgEl.classList.remove('hidden');
                imgEl.style.display = 'inline-block';
                if (iconEl) iconEl.style.display = 'none';
            }
            if (user.displayName && nameInput) {
                const displayName = user.displayName;
                nameInput.value = displayName;
                if (window.gameState) window.gameState.playerName = displayName;
                localStorage.setItem('m10_player_name', displayName);
            }

            if (!hasShownWelcome) {
                hasShownWelcome = true;
                const name = user.displayName || "마법사";
                alert(`🎉 로그인 성공!\n${name}님 환영합니다! 모은 골드와 기록이 명예의 전당 클라우드에 안전하게 저장됩니다.`);
            }
        } else {
            console.log("User signed out.");
            hasShownWelcome = false;
            if (btnLogin) {
                btnLogin.style.display = 'inline-flex';
                btnLogin.classList.remove('hidden');
                btnLogin.innerText = "로그인";
                btnLogin.style.opacity = "1";
            }
            if (btnLogout) {
                btnLogout.style.display = 'none';
                btnLogout.classList.add('hidden');
            }
            if (imgEl) imgEl.style.display = 'none';
            if (iconEl) iconEl.style.display = 'inline-block';
        }
    });
}

// DOM이 완료되면 로그인/로그아웃 버튼에 이벤트를 직접 부착
document.addEventListener('DOMContentLoaded', () => {
    const btnLogin = document.getElementById('btn-google-login');
    const btnLogout = document.getElementById('btn-logout');

    if (btnLogin) {
        btnLogin.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("Login button clicked!");
            btnLogin.innerText = "이동 중...";
            btnLogin.style.opacity = "0.6";
            executeGoogleLogin();
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            executeLogout();
        });
    }
});

// Firestore 서비스 exports
export async function saveBossTimeRecordToCloud(playerName, timeSec) {
    if (!isFirebaseReady || !db) return false;
    try {
        await addDoc(collection(db, "lb_boss_time"), {
            name: playerName,
            time: timeSec,
            uid: auth && auth.currentUser ? auth.currentUser.uid : "anonymous",
            createdAt: serverTimestamp()
        });
        return true;
    } catch (e) {
        console.error("Firestore Save Error (Boss Time):", e);
        return false;
    }
}

export async function saveGoldRecordToCloud(playerName, goldAmount) {
    if (!isFirebaseReady || !db) return false;
    try {
        await addDoc(collection(db, "lb_gold"), {
            name: playerName,
            gold: goldAmount,
            uid: auth && auth.currentUser ? auth.currentUser.uid : "anonymous",
            createdAt: serverTimestamp()
        });
        return true;
    } catch (e) {
        console.error("Firestore Save Error (Gold):", e);
        return false;
    }
}

export async function saveClearRecordToCloud(playerName, totalClears) {
    if (!isFirebaseReady || !db) return false;
    try {
        await addDoc(collection(db, "lb_clears"), {
            name: playerName,
            clears: totalClears,
            uid: auth && auth.currentUser ? auth.currentUser.uid : "anonymous",
            createdAt: serverTimestamp()
        });
        return true;
    } catch (e) {
        console.error("Firestore Save Error (Clears):", e);
        return false;
    }
}

export async function fetchTop10CloudLeaderboard(category) {
    if (!isFirebaseReady || !db) return null;
    try {
        let q;
        if (category === 'boss-time') {
            q = query(collection(db, "lb_boss_time"), orderBy("time", "asc"), limit(10));
        } else if (category === 'gold') {
            q = query(collection(db, "lb_gold"), orderBy("gold", "desc"), limit(10));
        } else if (category === 'clears') {
            q = query(collection(db, "lb_clears"), orderBy("clears", "desc"), limit(10));
        }

        const querySnapshot = await getDocs(q);
        const results = [];
        querySnapshot.forEach((doc) => {
            results.push(doc.data());
        });
        return results;
    } catch (e) {
        console.error("Firestore Fetch Leaderboard Error:", e);
        return null;
    }
}

window.FirebaseService = {
    isReady: () => isFirebaseReady,
    executeGoogleLogin,
    executeLogout,
    saveBossTimeRecordToCloud,
    saveGoldRecordToCloud,
    saveClearRecordToCloud,
    fetchTop10CloudLeaderboard
};
