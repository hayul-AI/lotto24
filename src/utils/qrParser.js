/**
 * 복권 QR 코드를 분석하여 로또 6/45 또는 연금복권 720+인지 판별하고 정보를 추출합니다.
 */
export const parseLotteryQr = (decodedText) => {
  const rawText = String(decodedText || "").trim();
  
  // 1. URL 파싱 시도 및 기본 정보 추출
  let url = null;
  let v = "";
  try {
    if (rawText.startsWith("http")) {
      url = new URL(rawText);
      v = url.searchParams.get("v") || "";
      
      console.log("[QR URL PARSE]", {
        href: url.href,
        host: url.host,
        pathname: url.pathname,
        searchParams: Object.fromEntries(url.searchParams.entries())
      });
    }
  } catch (e) {
    console.warn("[QR URL PARSE FAILED]", e);
  }

  // 2. 신규 연금복권 형식 감지 (v가 pd로 시작하는 경우)
  if (url && url.hostname.includes("qr.dhlottery.co.kr") && v && v.toLowerCase().startsWith("pd")) {
    console.log("[PENSION QR DETECTED]", { v, reason: "v starts with pd" });
    return parsePensionQrPdFormat(v, rawText);
  }

  // 3. 기존 연금복권 패턴 감지
  const isPensionPattern = /pension|720|연금|l720|game720|lotto720|gr=|jo=|drwNo=|drawNo=/i.test(rawText);
  if (isPensionPattern || v.toLowerCase().startsWith('p')) {
    const pensionResult = parsePensionQr(rawText);
    if (pensionResult.success) {
      return { ...pensionResult.data, rawText };
    }
  }

  // 4. 로또 6/45 시도
  const lottoResult = parseLottoQr(rawText);
  if (lottoResult.success) {
    return { ...lottoResult.data, rawText };
  }

  // 5. 모든 시도 실패 시 unknown 반환
  console.warn("[QR UNKNOWN FORMAT]", {
    rawText,
    parsedUrl: url?.href || null,
    searchParams: url ? Object.fromEntries(url.searchParams) : null
  });

  return {
    type: "unknown",
    drawNo: null,
    group: null,
    numbers: null,
    rawText,
    reason: "지원하지 않는 QR 형식입니다."
  };
};

/**
 * v=pd...s... 형식의 연금복권 파싱
 * 예: pd1203151s269632
 */
const parsePensionQrPdFormat = (v, rawText) => {
  // s를 기준으로 왼쪽과 오른쪽(번호) 분리
  const match = v.match(/^pd(\d+)s(\d{6})$/i);
  
  if (match) {
    const leftPart = match[1]; // "1203151"
    const numberText = match[2]; // "269632"
    const numbers = numberText.split("").map(Number);

    console.log("[PENSION QR VALUE PARSED]", {
      v,
      leftPart,
      numberText,
      numbers
    });

    // 1203151 에서 drawNo와 group 추출 시도 (가설: 120회차, 3조?)
    // 아직 정확하지 않으므로 null 처리하되 pension720으로 분류
    return {
      type: "pension720",
      drawNo: null,
      group: null,
      numbers: numbers,
      rawText,
      qrValue: v,
      reason: "pension_qr_pd_detected"
    };
  }

  // 형식이 맞지 않더라도 pd로 시작하면 연금복권으로 분류
  return {
    type: "pension720",
    drawNo: null,
    group: null,
    numbers: null,
    rawText,
    qrValue: v,
    reason: "pension_qr_pd_detected_invalid_format"
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

  if (!v || !/[a-z]/i.test(v) || v.toLowerCase().startsWith('pd') || v.toLowerCase().startsWith('p')) {
    // pd는 연금복권 전용이므로 제외
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
 * 기존 연금복권 720+ 파싱
 */
export const parsePensionQr = (decodedText) => {
  const rawQr = String(decodedText || "").trim();
  let v = "";
  let searchParams = {};

  try {
    if (rawQr.includes('?')) {
      const urlObj = new URL(rawQr);
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

  return { success: false, reason: "연금복권 번호를 읽을 수 없습니다.", rawQr };
};
