// ===================================================
// Firebase & Auth Non-Blocking Master Module
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
    serverTimestamp,
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

console.log("[Tenmaker Firebase] Script loaded.");

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

let app = null;
let auth = null;
let db = null;
let isFirebaseReady = false;

// 1. Non-blocking Firebase 초기화
(function initFirebaseNonBlocking() {
    try {
        console.log("[Tenmaker Firebase] Initializing Firebase App...");
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        isFirebaseReady = true;
        console.log("[Tenmaker Firebase] Firebase connected successfully!");

        // 백그라운드 인증 상태 관찰자 시작
        initAuthObserver();
    } catch (e) {
        console.warn("[Tenmaker Firebase] Firebase initialization failed or offline mode:", e);
        isFirebaseReady = false;
    }
})();

// UI 안전 업데이트 함수 (Non-blocking)
async function applyUserToUI(user) {
    try {
        const btnLogin = document.getElementById('btn-google-login');
        const btnLogout = document.getElementById('btn-logout');
        const imgEl = document.getElementById('user-photo');
        const iconEl = document.getElementById('user-avatar-icon');
        const nameInput = document.getElementById('player-name-input');

        if (user) {
            console.log("[Tenmaker Auth] User signed in:", user.displayName || user.email);
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
                nameInput.value = user.displayName;
                if (window.gameState) window.gameState.playerName = user.displayName;
            }

            // 📥 로그인한 유저 계정 전용 Firestore 클라우드 데이터 불러오기
            const cloudData = await loadUserDataFromCloud();
            if (cloudData && window.gameState) {
                window.gameState.gold = cloudData.gold !== undefined ? cloudData.gold : 0;
                window.gameState.clears = cloudData.clears !== undefined ? cloudData.clears : 0;
                window.gameState.bossBestTime = cloudData.bossBestTime || null;
                if (typeof window.updateUIHeader === 'function') window.updateUIHeader();
            }
        } else {
            console.log("[Tenmaker Auth] User signed out -> Resetting score and UI.");
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

            // 📤 로그아웃 시 게스트 초기 상태로 점수/골드 깨끗하게 리셋!
            if (typeof window.resetGameStateToDefault === 'function') {
                window.resetGameStateToDefault();
            }
        }
    } catch (err) {
        console.error("[Tenmaker Auth] Error updating UI:", err);
    }
}

// 백그라운드 인증 상태 관찰자
function initAuthObserver() {
    if (!auth) return;
    try {
        onAuthStateChanged(auth, (user) => {
            applyUserToUI(user);
        });
    } catch (e) {
        console.error("[Tenmaker Auth] Observer error:", e);
    }
}

// 구글 로그인 실행 함수 (Non-blocking)
export function executeGoogleLogin() {
    console.log("[Tenmaker Auth] Login button clicked.");
    if (!isFirebaseReady || !auth) {
        alert("Firebase 연결 준비 중입니다. 잠시 후 다시 시도해 주세요.");
        return;
    }

    try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });

        signInWithPopup(auth, provider)
            .then((result) => {
                console.log("[Tenmaker Auth] Popup Login Success:", result.user.displayName);
                applyUserToUI(result.user);
            })
            .catch((err) => {
                console.error("[Tenmaker Auth] Popup Login Error:", err);
                if (err.code === 'auth/unauthorized-domain') {
                    alert(`[도메인 승인 필요]\n현재 접속 주소(${window.location.hostname})가 Firebase 콘솔의 Authorized Domains에 추가되어야 합니다.`);
                } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
                    alert(`로그인 오류: ${err.message}`);
                }
            });
    } catch (e) {
        console.error("[Tenmaker Auth] Execute login exception:", e);
    }
}

// 로그아웃
export function executeLogout() {
    if (auth) {
        signOut(auth).then(() => {
            console.log("[Tenmaker Auth] Signed out successfully.");
            applyUserToUI(null);
        }).catch(e => console.error("[Tenmaker Auth] Signout error:", e));
    }
}

// Firestore 클라우드 저장 서비스 (Non-blocking)
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
        console.log("[Tenmaker Cloud] Boss time record saved.");
        return true;
    } catch (e) {
        console.error("[Tenmaker Cloud] Save Boss Time Error:", e);
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
        console.log("[Tenmaker Cloud] Gold record saved.");
        return true;
    } catch (e) {
        console.error("[Tenmaker Cloud] Save Gold Error:", e);
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
        console.log("[Tenmaker Cloud] Clear record saved.");
        return true;
    } catch (e) {
        console.error("[Tenmaker Cloud] Save Clears Error:", e);
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
        console.log(`[Tenmaker Cloud] Fetched Top 10 for ${category}:`, results.length);
        return results;
    } catch (e) {
        console.error(`[Tenmaker Cloud] Fetch Error for ${category}:`, e);
        return null;
    }
}

// 👤 계정별 Firestore 통합 데이터 저장 및 불러오기
export async function saveUserDataToCloud(data) {
    if (!isFirebaseReady || !db || !auth || !auth.currentUser) return false;
    try {
        const uid = auth.currentUser.uid;
        await setDoc(doc(db, "users", uid), {
            gold: data.gold || 0,
            clears: data.clears || 0,
            bossBestTime: data.bossBestTime || null,
            playerName: data.playerName || auth.currentUser.displayName || "10마법사",
            updatedAt: serverTimestamp()
        }, { merge: true });
        console.log("[Tenmaker Cloud] Account data synced for UID:", uid);
        return true;
    } catch (e) {
        console.error("[Tenmaker Cloud] Save User Data Error:", e);
        return false;
    }
}

export async function loadUserDataFromCloud() {
    if (!isFirebaseReady || !db || !auth || !auth.currentUser) return null;
    try {
        const uid = auth.currentUser.uid;
        const userDocRef = doc(db, "users", uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            console.log("[Tenmaker Cloud] Account data loaded for UID:", uid, docSnap.data());
            return docSnap.data();
        }
        return null;
    } catch (e) {
        console.error("[Tenmaker Cloud] Load User Data Error:", e);
        return null;
    }
}

window.FirebaseService = {
    isReady: () => isFirebaseReady,
    executeGoogleLogin,
    executeLogout,
    saveUserDataToCloud,
    loadUserDataFromCloud,
    saveBossTimeRecordToCloud,
    saveGoldRecordToCloud,
    saveClearRecordToCloud,
    fetchTop10CloudLeaderboard
};
