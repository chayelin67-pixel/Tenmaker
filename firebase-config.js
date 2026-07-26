// ===================================================
// Firebase & Auth Master Manager Module (Popup Direct)
// ===================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup,
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

// UI 업데이트 핵심 전역 헬퍼
function applyUserToUI(user) {
    const btnLogin = document.getElementById('btn-google-login');
    const btnLogout = document.getElementById('btn-logout');
    const imgEl = document.getElementById('user-photo');
    const iconEl = document.getElementById('user-avatar-icon');
    const nameInput = document.getElementById('player-name-input');

    if (user) {
        console.log("Applying user UI:", user.displayName);
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
            try {
                nameInput.value = user.displayName;
                if (window.gameState) {
                    window.gameState.playerName = user.displayName;
                }
                localStorage.setItem('m10_player_name', user.displayName);
            } catch(e) {
                console.log("Sync error:", e);
            }
        }
    } else {
        if (btnLogin) {
            btnLogin.style.display = 'inline-flex';
            btnLogin.classList.remove('hidden');
        }
        if (btnLogout) {
            btnLogout.style.display = 'none';
            btnLogout.classList.add('hidden');
        }
        if (imgEl) imgEl.style.display = 'none';
        if (iconEl) iconEl.style.display = 'inline-block';
    }
}

// 팝업 직동 구글 로그인 함수
export function executeGoogleLogin() {
    if (!isFirebaseReady || !auth) {
        alert("Firebase 로딩 중입니다. 잠시 후 다시 시도해 주세요.");
        return;
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    signInWithPopup(auth, provider)
        .then((result) => {
            console.log("Popup Login Success:", result.user);
            applyUserToUI(result.user);
            alert(`🎉 로그인 완료!\n${result.user.displayName || '마법사'}님 환영합니다!`);
        })
        .catch((err) => {
            console.error("Popup Login Error:", err);
            if (err.code === 'auth/unauthorized-domain') {
                alert(`[도메인 승인 필요]\n현재 접속한 주소(${window.location.hostname})가 Firebase 콘솔의 Authorized Domains에 추가되어야 합니다.`);
            } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
                alert(`로그인 중 오류가 발생했습니다 (${err.code}): ${err.message}`);
            }
        });
}

// 로그아웃
export function executeLogout() {
    if (auth) {
        signOut(auth).then(() => {
            applyUserToUI(null);
            alert("로그아웃 되었습니다.");
        });
    }
}

// 로그인 상태 변경 상시 감지
if (auth) {
    onAuthStateChanged(auth, (user) => {
        applyUserToUI(user);
    });
}

// DOM 클릭 이벤트 바인딩
document.addEventListener('DOMContentLoaded', () => {
    const btnLogin = document.getElementById('btn-google-login');
    const btnLogout = document.getElementById('btn-logout');

    if (btnLogin) {
        btnLogin.onclick = (e) => {
            if (e) e.preventDefault();
            executeGoogleLogin();
        };
    }

    if (btnLogout) {
        btnLogout.onclick = (e) => {
            if (e) e.preventDefault();
            executeLogout();
        };
    }
});

// Firestore 서비스 exports (구글 유저 UID 및 프로필 포함 저장)
export async function saveBossTimeRecordToCloud(playerName, timeSec) {
    if (!isFirebaseReady || !db) return false;
    try {
        const currentUser = auth ? auth.currentUser : null;
        await addDoc(collection(db, "lb_boss_time"), {
            uid: currentUser ? currentUser.uid : "anonymous",
            name: playerName || (currentUser ? currentUser.displayName : "마법사"),
            photoURL: currentUser ? currentUser.photoURL : "",
            time: parseFloat(timeSec),
            createdAt: serverTimestamp()
        });
        console.log("🔥 Cloud Boss Time Record Saved!");
        return true;
    } catch (e) {
        console.error("Firestore Save Error (Boss Time):", e);
        return false;
    }
}

export async function saveGoldRecordToCloud(playerName, goldAmount) {
    if (!isFirebaseReady || !db) return false;
    try {
        const currentUser = auth ? auth.currentUser : null;
        await addDoc(collection(db, "lb_gold"), {
            uid: currentUser ? currentUser.uid : "anonymous",
            name: playerName || (currentUser ? currentUser.displayName : "마법사"),
            photoURL: currentUser ? currentUser.photoURL : "",
            gold: parseInt(goldAmount),
            createdAt: serverTimestamp()
        });
        console.log("🔥 Cloud Gold Record Saved!");
        return true;
    } catch (e) {
        console.error("Firestore Save Error (Gold):", e);
        return false;
    }
}

export async function saveClearRecordToCloud(playerName, totalClears) {
    if (!isFirebaseReady || !db) return false;
    try {
        const currentUser = auth ? auth.currentUser : null;
        await addDoc(collection(db, "lb_clears"), {
            uid: currentUser ? currentUser.uid : "anonymous",
            name: playerName || (currentUser ? currentUser.displayName : "마법사"),
            photoURL: currentUser ? currentUser.photoURL : "",
            clears: parseInt(totalClears),
            createdAt: serverTimestamp()
        });
        console.log("🔥 Cloud Clears Record Saved!");
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
