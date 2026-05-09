# 복권24 (Lotto24)

복권 당첨 결과 확인 및 관리 서비스입니다.

## 자동 데이터 동기화 (GitHub Actions)

본 프로젝트는 GitHub Actions를 통해 로또 및 연금복권 당첨 데이터를 자동으로 갱신합니다.

- **설정 파일**: `.github/workflows/sync-lottery.yml`
- **실행 시간**: 매주 토요일 KST 21:00, 21:20 (UTC 12:00, 12:20)
- **실행 스크립트**: `scripts/syncLatestResults.cjs`
- **저장 위치**: Firestore (`lotto_results`, `pension_results`)

### 주의사항
GitHub Actions의 `cron` 설정은 UTC 기준입니다. 
- KST (한국 표준시) = UTC + 9시간
- 토요일 21:00 KST = 토요일 12:00 UTC

## 관리자 모드
관리자 이메일(`medicalassistant9111@gmail.com`)로 로그인 시 수동 데이터 보정 및 즉시 갱신 기능을 사용할 수 있습니다.

## 기술 스택
- **Frontend**: React, Vite, Lucide React
- **Backend/DB**: Firebase (Auth, Firestore)
- **Mobile**: Capacitor (Android/iOS)
- **Automation**: GitHub Actions
