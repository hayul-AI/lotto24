/**
 * 복권 QR 코드를 분석하여 로또 6/45 또는 연금복권 720+인지 판별하고 정보를 추출합니다.
 */
export const parseLotteryQr = (decodedText) => {
  const rawQr = String(decodedText || "").trim();
  
  // 1. 연금복권 패턴 감지 (URL에 연금복권 관련 키워드가 있는 경우)
  const isPensionPattern = /pension|720|연금|l720|game720|lotto720|gr=|jo=|drwNo=|drawNo=/i.test(rawQr);

  if (isPensionPattern) {
    const pensionResult = parsePensionQr(rawQr);
    if (pensionResult.success) {
      return { ...pensionResult.data, rawText: rawQr };
    }
  }

  // 2. 로또 먼저 시도
  const lottoResult = parseLottoQr(rawQr);
  if (lottoResult.success) {
    return { ...lottoResult.data, rawText: rawQr };
  }

  // 3. 연금복권 다시 시도 (패턴 매칭이 안 되었더라도 시도)
  const pensionResult = parsePensionQr(rawQr);
  if (pensionResult.success) {
    return { ...pensionResult.data, rawText: rawQr };
  }

  return {
    type: "unknown",
    drawNo: null,
    group: null,
    numbers: null,
    rawText: rawQr,
    reason: isPensionPattern ? "연금복권 번호를 읽을 수 없습니다." : "지원하지 않는 QR 형식입니다."
  };
};

/**
 * 로또 6/45 파싱
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

  if (!v || !/[a-z]/i.test(v) || v.toLowerCase().startsWith('p')) {
    return { success: false, reason: "로또 QR 데이터 형식이 올바르지 않습니다.", rawQr };
  }

  const parts = v.split(/[a-z]/i).filter(Boolean);
  const drawNo = Number(parts[0]);

  if (!Number.isFinite(drawNo) || drawNo < 1 || drawNo > 5000) {
    return { success: false, reason: "회차 번호를 인식하지 못했습니다.", rawQr };
  }

  const labels = ["A", "B", "C", "D", "E"];
  const games = [];

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
      group: null,
      numbers: null
    }
  };
};

/**
 * 연금복권 720+ 파싱
 */
export const parsePensionQr = (decodedText) => {
  const rawQr = String(decodedText || "").trim();
  let v = "";
  let searchParams = {};
  let urlObj = null;

  try {
    if (rawQr.includes('?')) {
      urlObj = new URL(rawQr);
      v = urlObj.searchParams.get("v") || "";
      urlObj.searchParams.forEach((val, key) => {
        searchParams[key] = val;
      });
    }
  } catch (e) {}

  if (!v) {
    const vMatch = rawQr.match(/v=([^&]+)/);
    if (vMatch) v = vMatch[1];
  }

  if (!v) {
    v = rawQr.replace(/[^0-9pP]/g, '');
  }

  const originalV = v;
  let workV = v;

  if (workV.toLowerCase().startsWith('p')) {
    workV = workV.substring(1);
  }

  if (workV && workV.length >= 9 && workV.length <= 13) {
    const numberStr = workV.substring(workV.length - 6);
    const groupStr = workV.substring(workV.length - 7, workV.length - 6);
    const drawNoStr = workV.substring(0, workV.length - 7);

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
          fullNumber: `${groupStr}조 ${numberStr}`
        }
      };
    }
  }

  console.warn("[PENSION QR DETECT FAILED]", {
    rawText: rawQr,
    parsedUrl: urlObj?.href || null,
    searchParams: searchParams,
    reason: "연금복권 형식이 아니거나 번호 추출 실패"
  });

  return { success: false, reason: "연금복권 번호를 읽을 수 없습니다.", rawQr };
};
