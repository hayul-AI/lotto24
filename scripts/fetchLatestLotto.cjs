const { db, FieldValue } = require('./firebaseAdmin.cjs');
const axios = require('axios');

/**
 * 로또 6/45 최신 회차 데이터 가져오기 (smarPage HTML 파싱 방식)
 */
async function fetchLatestLotto() {
  const KST_TIME = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').split('.')[0] + ' KST';
  console.log(`🚀 Starting Lotto 6/45 sync at ${KST_TIME}`);
  
  const TARGET_URL = 'https://www.dhlottery.co.kr/smarPage';
  console.log(`📡 Fetching URL: ${TARGET_URL}`);

  try {
    // 1. smarPage HTML 가져오기
    const response = await axios.get(TARGET_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/004.1'
      },
      timeout: 10000
    });

    const html = response.data;
    console.log(`📄 HTML Length: ${html.length}`);

    // 2. 차단/대기 페이지 확인
    const blockedKeywords = ["서비스 접근 대기 중입니다", "서비스 접속이 차단 되었습니다", "서비스 접속이 불가합니다", "접속량이 많아 접속이 불가능합니다"];
    const isBlocked = blockedKeywords.some(k => html.includes(k));
    console.log(`🛡️ Blocked/Waiting page detected: ${isBlocked ? 'YES' : 'NO'}`);

    if (isBlocked) {
      throw new Error("DHLottery service is currently blocked or waiting.");
    }

    // 3. Firestore에서 현재 최대 회차 확인
    const lottoRef = db.collection('lotto_results');
    const latestSnapshot = await lottoRef.orderBy('drawNo', 'desc').limit(1).get();
    let firestoreMaxDrawNo = 0;
    if (!latestSnapshot.empty) {
      firestoreMaxDrawNo = Number(latestSnapshot.docs[0].data().drawNo);
    }
    console.log(`🔍 Firestore Max DrawNo: ${firestoreMaxDrawNo}`);

    // 4. HTML 파싱 (Regex)
    // DrawNo
    const drawNoMatch = html.match(/<div class="round-num">\s*([0-9,]+)/);
    if (!drawNoMatch) throw new Error("Failed to parse drawNo from HTML");
    const parsedDrawNo = parseInt(drawNoMatch[1].replace(/,/g, ''));
    console.log(`✨ Parsed DrawNo from SmarPage: ${parsedDrawNo}`);

    // Date
    const dateMatch = html.match(/<div class="today-date">\s*([0-9]{4})년\s*([0-9]{2})월\s*([0-9]{2})일/);
    const parsedDrawDate = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : "Unknown";
    console.log(`📅 Parsed Draw Date: ${parsedDrawDate}`);

    // Numbers
    const ballBoxParts = html.split('result-ballBox');
    if (ballBoxParts.length < 2) throw new Error("Failed to find result-ballBox section");
    const ballBoxSection = ballBoxParts[1].split('figure')[0];
    const ballMatches = ballBoxSection.match(/<div class="result-ball [^"]+">\s*([0-9]+)\s*<\/div>/g);
    if (!ballMatches || ballMatches.length < 6) throw new Error("Failed to parse 6 balls from HTML");
    const parsedNumbers = ballMatches.slice(0, 6).map(s => parseInt(s.match(/>\s*([0-9]+)\s*</)[1])).sort((a, b) => a - b);
    console.log(`🔮 Parsed Numbers: ${parsedNumbers.join(', ')}`);

    // Bonus
    const bonusParts = html.split('보너스번호');
    if (bonusParts.length < 2) throw new Error("Failed to find bonus section");
    const bonusMatch = bonusParts[1].match(/<div class="result-ball [^"]+">\s*([0-9]+)\s*<\/div>/);
    const parsedBonusNo = bonusMatch ? parseInt(bonusMatch[1]) : 0;
    console.log(`➕ Parsed Bonus No: ${parsedBonusNo}`);

    // Prize & Winners
    const prizeMatch = html.match(/<span id="rnk1SumWnAmtTop">\s*([0-9,]+)/);
    const parsedFirstPrizeAmount = prizeMatch ? parseInt(prizeMatch[1].replace(/,/g, '')) : 0;
    console.log(`💰 Parsed 1st Prize Amount: ${parsedFirstPrizeAmount}`);

    const winnerMatch = html.match(/<span id="rnk1WnNopeTop">\s*([0-9,]+)/);
    const parsedFirstWinnerCount = winnerMatch ? parseInt(winnerMatch[1].replace(/,/g, '')) : 0;
    console.log(`👥 Parsed 1st Winner Count: ${parsedFirstWinnerCount}`);

    // 5. 로직 실행
    const finalTargetDrawNo = parsedDrawNo;
    console.log(`🎯 Final Target DrawNo: ${finalTargetDrawNo}`);

    if (parsedDrawNo < firestoreMaxDrawNo) {
      console.warn(`⚠️ Warning: Parsed drawNo (${parsedDrawNo}) is smaller than Firestore max (${firestoreMaxDrawNo}). Skipping save.`);
    } else {
      const existingDoc = await lottoRef.doc(String(finalTargetDrawNo)).get();
      console.log(`📝 Existing document in Firestore: ${existingDoc.exists ? 'YES' : 'NO'}`);

      const lottoData = {
        drawNo: finalTargetDrawNo,
        drawDate: parsedDrawDate,
        numbers: parsedNumbers,
        bonusNo: parsedBonusNo,
        firstPrizeAmount: parsedFirstPrizeAmount,
        firstWinnerCount: parsedFirstWinnerCount,
        verified: true,
        source: "github_actions_auto",
        updatedAt: FieldValue.serverTimestamp()
      };

      await lottoRef.doc(String(finalTargetDrawNo)).set(lottoData, { merge: true });
      console.log(`💾 Saved to lotto_results / docId: ${finalTargetDrawNo}`);

      // sync_status 업데이트
      await db.collection('sync_status').doc('lotto').set({
        target: "lotto",
        lastStatus: "success",
        lastSuccessDrawNo: finalTargetDrawNo,
        lastRunAt: FieldValue.serverTimestamp(),
        source: "github_actions_auto"
      }, { merge: true });
      console.log(`📊 sync_status/lotto Update: SUCCESS`);
    }

    console.log(`⭐ Lotto sync process finished successfully.`);

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
    throw err; // Re-throw to make GH Action fail
  }
}

module.exports = { fetchLatestLotto };

if (require.main === module) {
  fetchLatestLotto().catch(err => {
    console.error("Fatal Error:", err);
    process.exit(1);
  });
}
