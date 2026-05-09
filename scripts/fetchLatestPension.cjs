const { db, FieldValue } = require('./firebaseAdmin.cjs');

/**
 * 연금복권 720+ 최신 회차 데이터 자동 수집 상태 기록
 */
async function fetchLatestPension() {
  console.log("🚀 Starting Pension 720+ sync...");
  let lastSuccessfulNo = 0;

  try {
    // 1. 현재 최신 회차 확인
    const pensionRef = db.collection('pension_results');
    const latestSnapshot = await pensionRef.orderBy('drawNo', 'desc').limit(1).get();
    
    if (latestSnapshot.empty) {
      throw new Error("No existing pension data found in Firestore. Seed required.");
    }

    const latestData = latestSnapshot.docs[0].data();
    lastSuccessfulNo = Number(latestData.drawNo);

    console.log(`📊 Last known Pension Draw: ${lastSuccessfulNo}`);

    // 기존 문서 존재 여부 확인
    const existingDoc = await pensionRef.doc(String(lastSuccessfulNo)).get();
    const exists = existingDoc.exists;
    const oldSource = exists ? existingDoc.data().source : 'none';

    console.log(`📝 Existing Document: ${exists ? 'Yes' : 'No'}`);
    if (exists) console.log(`🔍 Previous Source: ${oldSource}`);

    // 현재 연금복권은 공식 API 부재로 인해 수동 업데이트가 필요함을 기록함
    // 하지만 "체크 완료" 시점의 최신 성공 회차는 유지함
    await db.collection('sync_status').doc('pension').set({
      target: "pension",
      lastStatus: "success",
      lastSuccessDrawNo: lastSuccessfulNo,
      lastRunAt: FieldValue.serverTimestamp(),
      message: "Check complete. Manual update may be required for future draws.",
      source: "github_actions_auto"
    }, { merge: true });

    console.log(`📊 sync_status/pension Update: SUCCESS`);
    console.log(`✅ Pension status check complete. Last draw: ${lastSuccessfulNo}`);

  } catch (err) {
    console.error(`❌ Pension Sync Error:`, err.message);
    // 실패 상태 기록
    await db.collection('sync_status').doc('pension').set({
      target: "pension",
      lastStatus: "failed",
      lastError: err.message,
      lastRunAt: FieldValue.serverTimestamp(),
      source: "github_actions_auto"
    }, { merge: true }).catch(e => console.error("Failed to log error to Firestore:", e));
  }
}

module.exports = { fetchLatestPension };

if (require.main === module) {
  fetchLatestPension().catch(err => {
    console.error("Fatal Error:", err);
    process.exit(1);
  });
}
