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
 * 복권 고유 키 생성 (중복 확인용)
 */
export const generateDuplicateKey = (item) => {
  if (!item) return null;
  const type = item.type || item.lotteryType || (item.parsed?.type) || "unknown";
  const drawNo = item.drawNo || item.parsed?.drawNo;
  
  if (type === "lotto645") {
    const rawQr = item.rawQr || item.parsed?.rawQr || "";
    // QR 원문이 있으면 그것을 키로 사용 (가장 정확)
    if (rawQr) return `lotto645:${drawNo}:${rawQr}`;
    
    // QR이 없으면 게임 번호들을 정렬해서 키 생성
    const games = item.games || item.parsed?.games || [];
    const gamesStr = games.map(g => (g.numbers || []).join(",")).sort().join("|");
    return `lotto645:${drawNo}:${gamesStr}`;
  }
  
  if (type === "pension720") {
    const group = item.group || item.pensionGroup || item.selectedGroup || "-";
    const numberText = item.numberText || item.scannedNumberText || (Array.isArray(item.numbers) ? item.numbers.join("") : "");
    return `pension720:${drawNo}:${group}:${numberText}`;
  }
  
  return null;
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

  let games =
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

  // 연금복권 하위 호환성: games가 없으면 가상으로 생성
  const isPension = (item?.type || item?.parsed?.type) === "pension720";
  if (isPension && games.length === 0) {
    games = [{
      label: "A",
      group: item?.group || item?.selectedGroup || item?.pensionGroup || "-",
      numberText: item?.numberText || item?.scannedNumberText || (Array.isArray(item?.numbers) ? item?.numbers.join("") : "") || item?.selectedNumber || "-",
      numbers: Array.isArray(item?.numbers) ? item?.numbers : [],
      rank: item?.rank,
      result: item?.result || item?.rank
    }];
  }

  // 하위 호환성: 당첨금 정보가 없으면 재계산 시도
  let totalPrizeAmount = item?.totalPrizeAmount ?? 0;
  let totalPrizeLabel = item?.totalPrizeLabel ?? "";
  let hasUnknownPrizeAmount = item?.hasUnknownPrizeAmount ?? false;
  let winCount = item?.winCount ?? results.filter(r => (r.rank || 0) > 0).length;

  if (totalPrizeAmount === 0 && totalPrizeLabel === "" && winCount > 0) {
    const isLotto = (item?.type || item?.parsed?.type) === "lotto645";
    
    if (isLotto) {
      let calcAmt = 0;
      results.forEach(r => {
        if (r.rank === 5) calcAmt += 5000;
        else if (r.rank === 4) calcAmt += 50000;
        else if (r.rank >= 1 && r.rank <= 3) {
          if (r.prizeAmount) calcAmt += r.prizeAmount;
          else hasUnknownPrizeAmount = true;
        }
      });
      totalPrizeAmount = calcAmt;
      if (calcAmt > 0) totalPrizeLabel = `${calcAmt.toLocaleString("ko-KR")}원`;
      else if (hasUnknownPrizeAmount) totalPrizeLabel = "당첨금 확인 필요";
    } else {
      // 연금복권
      const mainResult = results[0];
      if (mainResult && mainResult.rank > 0) {
        totalPrizeLabel = mainResult.prizeLabel || mainResult.prize || "";
        const amt = Number(totalPrizeLabel.replace(/[^0-9]/g, ''));
        if (amt > 0) totalPrizeAmount = amt;
        else hasUnknownPrizeAmount = true;
      }
    }
  }

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
    totalPrizeAmount,
    totalPrizeLabel,
    hasUnknownPrizeAmount,
    winCount,
    // 연금복권 필드 보강 및 우선순위 적용
    result: item?.result || item?.rank || (item?.resultStatus === "win" ? (item?.rank || "당첨") : (item?.resultStatus === "lose" ? "낙첨" : (item?.resultStatus === "pending" ? "추첨전" : "-"))),
    group: item?.group || item?.selectedGroup || item?.pensionGroup || "-",
    numberText: item?.numberText || item?.scannedNumberText || (Array.isArray(item?.numbers) ? item?.numbers.join("") : "") || item?.selectedNumber || "-",
    winningNumbers: item?.winningNumbers || item?.result?.winningNumbers || [],
    bonusNo: item?.bonusNo ?? item?.result?.bonusNo ?? null,
    parsed: item?.parsed || null,
    resultData: item?.result || null,
    duplicateKey: item?.duplicateKey || generateDuplicateKey(item)
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
