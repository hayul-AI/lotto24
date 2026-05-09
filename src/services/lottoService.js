import { db } from '../firebase';
import { collection, getDocs, doc, getDoc, writeBatch, query, orderBy, limit } from 'firebase/firestore';

// 캐시 키 설정
const CACHE_KEY_LOTTO = 'bokgwon24_lotto_cache';
const CACHE_KEY_PENSION = 'bokgwon24_pension_cache';
const CACHE_KEY_SYNC = 'bokgwon24_last_sync';
const SYNC_INTERVAL_MS = 1000 * 60 * 60; // 1시간 캐시 유지

const getLocalCache = (key) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch(e) { return null; }
};

const setLocalCache = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch(e) {}
};

/**
 * 로또 데이터 유효성 검사 (번호 위주)
 */
export const isValidLotto = (lotto) => {
  if (!lotto || !lotto.drawNo || !lotto.drawDate || !Array.isArray(lotto.numbers)) return false;
  if (lotto.numbers.length !== 6) return false;
  const numsStr = lotto.numbers.sort((a,b)=>a-b).join(',');
  if (numsStr === '1,2,3,4,5,6') return false;
  if (!lotto.bonusNo) return false;
  return true;
};

/**
 * 연금복권 데이터 유효성 검사
 */
export const isValidPension = (pension) => {
  if (!pension || !pension.drawNo || !pension.drawDate || !pension.firstPrizeNumber) return false;
  const { numbers } = pension.firstPrizeNumber;
  if (!numbers || numbers.length !== 6) return false;
  const numsStr = numbers.join('');
  if (['123456', '000000', '111111'].includes(numsStr)) return false;
  return true;
};

/**
 * 로또 데이터 필드 표준화 (필드명 통합)
 */
export const normalizeLotto = (item) => {
  if (!item) return null;
  
  // 금액 필드 통합
  const firstPrizeAmount = Number(item.firstPrizeAmount || item.prizeAmount || item.firstPrize || 0);
  const firstWinnerCount = Number(item.firstWinnerCount || item.winnerCount || item.firstWinners || 0);
  const totalPrizeAmount = Number(item.totalPrizeAmount || item.totSellamnt || item.totalAmount || 0);
  const bonusNo = item.bonusNo || item.bonus;
  const drawDate = item.drawDate || item.date;

  return {
    ...item,
    firstPrizeAmount,
    firstWinnerCount,
    totalPrizeAmount,
    bonusNo,
    drawDate,
    hasPrizeInfo: firstPrizeAmount > 0
  };
};

function normalizePension(item) {
  if (item.firstPrizeNumber?.group && Array.isArray(item.firstPrizeNumber?.numbers)) return item;
  if (Array.isArray(item.prizeNumbers) && item.prizeNumbers.length >= 7) {
    item.firstPrizeNumber = { group: String(item.prizeNumbers[0]), numbers: item.prizeNumbers.slice(1) };
  } else if (item.prizeNumbers && typeof item.prizeNumbers === 'object') {
    const pn = item.prizeNumbers;
    item.firstPrizeNumber = { group: String(pn.grade ?? pn.group ?? '?'), numbers: pn.winning ?? pn.numbers ?? [] };
  }
  return item;
}

// ============================================================
// 로또 조회 (캐시 우선 전략 적용)
// ============================================================

export const getAllLottoResults = async (forceSync = false) => {
  try {
    const cached = getLocalCache(CACHE_KEY_LOTTO);
    const lastSync = getLocalCache(CACHE_KEY_SYNC + '_lotto');
    const now = Date.now();
    
    // 캐시 존재 & 동기화 주기(1시간) 이내면 캐시 즉시 반환
    if (!forceSync && cached && lastSync && (now - lastSync < SYNC_INTERVAL_MS)) {
      return { data: cached, error: null, fromCache: true };
    }

    // Firestore에서 조회 (클라이언트 사이드 정렬)
    const snapshot = await getDocs(collection(db, "lotto_results"));
    const results = snapshot.docs
      .map(d => normalizeLotto({ id: d.id, ...d.data() }))
      .filter(isValidLotto)
      .sort((a, b) => Number(b.drawNo) - Number(a.drawNo));

    if (results.length > 0) {
      setLocalCache(CACHE_KEY_LOTTO, results);
      setLocalCache(CACHE_KEY_SYNC + '_lotto', now);
    }
    
    return { data: results, error: null, fromCache: false };
  } catch (err) {
    const cached = getLocalCache(CACHE_KEY_LOTTO);
    if (cached) return { data: cached, error: null, fromCache: true };
    return { data: [], error: err.message };
  }
};

export const getLatestLottoResult = async () => {
  const { data, error } = await getAllLottoResults();
  if (error) return { data: null, error };
  return { data: data[0] || null, error: data.length === 0 ? 'NO_DATA' : null };
};

export const getLottoResultByDrawNo = async (drawNo) => {
  try {
    const cachedList = getLocalCache(CACHE_KEY_LOTTO);
    if (cachedList) {
      const found = cachedList.find(d => Number(d.drawNo) === Number(drawNo));
      if (found) return { data: found, error: null, fromCache: true };
    }

    // 캐시에 없으면 Firestore 개별 조회
    const docRef = doc(db, "lotto_results", String(drawNo));
    const snap = await getDoc(docRef);
    if (!snap.exists()) return { data: null, error: 'NOT_FOUND' };
    
    const data = normalizeLotto({ id: snap.id, ...snap.data() });
    return isValidLotto(data) ? { data, error: null } : { data: null, error: 'INVALID_DATA' };
  } catch (err) {
    return { data: null, error: err.message };
  }
};

