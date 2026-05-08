const admin = require('firebase-admin');

/**
 * Firebase Admin SDK 초기화
 * GitHub Actions에서는 FIREBASE_SERVICE_ACCOUNT 시크릿을 사용함
 */
function initAdmin() {
  if (admin.apps.length > 0) return admin.firestore();

  const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (serviceAccountVar) {
    try {
      // JSON 문자열인 경우 파싱
      const serviceAccount = JSON.parse(serviceAccountVar);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("✅ Firebase Admin initialized via Environment Variable");
    } catch (e) {
      console.error("❌ Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable.");
      process.exit(1);
    }
  } else {
    // 로컬 환경: 서비스 계정 파일 확인
    const path = require('path');
    const fs = require('fs');
    const localKeyPath = path.join(__dirname, '../firebase-service-account.json');
    
    if (fs.existsSync(localKeyPath)) {
      const serviceAccount = require(localKeyPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("✅ Firebase Admin initialized via local JSON file");
    } else {
      console.error("❌ Firebase Service Account not found.");
      console.error("Set FIREBASE_SERVICE_ACCOUNT env var or add firebase-service-account.json in project root.");
      process.exit(1);
    }
  }

  return admin.firestore();
}

module.exports = {
  admin,
  db: initAdmin(),
  FieldValue: admin.firestore.FieldValue
};
