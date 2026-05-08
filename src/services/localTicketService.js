import { nanoid } from "nanoid";

const STORAGE_KEY = "lotto24_tickets";
const STORAGE_QR_KEY = "bokgwon24_qr_history";

/**
 * 모든 복권 기록 가져오기 (수동 입력 등)
 */
export const getTickets = () => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

/**
 * 확인목록 아이템 정규화 및 검증
 */
export const normalizeHistoryItem = (item) => {
  if (!item || typeof item !== "object") return null;

  const drawNo =
    item?.drawNo ??
    item?.parsed?.drawNo ??
    item?.result?.drawNo ??
    item?.result?.drawInfo?.drawNo ??
    null;

  // 회차 정보가 없으면 유효하지 않은 기록으로 간주
  if (drawNo === null || drawNo === undefined || drawNo === "") {
    return null;
  }

  const games =
    Array.isArray(item?.games)
      ? item.games
      : Array.isArray(item?.parsed?.games)
        ? item.parsed.games
        : [];

  const results =
    Array.isArray(item?.results)
      ? item.results
      : Array.isArray(item?.result?.results)
        ? item.result.results
        : [];

  return {
    id: item?.id || `history_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    type: item?.type || item?.parsed?.type || "lotto645",
    drawNo: Number(drawNo),
    drawDate: item?.drawDate || item?.result?.drawDate || item?.parsed?.drawDate || "",
    checkedAt: item?.checkedAt || item?.createdAt || new Date().toISOString(),
    rawQr: item?.rawQr || "",
    games,
    results,
    topRank: Number(item?.topRank ?? 0),
    winningNumbers: item?.winningNumbers || item?.result?.winningNumbers || [],
    bonusNo: item?.bonusNo ?? item?.result?.bonusNo ?? null,
    parsed: item?.parsed || null,
    result: item?.result || null
  };
};

/**
 * QR 스캔 기록 가져오기
 */
export const getQrHistory = () => {
  try {
    const data = localStorage.getItem(STORAGE_QR_KEY);
    if (!data) return [];
    
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      localStorage.removeItem(STORAGE_QR_KEY);
      return [];
    }

    // 유효한 데이터만 정규화 및 필터링
    const normalized = parsed
      .map(normalizeHistoryItem)
      .filter(Boolean);

    // 손상된 데이터가 있었다면 정리된 리스트로 교체 저장
    if (normalized.length !== parsed.length) {
      console.log(`[Storage] Cleaned ${parsed.length - normalized.length} broken items`);
      localStorage.setItem(STORAGE_QR_KEY, JSON.stringify(normalized));
    }

    return normalized;
  } catch (e) {
    console.error("QR History parse error", e);
    localStorage.removeItem(STORAGE_QR_KEY);
    return [];
  }
};

/**
 * QR 기록 삭제
 */
export const deleteQrRecord = (id) => {
  const history = getQrHistory();
  const filtered = history.filter(h => h.id !== id);
  localStorage.setItem(STORAGE_QR_KEY, JSON.stringify(filtered));
};

/**
 * QR 기록 전체 삭제
 */
export const clearQrHistory = () => {
  localStorage.removeItem(STORAGE_QR_KEY);
};

// 하위 호환성 유지
export const getMyTickets = getTickets;

/**
 * 새 복권 기록 저장 (수동 등)
 */
export const saveTicket = (ticketData) => {
  const tickets = getTickets();
  const newTicket = {
    id: nanoid(),
    createdAt: new Date().toISOString(),
    ...ticketData
  };
  tickets.unshift(newTicket);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  return newTicket;
};

/**
 * 복권 기록 삭제
 */
export const deleteTicket = (id) => {
  const tickets = getTickets();
  const filtered = tickets.filter(t => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
};
