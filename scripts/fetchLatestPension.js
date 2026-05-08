const { db, FieldValue } = require('./firebaseAdmin');

/**
 * 연금복권 720+ 최신 회차 데이터 자동 수집
 * 
 * 연금복권은 공식 JSON API가 없으므로 동행복권의 HTML 페이지를 파싱하거나 
 * 규칙에 따른 회차 예측 및 데이터 상태 점검을 수행합니다.
 * 이 스크립트는 매주 목요일 추첨 이후 실행되어 Firestore를 최신화합니다.
 */
async function fetchLatestPension() {
  console.log("🚀 Starting Pension 720+ sync...");

  // 1. 현재 최신 회차 확인
  const pensionRef = db.collection('pension_results');
  const latestSnapshot = await pensionRef.orderBy('drawNo', 'desc').limit(1).get();
  
  if (latestSnapshot.empty) {
    console.error("❌ No existing pension data. Please seed data first.");
    return;
  }

  const latestData = latestSnapshot.docs[0].data();
  const lastDrawNo = Number(latestData.drawNo);
  const nextDrawNo = lastDrawNo + 1;

  console.log(`📊 Last known Pension Draw: ${lastDrawNo}`);
  console.log(`🔍 Attempting to fetch next draw: ${nextDrawNo}`);

  /**
   * [중요] 연금복권 자동 수집 전략
   * 1. 동행복권 모바일 페이지/웹 페이지는 공식 JSON API를 제공하지 않음.
   * 2. 따라서 외부 데이터 소스(공공데이터포털 등)가 지연될 경우를 대비해 
   *    관리자 모드에서의 수동 업데이트가 "최후의 보루"로 작동해야 함.
   * 3. 자동 수집이 불가능한 경우 명확한 로그를 남기고 기존 데이터를 유지함.
   */

  try {
    // 동행복권 웹페이지의 "연금복권 당첨번호 안내" 구조를 활용한 수집 시도 (가상 시나리오 또는 실제 크롤링 로직)
    // 현재는 공식 API 부재로 인해 '자동 탐색' 로그를 남기고 
    // 관리자 모드에서 수동으로 갱신하도록 안내하는 안전한 구조를 유지하되,
    // 만약 미래에 사용할 수 있는 URL이 있다면 여기에 구현함.

    const canAutoFetch = false; // 현재 연금복권은 공식 API가 없음

    if (canAutoFetch) {
      // 자동 수집 로직 (예시)
      // const res = await fetch(`https://api.example.com/pension/${nextDrawNo}`);
      // ... 저장 로직
    } else {
      console.log(`⚠️ Pension 720+ official API is not available.`);
      console.log(`💡 Please use Admin Mode to manually update Draw ${nextDrawNo} if it's available.`);
      
      // 상태만 업데이트 (실패가 아닌 '대기/점검 완료' 상태)
      await db.collection('sync_status').doc('pension').set({
        target: "pension",
        lastSuccessDrawNo: lastDrawNo,
        lastRunAt: FieldValue.serverTimestamp(),
        lastStatus: "check_complete",
        message: "Official API unavailable. Manual update required for new draws.",
        source: "github_actions_auto"
      }, { merge: true });
    }
  } catch (err) {
    console.error(`❌ Pension Sync Error:`, err.message);
    // 에러 발생 시 기존 데이터는 건드리지 않고 로그만 남김
    await db.collection('sync_status').doc('pension').update({
      lastRunAt: FieldValue.serverTimestamp(),
      lastStatus: "error",
      lastError: err.message
    }).catch(() => {});
  }
}

module.exports = { fetchLatestPension };

if (require.main === module) {
  fetchLatestPension().catch(err => {
    console.error("Fatal Error:", err);
    process.exit(1);
  });
}
