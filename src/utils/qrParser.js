/**
 * 복권 QR 코드를 분석하여 로또 6/45 또는 연금복권 720+인지 판별하고 정보를 추출합니다.
 */
/**
 * 복권 QR 코드를 분석하여 로또 6/45 또는 연금복권 720+인지 판별하고 정보를 추출합니다.
 */
export const parseLotteryQr = (decodedText) => {
  const rawQr = String(decodedText || "").trim();
  
  // 1. 연금복권 패턴 감지 (URL에 연금복권 관련 키워드가 있는 경우)
  const isPensionPattern = /pension|720|연금|l720|game720|lotto720|gr=|jo=|drwNo=|drawNo=/i.test(rawQr);

  if (isPensionPattern) {
    const pensionResult = parsePensionQr(rawQr);
    if (pensionResult.success) return pensionResult.data;
  }

  // 2. 로또 먼저 시도
  const lottoResult = parseLottoQr(rawQr);
  if (lottoResult.success) {
    return lottoResult.data;
  }

  // 3. 연금복권 다시 시도 (패턴 매칭이 안 되었더라도 시도)
  const pensionResult = parsePensionQr(rawQr);
  if (pensionResult.success) {
    return pensionResult.data;
  }

  // 모든 파싱 실패 시 로그
  console.warn("[QR PARSE FAILED]", {
    rawText: rawQr,
    reason: "지원하지 않는 QR 형식이거나 데이터가 올바르지 않습니다."
  });

  return {
    type: "unknown",
    rawQr: rawQr || ""
  };
};

/**
 * 로또 6/45 파싱
 * 예: https://qr.dhlottery.co.kr/?v=1222m041219273341m...
 */
export const parseLottoQr = (decodedText) => {
  const rawQr = String(decodedText || "").trim();
  let v = "";

  try {
    if (rawQr.includes('?')) {
      const url = new URL(rawQr);
      v = url.searchParams.get("v") || "";
    }
  } catch (e) {}

  if (!v) {
    const match = rawQr.match(/v=([^&]+)/);
    v = match ? match[1] : rawQr;
  }

  // 로또 QR은 반드시 알파벳 구분자(m, q, s 등)를 포함함 (단, p로 시작하는 연금복권 제외)
  if (!v || !/[a-z]/i.test(v) || v.toLowerCase().startsWith('p')) {
    return { success: false, reason: "로또 QR 데이터 형식이 올바르지 않습니다.", rawQr };
  }

  // 알파벳(m, q, s 등)을 기준으로 분리
  const parts = v.split(/[a-z]/i).filter(Boolean);
  const drawNo = Number(parts[0]);

  if (!Number.isFinite(drawNo) || drawNo < 1 || drawNo > 5000) {
    return { success: false, reason: "회차 번호를 인식하지 못했습니다.", rawQr };
  }

  const labels = ["A", "B", "C", "D", "E"];
  const games = [];

  // i=1부터 각 게임 파트 분석
  for (let i = 1; i < parts.length && games.length < 5; i++) {
    const digits = parts[i].replace(/\D/g, "");
    if (digits.length < 12) continue;

    const gameCode = digits.slice(0, 12);
    const numbers = [];
    for (let j = 0; j < 12; j += 2) {
      numbers.push(Number(gameCode.slice(j, j + 2)));
    }

    const isValid =
      numbers.length === 6 &&
      numbers.every((n) => Number.isInteger(n) && n >= 1 && n <= 45) &&
      new Set(numbers).size === 6;

    if (!isValid) continue;

    games.push({
      label: labels[games.length],
      numbers: numbers.sort((a, b) => a - b)
    });
  }

  if (!games.length) {
    return { success: false, reason: "유효한 로또 게임 번호를 찾지 못했습니다.", rawQr };
  }

  return {
    success: true,
    data: {
      type: "lotto645",
      drawNo: Number(drawNo),
      games,
      rawQr
    }
  };
};

/**
 * 연금복권 720+ 파싱
 * 예: https://m.dhlottery.co.kr/qr.do?method=pension720&v=p02130141697
 */
export const parsePensionQr = (decodedText) => {
  const rawQr = String(decodedText || "").trim();
  let v = "";
  let searchParams = {};

  // 1. URL에서 v 파라미터 추출 시도
  try {
    if (rawQr.includes('?')) {
      const url = new URL(rawQr);
      v = url.searchParams.get("v") || "";
      url.searchParams.forEach((val, key) => {
        searchParams[key] = val;
      });
    }
  } catch (e) {}

  // 2. v= 패턴으로 직접 추출 시도
  if (!v) {
    const vMatch = rawQr.match(/v=([^&]+)/);
    if (vMatch) v = vMatch[1];
  }

  // 3. v값이 없으면 원문 자체를 v로 가정 (숫자와 'p'만 남김)
  if (!v) {
    v = rawQr.replace(/[^0-9pP]/g, '');
  }

  const originalV = v;

  // 'p' 접두사 제거
  if (v.toLowerCase().startsWith('p')) {
    v = v.substring(1);
  }

  // 연금복권 데이터 형식: {회차4}{조1}{번호6} = 총 11자리
  // 최근 회차는 3자리일 수도 있으므로 최소 10자리 이상 체크
  if (v && v.length >= 10 && v.length <= 13) {
    const numberStr = v.substring(v.length - 6);
    const groupStr = v.substring(v.length - 7, v.length - 6);
    const drawNoStr = v.substring(0, v.length - 7);

    const numberArr = numberStr.split('').map(Number);
    const group = Number(groupStr);
    const drawNo = Number(drawNoStr);

    if (numberArr.length === 6 && !isNaN(drawNo) && !isNaN(group)) {
      console.log("[PENSION QR PARSED]", {
        drawNo,
        group: groupStr,
        numbers: numberArr
      });

      return {
        success: true,
        data: {
          type: "pension720",
          drawNo: drawNo,
          group: groupStr,
          numbers: numberArr,
          fullNumber: `${groupStr}조 ${numberStr}`,
          rawQr: rawQr
        }
      };
    }
  }

  console.warn("[PENSION QR DETECT FAILED]", {
    rawText: rawQr,
    v: originalV,
    searchParams,
    reason: "연금복권 형식이 아니거나 번호 추출 실패"
  });

  return { success: false, reason: "연금복권 형식이 아닙니다.", rawQr };
};
