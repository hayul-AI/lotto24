import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCQfBc4tbjqKrrej7svqAZ9waX0fTMhBA0",
  authDomain: "lotto24-63f1d.firebaseapp.com",
  projectId: "lotto24-63f1d",
  storageBucket: "lotto24-63f1d.firebasestorage.app",
  messagingSenderId: "830281856228",
  appId: "1:830281856228:web:1cca925c585f9be0c428f1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ============================================================
// 1. lotto_results 1회 ~ 30회
// ============================================================
function makeLottoResults() {
  const results = [];
  for (let i = 1; i <= 30; i++) {
    const nums = new Set();
    // 가짜 데이터 [1,2,3,4,5,6] 절대 방지
    while (nums.size < 6) nums.add(Math.floor(Math.random() * 45) + 1);
    let sorted = [...nums].sort((a, b) => a - b);
    if (sorted.join(',') === '1,2,3,4,5,6') {
      nums.clear();
      while (nums.size < 6) nums.add(Math.floor(Math.random() * 45) + 1);
      sorted = [...nums].sort((a, b) => a - b);
    }
    
    let bonus;
    do { bonus = Math.floor(Math.random() * 45) + 1; } while (sorted.includes(bonus));

    results.push({
      drawNo: i,
      drawDate: `2024-01-${String(i).padStart(2, '0')}`,
      numbers: sorted,
      bonusNo: bonus,
      firstPrizeAmount: 1500000000 + Math.floor(Math.random() * 1000000000),
      firstWinnerCount: Math.floor(Math.random() * 12) + 1,
      totalPrizeAmount: 9000000000 + Math.floor(Math.random() * 3000000000),
      verified: true,
      source: "seed"
    });
  }
  return results;
}

function makePensionResults() {
  const results = [];
  for (let i = 1; i <= 20; i++) {
    const group = String(Math.floor(Math.random() * 5) + 1);
    // 가짜 데이터 123456 방지
    let numbers;
    do {
      numbers = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10));
    } while (['123456', '000000', '111111'].includes(numbers.join('')));

    results.push({
      drawNo: i,
      drawDate: `2024-01-${String(i).padStart(2, '0')}`,
      firstPrizeNumber: { group: group, numbers: numbers },
      firstPrizeAmount: 7000000,
      verified: true,
      source: "seed"
    });
  }
  return results;
}

// ============================================================
// 3. lottery_stores 서울 좌표 20개
// ============================================================
const LOTTERY_STORES = [
  { storeName: "강남역 로또", address: "서울특별시 강남구 강남대로 396", lat: 37.4979, lng: 127.0276, region: "강남", phone: "02-555-1234" },
  { storeName: "홍대입구 복권방", address: "서울특별시 마포구 양화로 160", lat: 37.5563, lng: 126.9236, region: "마포", phone: "02-332-5678" },
  { storeName: "잠실 행운센터", address: "서울특별시 송파구 올림픽로 300", lat: 37.5133, lng: 127.1001, region: "송파", phone: "02-421-9012" },
  { storeName: "종로 만세당", address: "서울특별시 종로구 종로 104", lat: 37.5700, lng: 126.9833, region: "종로", phone: "02-737-3456" },
  { storeName: "건대 럭키샵", address: "서울특별시 광진구 능동로 120", lat: 37.5410, lng: 127.0670, region: "광진", phone: "02-455-7890" },
  { storeName: "여의도 금융복권", address: "서울특별시 영등포구 여의대로 108", lat: 37.5215, lng: 126.9242, region: "영등포", phone: "02-783-2345" },
  { storeName: "이태원 글로벌 로또", address: "서울특별시 용산구 이태원로 177", lat: 37.5345, lng: 126.9945, region: "용산", phone: "02-794-6789" },
  { storeName: "신촌 대박샵", address: "서울특별시 서대문구 신촌로 73", lat: 37.5557, lng: 126.9370, region: "서대문", phone: "02-312-0123" },
  { storeName: "명동 포춘", address: "서울특별시 중구 명동길 74", lat: 37.5636, lng: 126.9850, region: "중구", phone: "02-778-4567" },
  { storeName: "성수 아트복권", address: "서울특별시 성동구 서울숲길 17", lat: 37.5447, lng: 127.0370, region: "성동", phone: "02-499-8901" },
  { storeName: "왕십리 한양", address: "서울특별시 성동구 왕십리로 222", lat: 37.5610, lng: 127.0380, region: "성동", phone: "02-292-2345" },
  { storeName: "노원 희망점", address: "서울특별시 노원구 상계로 70", lat: 37.6543, lng: 127.0616, region: "노원", phone: "02-933-6789" },
  { storeName: "구로 디지털복권", address: "서울특별시 구로구 디지털로 300", lat: 37.4855, lng: 126.9015, region: "구로", phone: "02-830-0123" },
  { storeName: "영등포 타임스퀘어점", address: "서울특별시 영등포구 영중로 15", lat: 37.5171, lng: 126.9034, region: "영등포", phone: "02-2638-4567" },
  { storeName: "서초 반포점", address: "서울특별시 서초구 반포대로 45", lat: 37.5045, lng: 127.0055, region: "서초", phone: "02-533-8901" },
  { storeName: "동대문 황금알", address: "서울특별시 동대문구 왕산로 214", lat: 37.5744, lng: 127.0090, region: "동대문", phone: "02-962-2345" },
  { storeName: "관악 서울대입구점", address: "서울특별시 관악구 관악로 1", lat: 37.4813, lng: 126.9527, region: "관악", phone: "02-887-6789" },
  { storeName: "마포 공덕점", address: "서울특별시 마포구 마포대로 92", lat: 37.5438, lng: 126.9515, region: "마포", phone: "02-715-0123" },
  { storeName: "송파 가락점", address: "서울특별시 송파구 송파대로 111", lat: 37.4969, lng: 127.1185, region: "송파", phone: "02-407-4567" },
  { storeName: "강서 발산점", address: "서울특별시 강서구 공항대로 247", lat: 37.5580, lng: 126.8380, region: "강서", phone: "02-2661-8901" },
];

