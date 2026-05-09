const { db, FieldValue } = require('./firebaseAdmin.cjs');

/**
 * 로또 6/45 최신 회차 데이터 가져오기 및 Firestore 업데이트
 */
async function fetchLatestLotto() {
  console.log("🚀 Starting Lotto 6/45 sync...");
  let lastSuccessfulNo = 0;

  try {
    // 1. Firestore에서 현재 최신 회차 확인
    const lottoRef = db.collection('lotto_results');
    const lastSyncDoc = await db.collection('sync_status').doc('lotto').get();
    
    let startDrawNo = 1;
    if (lastSyncDoc.exists && lastSyncDoc.data().lastSuccessDrawNo) {
      startDrawNo = Number(lastSyncDoc.data().lastSuccessDrawNo) + 1;
      lastSuccessfulNo = Number(lastSyncDoc.data().lastSuccessDrawNo);
    } else {
      const latestSnapshot = await lottoRef.orderBy('drawNo', 'desc').limit(1).get();
      if (!latestSnapshot.empty) {
        startDrawNo = Number(latestSnapshot.docs[0].data().drawNo) + 1;
        lastSuccessfulNo = Number(latestSnapshot.docs[0].data().drawNo);
      }
    }

    console.log(`🔍 Checking from drawNo: ${startDrawNo}`);

    let currentNo = startDrawNo;
    let newFoundCount = 0;
    let consecutiveFails = 0;

    while (consecutiveFails < 3) {
      console.log(`📡 Fetching Lotto ${currentNo}...`);
      const url = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${currentNo}`;
      
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        
        const data = await response.json();

        if (data.returnValue === 'success' && data.drwNo) {
          const drawNo = Number(data.drwNo);
          console.log(`✨ Detected Draw: ${drawNo}`);

          // 기존 문서 존재 여부 및 source 확인
          const existingDoc = await lottoRef.doc(String(drawNo)).get();
          const exists = existingDoc.exists;
          const oldSource = exists ? existingDoc.data().source : 'none';
          
          console.log(`📝 Existing Document: ${exists ? 'Yes' : 'No'}`);
          if (exists) console.log(`🔍 Previous Source: ${oldSource}`);

          const numbers = [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6];
          if (numbers.some(n => !n) || numbers.length !== 6 || !data.bnusNo) {
            console.warn(`⚠️ Invalid data for draw ${drawNo}, skipping.`);
            consecutiveFails++;
            currentNo++;
            continue;
          }

          const lottoData = {
            drawNo: drawNo,
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

          await lottoRef.doc(String(drawNo)).set(lottoData, { merge: true });
          
          console.log(`✅ Saved to collection: lotto_results / docId: ${drawNo}`);
          newFoundCount++;
          lastSuccessfulNo = drawNo;
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
      await new Promise(r => setTimeout(r, 500));
    }

    // 성공 상태 기록
    await db.collection('sync_status').doc('lotto').set({
      target: "lotto",
      lastStatus: "success",
      lastSuccessDrawNo: lastSuccessfulNo,
      lastRunAt: FieldValue.serverTimestamp(),
      source: "github_actions_auto"
    }, { merge: true });
    
    console.log(`📊 sync_status/lotto Update: SUCCESS`);
    console.log(`⭐ Lotto sync complete. Last successful draw: ${lastSuccessfulNo}`);

  } catch (err) {
    console.error("❌ Fatal Error in Lotto sync:", err.message);
    // 실패 상태 기록
    await db.collection('sync_status').doc('lotto').set({
      target: "lotto",
      lastStatus: "failed",
      lastError: err.message,
      lastRunAt: FieldValue.serverTimestamp(),
      source: "github_actions_auto"
    }, { merge: true }).catch(e => console.error("Failed to log error to Firestore:", e));
  }
}

module.exports = { fetchLatestLotto };

if (require.main === module) {
  fetchLatestLotto().catch(err => {
    console.error("Fatal Error:", err);
    process.exit(1);
  });
}
