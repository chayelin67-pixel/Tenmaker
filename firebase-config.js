// ===================================================
// Firebase Config & Service Helper (Modular SDK v10)
// ===================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged,
    signInAnonymously
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

// ⚠️ Firebase 콘솔 (https://console.firebase.google.com)에서 프로젝트 생성 후 발급받은 설정값을 아래에 넣으세요.
// 설정이 완료되기 전에도 LocalStorage Fallback 모드로 안전하게 작동합니다.
const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

let app, auth, db;
let isFirebaseReady = false;

try {
    if (firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY") {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        isFirebaseReady = true;
        console.log("🔥 Firebase initialized successfully!");
    } else {
        console.warn("⚠️ FirebaseConfig가 아직 설정되지 않았습니다. 개발용 로컬 모드로 작동합니다.");
    }
} catch (e) {
    console.error("Firebase Initialization Error:", e);
}

// --- 로그인 / 인증 서비스 ---
export function loginWithGoogle() {
    if (!isFirebaseReady) {
        alert("Firebase API Key가 아직 설정되지 않았습니다. README.md를 참고하여 firebase-config.js에 키를 입력해주세요!");
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
