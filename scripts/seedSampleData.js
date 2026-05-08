import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, collection, writeBatch, serverTimestamp } from "firebase/firestore";

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

const seed = async () => {
  console.log("🚀 [복권24] 샘플 데이터 생성 중...");

  try {
    const batch = writeBatch(db);

    // 1. 로또 1222회
    batch.set(doc(db, "lotto_results", "1222"), {
      drawNo: 1222,
      drawDate: "2026-05-02",
      numbers: [4, 11, 17, 22, 32, 41],
      bonusNo: 34,
      firstPrizeAmount: 2850000000,
      verified: true,
      source: "seed",
      createdAt: serverTimestamp()
    });

    // 2. 연금복권 1회
    batch.set(doc(db, "pension_results", "1"), {
      drawNo: 1,
      drawDate: "2026-05-02",
      prizeNumbers: { grade: 1, winning: [1, 2, 3, 4, 5, 6] },
      firstPrizeAmount: 700000000,
      verified: true,
      source: "seed",
      createdAt: serverTimestamp()
    });

    // 3. 판매점 샘플 5개
    const stores = [
      { storeName: "서울시청역점", address: "서울특별시 중구 세종대로 110", lat: 37.5665, lng: 126.9780 },
      { storeName: "명동행운점", address: "서울특별시 중구 명동길 14", lat: 37.5635, lng: 126.9830 },
      { storeName: "광화문점", address: "서울특별시 종로구 세종대로 172", lat: 37.5710, lng: 126.9760 },
      { storeName: "을지로점", address: "서울특별시 중구 을지로 12", lat: 37.5660, lng: 126.9820 },
      { storeName: "남대문점", address: "서울특별시 중구 남대문시장4길 21", lat: 37.5590, lng: 126.9770 }
    ];

    stores.forEach((s, i) => {
      batch.set(doc(collection(db, "lottery_stores"), `store_${i}`), s);
    });

    // 4. 당첨 판매점 샘플 5개
    const winners = [
      { storeName: "잠실매점", region: "서울", winCount: 48 },
      { storeName: "스파", region: "서울", winCount: 45 },
      { storeName: "부일카서비스", region: "부산", winCount: 41 },
      { storeName: "일등복권편의점", region: "대구", winCount: 30 },
      { storeName: "세진전자통신", region: "대구", winCount: 28 }
    ];

    winners.forEach((w, i) => {
      batch.set(doc(collection(db, "winning_stores"), `winner_${i}`), w);
    });

    await batch.commit();
    console.log("✅ 모든 샘플 데이터가 성공적으로 삽입되었습니다.");
    process.exit(0);
  } catch (error) {
    console.error("❌ 데이터 생성 실패:", error);
    process.exit(1);
  }
};

seed();
