# 👑 10 만들기 마법 왕국 (Make 10 Kingdom)

초스피드 미니게임 3종으로 10 만들기 연산을 연습하고, 골드를 모아 보스 10의 마왕에게 도전하는 교육용 숫자 액션 웹 게임입니다.

---

## 🎮 주요 게임 기능

1. **20~30초 초스피드 미니게임 3종**
   - 짝맞추기 (25초): 4x4 타일 중 합이 10이 되는 짝 찾기
   - 버블 팝 (30초): 떨어지는 숫자 방울 2개를 이어 10으로 팝
   - 초스피드 퀴즈 (20초): 연산 퀴즈 타임어택
2. **골드 재화 & 보스전**
   - 100 Gold로 보스전 도전
   - 보스는 10문제를 연속 출제하며 밀리초 단위 최단 클리어 시간 측정!
3. **명예의 전당 (Global Leaderboard)**
   - ⏱️ 보스 타임어택 TOP 10 (최단 클리어 초)
   - 💰 골드 보유량 TOP 10
   - 🎮 미니게임 클리어 수 TOP 10

---

## 🔥 Firebase 연동 가이드

1. [Firebase Console](https://console.firebase.google.com/) 접속 후 새 프로젝트를 생성합니다.
2. **Authentication** 메뉴에서 **Google 로그인**을 활성화합니다.
3. **Firestore Database** 메뉴에서 데이터베이스를 생성합니다 (테스트 모드 선택).
4. 프로젝트 설정에서 **웹 앱(Web App)**을 추가하고 발급받은 설정 키를 `firebase-config.js` 파일에 업데이트하세요:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

---

## 🚀 GitHub 저장소 올리기 & Vercel 배포 방법

### 1. GitHub 업로드 명령
터미널에서 아래 명령어를 실행하여 GitHub 리포지토리에 푸시합니다:

```bash
git init
git add .
git commit -m "feat: 10 만들기 마법 왕국 첫 버전 및 Firebase 연동"
git branch -M main
git remote add origin https://github.com/사용자이름/make10-kingdom.git
git push -u origin main
```

### 2. Vercel 원클릭 배포
1. [Vercel Console](https://vercel.com/) 접속 후 **Add New Project** 선택.
2. GitHub 계정을 연동하고 푸시한 `make10-kingdom` 리포지토리를 선택.
3. **Deploy** 버튼 클릭! (설정 변경 없이 그대로 배포 가능합니다)

---

## 🛠️ 기술 스택
- Vanilla HTML5 / CSS3 (Glassmorphism & Neon Design) / JavaScript (ES6 Modules)
- Firebase v10 Modular SDK (Authentication & Firestore)
- Web Audio API (합성 효과음)
- Vercel Host & GitHub Integration