// ============================================================
// 4. winning_stores 서울 좌표 10개
// ============================================================
const WINNING_STORES = [
  { storeName: "잠실 행운센터", address: "서울특별시 송파구 올림픽로 300", lat: 37.5133, lng: 127.1001, region: "송파", winCount: 22 },
  { storeName: "강남역 로또", address: "서울특별시 강남구 강남대로 396", lat: 37.4979, lng: 127.0276, region: "강남", winCount: 15 },
  { storeName: "명동 포춘", address: "서울특별시 중구 명동길 74", lat: 37.5636, lng: 126.9850, region: "중구", winCount: 12 },
  { storeName: "노원 희망점", address: "서울특별시 노원구 상계로 70", lat: 37.6543, lng: 127.0616, region: "노원", winCount: 9 },
  { storeName: "여의도 금융복권", address: "서울특별시 영등포구 여의대로 108", lat: 37.5215, lng: 126.9242, region: "영등포", winCount: 8 },
  { storeName: "홍대입구 복권방", address: "서울특별시 마포구 양화로 160", lat: 37.5563, lng: 126.9236, region: "마포", winCount: 7 },
  { storeName: "건대 럭키샵", address: "서울특별시 광진구 능동로 120", lat: 37.5410, lng: 127.0670, region: "광진", winCount: 6 },
  { storeName: "종로 만세당", address: "서울특별시 종로구 종로 104", lat: 37.5700, lng: 126.9833, region: "종로", winCount: 5 },
  { storeName: "서초 반포점", address: "서울특별시 서초구 반포대로 45", lat: 37.5045, lng: 127.0055, region: "서초", winCount: 4 },
  { storeName: "송파 가락점", address: "서울특별시 송파구 송파대로 111", lat: 37.4969, lng: 127.1185, region: "송파", winCount: 3 },
];

// ============================================================
// 실행
// ============================================================
async function seed() {
  console.log("🚀 Firestore 시딩 시작...\n");

  try {
    // lotto_results
    const lottoData = makeLottoResults();
    for (const item of lottoData) {
      await setDoc(doc(db, "lotto_results", String(item.drawNo)), item);
    }
    console.log(`✅ lotto_results ${lottoData.length}건 생성 완료`);

    // pension_results
    const pensionData = makePensionResults();
    for (const item of pensionData) {
      await setDoc(doc(db, "pension_results", String(item.drawNo)), item);
    }
    console.log(`✅ pension_results ${pensionData.length}건 생성 완료`);

    // lottery_stores
    for (let i = 0; i < LOTTERY_STORES.length; i++) {
      await setDoc(doc(db, "lottery_stores", `store_${i + 1}`), LOTTERY_STORES[i]);
    }
    console.log(`✅ lottery_stores ${LOTTERY_STORES.length}건 생성 완료`);

    // winning_stores
    for (let i = 0; i < WINNING_STORES.length; i++) {
      await setDoc(doc(db, "winning_stores", `winner_${i + 1}`), WINNING_STORES[i]);
    }
    console.log(`✅ winning_stores ${WINNING_STORES.length}건 생성 완료`);

    console.log("\n⭐ 시딩 완료! Firestore 컬렉션을 확인하세요.");
    process.exit(0);
  } catch (error) {
    console.error("❌ 시딩 실패:", error.message);
    process.exit(1);
  }
}

seed();
