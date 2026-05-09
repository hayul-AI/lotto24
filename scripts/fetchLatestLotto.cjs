const { db, FieldValue } = require('./firebaseAdmin.cjs');
const axios = require('axios');

/**
 * 동행복권 공식 JSON API를 통한 조회
 */
async function fetchLottoByAPI(drawNo) {
  const url = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drawNo}`;
  console.log(`📡 [API] Trying to fetch drawNo: ${drawNo}`);
  
  try {
    const response = await axios.get(url, { timeout: 10000 });
    const data = response.data;
    
    if (data.returnValue === 'success' && data.drwNo) {
      console.log(`✅ [API] Successfully fetched drawNo: ${data.drwNo}`);
      return {
        drawNo: Number(data.drwNo),
        drawDate: data.drwNoDate,
        numbers: [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6].map(Number).sort((a, b) => a - b),
        bonusNo: Number(data.bnusNo),
        firstPrizeAmount: Number(data.firstWinamnt || 0),
        firstWinnerCount: Number(data.firstPrzwnerCo || 0),
        verified: true,
        source: "github_actions_auto",
        updatedAt: FieldValue.serverTimestamp()
      };
    }
  } catch (err) {
    console.warn(`⚠️ [API] Failed for ${drawNo}:`, err.message);
  }
  return null;
}

/**
 * smarPage HTML 파싱을 통한 조회 (Fallback)
 */
async function fetchFromSmarPage() {
  const TARGET_URL = 'https://www.dhlottery.co.kr/smarPage';
  console.log(`📡 [SmarPage] Trying to fetch from: ${TARGET_URL}`);

  const response = await axios.get(TARGET_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/004.1'
    },
    timeout: 10000
  });

  const html = response.data;
  const blockedKeywords = ["서비스 접근 대기 중입니다", "서비스 접속이 차단 되었습니다", "서비스 접속이 불가합니다", "접속량이 많아 접속이 불가능합니다"];
  if (blockedKeywords.some(k => html.includes(k))) {
    console.log("🛡️ [SmarPage] Blocked or waiting page detected.");
    return null;
  }

  const drawNoMatch = html.match(/<div class="round-num">\s*([0-9,]+)/);
  if (!drawNoMatch) return null;
  const parsedDrawNo = parseInt(drawNoMatch[1].replace(/,/g, ''));

  const dateMatch = html.match(/<div class="today-date">\s*([0-9]{4})년\s*([0-9]{2})월\s*([0-9]{2})일/);
  const parsedDrawDate = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : "Unknown";

  const ballBoxParts = html.split('result-ballBox');
  if (ballBoxParts.length < 2) return null;
  const ballBoxSection = ballBoxParts[1].split('figure')[0];
  const ballMatches = ballBoxSection.match(/<div class="result-ball [^"]+">\s*([0-9]+)\s*<\/div>/g);
  if (!ballMatches || ballMatches.length < 6) return null;
  const parsedNumbers = ballMatches.slice(0, 6).map(s => parseInt(s.match(/>\s*([0-9]+)\s*</)[1])).sort((a, b) => a - b);

  const bonusParts = html.split('보너스번호');
  const bonusMatch = bonusParts.length > 1 ? bonusParts[1].match(/<div class="result-ball [^"]+">\s*([0-9]+)\s*<\/div>/) : null;
  const parsedBonusNo = bonusMatch ? parseInt(bonusMatch[1]) : 0;

  const prizeMatch = html.match(/<span id="rnk1SumWnAmtTop">\s*([0-9,]+)/);
  const parsedFirstPrizeAmount = prizeMatch ? parseInt(prizeMatch[1].replace(/,/g, '')) : 0;

  const winnerMatch = html.match(/<span id="rnk1WnNopeTop">\s*([0-9,]+)/);
  const parsedFirstWinnerCount = winnerMatch ? parseInt(winnerMatch[1].replace(/,/g, '')) : 0;

  return {
    drawNo: parsedDrawNo,
    drawDate: parsedDrawDate,
    numbers: parsedNumbers,
    bonusNo: parsedBonusNo,
    firstPrizeAmount: parsedFirstPrizeAmount,
    firstWinnerCount: parsedFirstWinnerCount,
    verified: true,
    source: "github_actions_auto",
    updatedAt: FieldValue.serverTimestamp()
  };
}

/**
 * 로또 6/45 최신 회차 데이터 가져오기 (API 우선 + SmarPage Fallback)
 */
async function fetchLatestLotto() {
  const KST_TIME = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').split('.')[0] + ' KST';
  console.log(`🚀 Starting Lotto 6/45 sync at ${KST_TIME}`);

  try {
    // 1. Firestore에서 현재 최대 회차 확인
    const lottoRef = db.collection('lotto_results');
    const latestSnapshot = await lottoRef.orderBy('drawNo', 'desc').limit(1).get();
    let firestoreMaxDrawNo = 0;
    if (!latestSnapshot.empty) {
      firestoreMaxDrawNo = Number(latestSnapshot.docs[0].data().drawNo);
    }
    console.log(`🔍 Firestore Max DrawNo: ${firestoreMaxDrawNo}`);

    let finalResult = null;

    // 2. [1순위] API를 통해 다음 회차 조회
    finalResult = await fetchLottoByAPI(firestoreMaxDrawNo + 1);

    // 3. [2순위] API를 통해 현재 최대 회차 재검증 (최신 데이터 보정 목적)
    if (!finalResult) {
      finalResult = await fetchLottoByAPI(firestoreMaxDrawNo);
    }

    // 4. [3순위] smarPage HTML 파싱 (Fallback)
    if (!finalResult) {
      try {
        finalResult = await fetchFromSmarPage();
        if (finalResult) console.log(`✅ [SmarPage] Successfully fetched drawNo: ${finalResult.drawNo}`);
      } catch (e) {
        console.warn(`⚠️ [SmarPage] Fallback failed:`, e.message);
      }
    }

    // 5. 최종 결과 처리
    if (finalResult) {
      if (finalResult.drawNo < firestoreMaxDrawNo) {
        console.warn(`⚠️ Warning: Result drawNo (${finalResult.drawNo}) is smaller than Firestore max (${firestoreMaxDrawNo}). Skipping save.`);
      } else {
        await lottoRef.doc(String(finalResult.drawNo)).set(finalResult, { merge: true });
        console.log(`💾 Saved to lotto_results / docId: ${finalResult.drawNo}`);

        await db.collection('sync_status').doc('lotto').set({
          target: "lotto",
          lastStatus: "success",
          lastSuccessDrawNo: finalResult.drawNo,
          lastRunAt: FieldValue.serverTimestamp(),
          source: "github_actions_auto"
        }, { merge: true });
        console.log(`📊 sync_status/lotto Update: SUCCESS`);
      }
    } else {
      throw new Error("All lotto sync sources failed (API & SmarPage)");
    }

    console.log(`⭐ Lotto sync process finished.`);

  } catch (err) {
    console.error("❌ Fatal Error in Lotto sync:", err.message);
    await db.collection('sync_status').doc('lotto').set({
      target: "lotto",
      lastStatus: "failed",
      lastError: err.message,
      lastRunAt: FieldValue.serverTimestamp(),
      source: "github_actions_auto"
    }, { merge: true }).catch(e => console.error("Failed to log error to Firestore:", e));
    throw err;
  }
}

module.exports = { fetchLatestLotto };

if (require.main === module) {
  fetchLatestLotto().catch(err => {
    process.exit(1);
  });
}
