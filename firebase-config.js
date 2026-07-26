// ===================================================
// Firebase Config & Service Helper (Secure Environment)
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
    setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 환경변수 또는 발급받은 Firebase 키 적용
const env = window.__FIREBASE_ENV__ || {};

const firebaseConfig = {
    apiKey: env.apiKey || "AIzaSyCSUWNWUOf3fSTALAhKVJYOh5K60d-MyNo",
    authDomain: env.authDomain || "tenmaker-b5cfb.firebaseapp.com",
    projectId: env.projectId || "tenmaker-b5cfb",
    storageBucket: env.storageBucket || "tenmaker-b5cfb.firebasestorage.app",
    messagingSenderId: env.messagingSenderId || "426782247861",
    appId: env.appId || "1:426782247861:web:f46014348187d4d39667fc"
};

let app, auth, db;
let isFirebaseReady = false;

try {
    if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY") {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        isFirebaseReady = true;
        console.log("🔥 Firebase 보안 연동 성공!");
    } else {
        console.warn("⚠️ Firebase 환경변수가 설정되지 않아 로컬 안전 모드로 작동합니다.");
    }
} catch (e) {
    console.error("Firebase Initialization Error:", e);
}

// --- 로그인 / 인증 서비스 ---
export function loginWithGoogle() {
    if (!isFirebaseReady) {
        alert("Firebase 키 설정이 완료되지 않았습니다. 안내에 따라 1단계를 진행해 주세요!");
        return Promise.reject("Firebase not ready");
    }
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
}

export function logoutUser() {
    if (!isFirebaseReady) return Promise.resolve();
    return signOut(auth);
}

export function listenAuthState(callback) {
    if (!isFirebaseReady) return;
    onAuthStateChanged(auth, (user) => {
        callback(user);
    });
}

// --- Firestore 랭킹 DB 서비스 ---
export async function saveBossTimeRecordToCloud(playerName, timeSec) {
    if (!isFirebaseReady) return false;
    try {
        await addDoc(collection(db, "lb_boss_time"), {
            name: playerName,
            time: timeSec,
            uid: auth.currentUser ? auth.currentUser.uid : "anonymous",
            createdAt: serverTimestamp()
        });
        return true;
    } catch (e) {
        console.error("Firestore Save Error (Boss Time):", e);
        return false;
    }
}

export async function saveGoldRecordToCloud(playerName, goldAmount) {
    if (!isFirebaseReady) return false;
    try {
        await addDoc(collection(db, "lb_gold"), {
            name: playerName,
            gold: goldAmount,
            uid: auth.currentUser ? auth.currentUser.uid : "anonymous",
            createdAt: serverTimestamp()
        });
        return true;
    } catch (e) {
        console.error("Firestore Save Error (Gold):", e);
        return false;
    }
}

export async function saveClearRecordToCloud(playerName, totalClears) {
    if (!isFirebaseReady) return false;
    try {
        await addDoc(collection(db, "lb_clears"), {
            name: playerName,
            clears: totalClears,
            uid: auth.currentUser ? auth.currentUser.uid : "anonymous",
            createdAt: serverTimestamp()
        });
        return true;
    } catch (e) {
        console.error("Firestore Save Error (Clears):", e);
        return false;
    }
}

export async function fetchTop10CloudLeaderboard(category) {
    if (!isFirebaseReady) return null;
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
    loginWithGoogle,
    logoutUser,
    listenAuthState,
    saveBossTimeRecordToCloud,
    saveGoldRecordToCloud,
    saveClearRecordToCloud,
    fetchTop10CloudLeaderboard
};
