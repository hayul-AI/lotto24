const admin = require('firebase-admin');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// 1. Firebase Admin 초기화
const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ serviceAccountKey.json 파일이 프로젝트 루트에 없습니다.");
  process.exit(1);
}
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// 2. data 폴더 내에서 로또 엑셀 파일 찾기
const dataDir = path.resolve(__dirname, '../data');
const files = fs.readdirSync(dataDir);
const targetFile = files.find(f => f.startsWith('로또 회차별 당첨번호') && f.endsWith('.xlsx'));

if (!targetFile) {
  console.error("❌ data/ 폴더 내에 '로또 회차별 당첨번호_*.xlsx' 파일이 없습니다.");
  process.exit(1);
}

const filePath = path.join(dataDir, targetFile);
console.log(`\n📂 파일 로드 중: ${targetFile}`);

// 3. 엑셀 파싱 (동행복권 규격 대응)
const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

const parseKoreanWon = (str) => {
  if (!str) return 0;
  return Number(String(str).replace(/[^0-9]/g, ''));
};

const getLottoDate = (drawNo) => {
  const firstDraw = new Date('2002-12-07T12:00:00Z');
  firstDraw.setDate(firstDraw.getDate() + (drawNo - 1) * 7);
  return firstDraw.toISOString().split('T')[0];
};

const processedData = [];

// 첫 번째 행이 헤더 ['No', '회차', '당첨번호'...]
let dataStartIndex = 1; 
for (let i = 0; i < Math.min(10, rawData.length); i++) {
  if (rawData[i] && String(rawData[i][1]).includes('회차')) {
    dataStartIndex = i + 1;
    break;
  }
}

for (let i = dataStartIndex; i < rawData.length; i++) {
  const row = rawData[i];
  if (!row || row.length < 10) continue;

  const drawNo = Number(row[1]);
  if (!drawNo || isNaN(drawNo)) continue;

  const drawDate = getLottoDate(drawNo);
  
  // 엑셀 규격: [2]~[7] 당첨번호, [8] 보너스, [10] 당첨자수, [11] 당첨금액
  const numbers = [];
  for (let n = 2; n <= 7; n++) {
    numbers.push(Number(row[n]));
  }
  const bonusNo = Number(row[8]);

  const firstWinnerCount = Number(String(row[10]).replace(/[^0-9]/g, '')) || 0;
  const firstPrizeAmount = parseKoreanWon(row[11]);

  if (numbers.length !== 6 || numbers.some(isNaN)) {
    console.warn(`⚠️ [${drawNo}회] 당첨번호 오류로 스킵됨:`, row);
    continue;
  }

  processedData.push({
    drawNo,
    drawDate,
    numbers: numbers.sort((a,b)=>a-b),
    bonusNo,
    firstPrizeAmount,
    firstWinnerCount,
    totalPrizeAmount: firstPrizeAmount * firstWinnerCount,
    verified: true,
    source: 'official_excel_import',
    updatedAt: new Date().toISOString()
  });
}

console.log(`\n✅ 총 ${processedData.length}건의 유효한 로또 데이터를 추출했습니다.`);

// 4. Firestore 일괄 업로드 (Merge: true)
async function uploadToFirestore() {
  const collectionRef = db.collection('lotto_results');
  let batch = db.batch();
  let count = 0;
  let totalUploaded = 0;

  console.log('🚀 Firestore 업로드 시작...');

  for (const item of processedData) {
    const docRef = collectionRef.doc(String(item.drawNo));
    batch.set(docRef, item, { merge: true });
    
    count++;
    totalUploaded++;

    if (count === 400) {
      await batch.commit();
      console.log(`... ${totalUploaded}건 업로드 완료`);
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
    console.log(`... ${totalUploaded}건 업로드 완료`);
  }

  console.log(`\n🎉 모든 데이터 주입이 완료되었습니다! (총 ${totalUploaded}건)`);
  process.exit(0);
}

uploadToFirestore().catch(err => {
  console.error("❌ 업로드 중 오류 발생:", err);
  process.exit(1);
});
