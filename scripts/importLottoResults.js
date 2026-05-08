const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// 서비스 계정 키 (이미 프로젝트에 설정되어 있다고 가정하거나 환경 변수 활용)
// 프로젝트 루트의 firebase-service-account.json 또는 Firebase CLI 인증 사용
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

const db = admin.firestore();

const importLotto = async () => {
  const filePath = path.join(__dirname, '../data/lotto645_full.json');
  if (!fs.existsSync(filePath)) {
    console.error("❌ lotto645_full.json 파일이 없습니다.");
    return;
  }

  const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const dataArray = Array.isArray(rawData) ? rawData : (rawData.data || []);

  console.log(`🚀 로또 데이터 ${dataArray.length}건 임포트 시작...`);

  let count = 0;
  let batch = db.batch();

  for (const item of dataArray) {
    // 검증
    if (!item.drawNo || !item.drawDate || !item.numbers || item.numbers.length !== 6) continue;
    if (item.numbers.sort((a,b)=>a-b).join(',') === '1,2,3,4,5,6') continue;
    if (item.firstPrizeAmount <= 0) continue;

    const docRef = db.collection('lotto_results').doc(String(item.drawNo));
    batch.set(docRef, {
      ...item,
      drawNo: Number(item.drawNo),
      verified: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    count++;
    
    if (count % 500 === 0) {
      await batch.commit();
      batch = db.batch();
      console.log(`✅ ${count}건 진행 중...`);
    }
  }

  if (count % 500 !== 0) await batch.commit();
  console.log(`⭐ 총 ${count}개의 로또 데이터 임포트 완료!`);
};

importLotto().catch(console.error);
