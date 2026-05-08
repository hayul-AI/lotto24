const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

const db = admin.firestore();

const importPension = async () => {
  const filePath = path.join(__dirname, '../data/pension720_full.json');
  if (!fs.existsSync(filePath)) {
    console.error("❌ pension720_full.json 파일이 없습니다.");
    return;
  }

  const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const dataArray = Array.isArray(rawData) ? rawData : (rawData.data || []);

  console.log(`🚀 연금복권 데이터 ${dataArray.length}건 임포트 시작...`);

  let count = 0;
  let batch = db.batch();

  for (const item of dataArray) {
    // 검증
    if (!item.drawNo || !item.drawDate || !item.firstPrizeNumber) continue;
    const { numbers } = item.firstPrizeNumber;
    if (!numbers || numbers.length !== 6) continue;
    if (['123456', '000000', '111111'].includes(numbers.join(''))) continue;

    const docRef = db.collection('pension_results').doc(String(item.drawNo));
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
  console.log(`⭐ 총 ${count}개의 연금복권 데이터 임포트 완료!`);
};

importPension().catch(console.error);