// ============================================================
// 연금복권 조회 (캐시 우선 전략 적용)
// ============================================================

export const getAllPensionResults = async (forceSync = false) => {
  try {
    const cached = getLocalCache(CACHE_KEY_PENSION);
    const lastSync = getLocalCache(CACHE_KEY_SYNC + '_pension');
    const now = Date.now();

    if (!forceSync && cached && lastSync && (now - lastSync < SYNC_INTERVAL_MS)) {
      return { data: cached, error: null, fromCache: true };
    }

    const snapshot = await getDocs(collection(db, "pension_results"));
    const results = snapshot.docs
      .map(d => normalizePension({ id: d.id, ...d.data() }))
      .filter(isValidPension)
      .sort((a, b) => Number(b.drawNo) - Number(a.drawNo));
      
    if (results.length > 0) {
      setLocalCache(CACHE_KEY_PENSION, results);
      setLocalCache(CACHE_KEY_SYNC + '_pension', now);
    }
    
    return { data: results, error: null, fromCache: false };
  } catch (err) {
    const cached = getLocalCache(CACHE_KEY_PENSION);
    if (cached) return { data: cached, error: null, fromCache: true };
    return { data: [], error: err.message };
  }
};

export const getLatestPensionResult = async () => {
  const { data, error } = await getAllPensionResults();
  if (error) return { data: null, error };
  return { data: data[0] || null, error: data.length === 0 ? 'NO_DATA' : null };
};

export const getPensionResultByDrawNo = async (drawNo) => {
  try {
    const cachedList = getLocalCache(CACHE_KEY_PENSION);
    if (cachedList) {
      const found = cachedList.find(d => Number(d.drawNo) === Number(drawNo));
      if (found) return { data: found, error: null, fromCache: true };
    }

    const docRef = doc(db, "pension_results", String(drawNo));
    const snap = await getDoc(docRef);
    if (!snap.exists()) return { data: null, error: 'NOT_FOUND' };
    const data = normalizePension({ id: snap.id, ...snap.data() });
    return isValidPension(data) ? { data, error: null } : { data: null, error: 'INVALID_DATA' };
  } catch (err) {
    return { data: null, error: err.message };
  }
};

// ============================================================
// 데이터 관리 (어드민용)
// ============================================

export const cleanPlaceholderData = async (collectionName) => {
  const snapshot = await getDocs(collection(db, collectionName));
  const batch = writeBatch(db);
  let count = 0;
  snapshot.docs.forEach(d => {
    const data = d.data();
    const isValid = collectionName === 'lotto_results' ? isValidLotto(data) : isValidPension(normalizePension(data));
    if (!isValid) { batch.delete(d.ref); count++; }
  });
  if (count > 0) await batch.commit();
  return count;
};

export const bulkNormalizeLottoFields = async () => {
  const snapshot = await getDocs(collection(db, "lotto_results"));
  const batch = writeBatch(db);
  let count = 0;

  snapshot.docs.forEach(d => {
    const normalized = normalizeLotto(d.data());
    batch.update(d.ref, {
      firstPrizeAmount: normalized.firstPrizeAmount,
      firstWinnerCount: normalized.firstWinnerCount,
      totalPrizeAmount: normalized.totalPrizeAmount,
      bonusNo: normalized.bonusNo,
      drawDate: normalized.drawDate
    });
    count++;
  });

  if (count > 0) await batch.commit();
  return count;
};

// 판매점 관련 
export const getAllStores = async () => {
  try {
    const snapshot = await getDocs(collection(db, "lottery_stores"));
    return { data: snapshot.docs.map(d => ({ id: d.id, ...d.data() })), error: null };
  } catch (err) { return { data: [], error: err.message }; }
};

export const getWinningStores = async () => {
  try {
    const snapshot = await getDocs(collection(db, "winning_stores"));
    return { data: snapshot.docs.map(d => ({ id: d.id, ...d.data() })), error: null };
  } catch (err) { return { data: [], error: err.message }; }
};

/**
 * 연금복권 최신 회차 문서 일부 조회 (디버그용)
 */
export const getPensionResultsDebug = async (limitCount = 5) => {
  try {
    const q = query(collection(db, "pension_results"), orderBy("drawNo", "desc"), limit(limitCount));
    const snapshot = await getDocs(q);
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { data: results, error: null };
  } catch (error) {
    console.error("getPensionResultsDebug error:", error);
    return { data: null, error };
  }
};

/**
 * 특정 문서 존재 여부만 확인 (디버그용)
 */
export const getPensionDocStatus = async (drawNo) => {
  try {
    const docRef = doc(db, "pension_results", String(drawNo));
    const docSnap = await getDoc(docRef);
    return { 
      exists: docSnap.exists(), 
      drawNo: drawNo,
      data: docSnap.exists() ? docSnap.data() : null 
    };
  } catch (error) {
    return { exists: false, drawNo: drawNo, error };
  }
};
