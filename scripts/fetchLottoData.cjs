const axios = require('axios');
const fs = require('fs');
const path = require('path');

const JSON_PATH = path.join(__dirname, '../public/data/lotto645_full.json');

async function fetchDrawResult(drawNo) {
  const url = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drawNo}`;
  try {
    const response = await axios.get(url, { timeout: 5000 });
    const data = response.data;
    
    // 미래 회차 도달
    if (!data || data.returnValue === 'fail' || !data.drwNo) return { stop: true };

    return {
      success: true,
      data: {
        drawNo: data.drwNo,
        drawDate: data.drwNoDate,
        numbers: [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6].sort((a,b)=>a-b),
        bonusNo: data.bnusNo,
        firstPrizeAmount: data.firstWinamnt,
        firstWinnerCount: data.firstPrzwnerCo,
        totalPrizeAmount: data.firstAccumamnt,
        verified: true,
        source: "dhlottery_api"
      }
    };
  } catch (err) {
    console.log(`[Network Error] Draw ${drawNo}: ${err.message}`);
    return { success: false, retry: true };
  }
}

async function run() {
  console.log("🚀 로또 마스터 데이터 전면 업데이트 시작...");
  
  let masterData = [];
  if (fs.existsSync(JSON_PATH)) {
    try {
      const raw = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
      masterData = raw.filter(d => d && d.drawNo && !isNaN(Number(d.drawNo)));
    } catch (e) {
      console.log("기존 JSON 파싱 실패, 새로 시작합니다.");
    }
  }

  const existingDrawNos = new Set(masterData.map(d => Number(d.drawNo)));
  let newFound = 0;
  let consecutiveStops = 0;

  for (let currentNo = 1; currentNo <= 3000; currentNo++) {
    if (existingDrawNos.has(currentNo)) continue;

    console.log(`🔍 누락 회차 수집 중: ${currentNo}회...`);
    const result = await fetchDrawResult(currentNo);
    
    if (result.stop) {
      consecutiveStops++;
      if (consecutiveStops >= 3) {
        console.log(`🏁 최신 회차에 도달했습니다 (탐색 종료)`);
        break;
      }
    } else if (result.success) {
      consecutiveStops = 0;
      masterData.push(result.data);
      newFound++;
    } else if (result.retry) {
      consecutiveStops = 0;
      // 네트워크 에러는 일단 스킵하고 다음으로 넘어감
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  if (newFound > 0) {
    masterData.sort((a, b) => Number(b.drawNo) - Number(a.drawNo));
    fs.writeFileSync(JSON_PATH, JSON.stringify(masterData, null, 2));
    console.log(`✅ 업데이트 완료: ${newFound}개의 새로운 데이터가 JSON에 추가됨.`);
  } else {
    console.log("ℹ️ JSON 파일이 이미 최신 상태입니다.");
  }
}

run().catch(console.error);
