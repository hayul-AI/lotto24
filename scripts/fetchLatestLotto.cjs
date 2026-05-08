const { db, FieldValue } = require('./firebaseAdmin.cjs');

/**
 * 로또 6/45 최신 회차 데이터 가져오기 및 Firestore 업데이트
 */
async function fetchLatestLotto() {
  console.log("🚀 Starting Lotto 6/45 sync...");

  // 1. Firestore에서 현재 최신 회차 확인
  const lottoRef = db.collection('lotto_results');
  const lastSyncDoc = await db.collection('sync_status').doc('lotto').get();
  
  let startDrawNo = 1;
  if (lastSyncDoc.exists) {
    startDrawNo = Number(lastSyncDoc.data().lastSuccessDrawNo || 0) + 1;
  } else {
    // sync_status가 없으면 lotto_results에서 최대값 찾기
    const latestSnapshot = await lottoRef.orderBy('drawNo', 'desc').limit(1).get();
    if (!latestSnapshot.empty) {
      startDrawNo = Number(latestSnapshot.docs[0].data().drawNo) + 1;
    }
  }

  console.log(`🔍 Checking from drawNo: ${startDrawNo}`);

  let currentNo = startDrawNo;
  let newFoundCount = 0;
  let lastSuccessfulNo = startDrawNo - 1;
  let consecutiveFails = 0;

  // 최대 10회차까지 미래를 탐색 (보통 1주 1회차이므로 10이면 충분)
  while (consecutiveFails < 3) {
    console.log(`📡 Fetching Lotto ${currentNo}...`);
    const url = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${currentNo}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      
      const data = await response.json();

      if (data.returnValue === 'success' && data.drwNo) {
        // 유효성 검사
        const numbers = [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6];
        if (numbers.some(n => !n) || numbers.length !== 6 || !data.bnusNo) {
          console.warn(`⚠️ Invalid data for draw ${currentNo}, skipping.`);
          consecutiveFails++;
          currentNo++;
          continue;
        }

        const lottoData = {
          drawNo: Number(data.drwNo),
          drawDate: data.drwNoDate,
          numbers: numbers.sort((a, b) => a - b),
          bonusNo: Number(data.bnusNo),
          firstPrizeAmount: Number(data.firstWinamnt || 0),
          firstWinnerCount: Number(data.firstPrzwnerCo || 0),
          totalPrizeAmount: Number(data.firstAccumamnt || 0),
          verified: true,
          source: "github_actions_auto",
          updatedAt: FieldValue.serverTimestamp()
        };

        // 당첨금이 0인 경우(추첨 직후 데이터 미완성) 기존 데이터가 있다면 덮어쓰지 않음
        // 단, 여기서는 새로운 회차를 추가하는 것이 주 목적이므로 merge set 사용
        await lottoRef.doc(String(lottoData.drawNo)).set(lottoData, { merge: true });
        
        console.log(`✅ Saved Lotto ${lottoData.drawNo}`);
        newFoundCount++;
        lastSuccessfulNo = lottoData.drawNo;
        consecutiveFails = 0;
      } else {
        console.log(`⏹️ No data for draw ${currentNo} (returnValue: ${data.returnValue})`);
        consecutiveFails++;
      }
    } catch (err) {
      console.error(`❌ Error fetching draw ${currentNo}:`, err.message);
      consecutiveFails++;
    }

    currentNo++;
    // API 과부하 방지
    await new Promise(r => setTimeout(r, 500));
  }

  // 2. 동기화 상태 업데이트
  if (newFoundCount > 0) {
    await db.collection('sync_status').doc('lotto').set({
      target: "lotto",
      lastSuccessDrawNo: lastSuccessfulNo,
      lastRunAt: FieldValue.serverTimestamp(),
      lastStatus: "success",
      source: "github_actions_auto"
    }, { merge: true });
    console.log(`⭐ Lotto sync complete. ${newFoundCount} new draws added.`);
  } else {
    console.log("ℹ️ Lotto is already up to date.");
    // 실행 기록은 남김
    await db.collection('sync_status').doc('lotto').update({
      lastRunAt: FieldValue.serverTimestamp(),
      lastStatus: "success"
    }).catch(() => {});
  }
}

module.exports = { fetchLatestLotto };

// 직접 실행 시 (node scripts/fetchLatestLotto.js)
if (require.main === module) {
  fetchLatestLotto().catch(err => {
    console.error("Fatal Error:", err);
    process.exit(1);
  });
}
