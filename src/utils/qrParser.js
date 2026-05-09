/**
 * 복권 QR 코드를 분석하여 로또 6/45 또는 연금복권 720+인지 판별하고 정보를 추출합니다.
 */
export const parseLotteryQr = (decodedText) => {
  const rawQr = String(decodedText || "").trim();
  
  // 연금복권 여부 먼저 체크 (p로 시작하는 v 파라미터가 있는 경우 우선)
  let v = "";
  try {
    const url = new URL(rawQr);
    v = url.searchParams.get("v") || "";
  } catch (e) {
    const match = rawQr.match(/v=([^&]+)/);
    v = match ? match[1] : "";
  }

  // v값이 p로 시작하면 연금복권으로 우선 시도
  if (v && v.toLowerCase().startsWith('p')) {
    const pensionResult = parsePensionQr(decodedText);
    if (pensionResult.success) return pensionResult.data;
  }

  // 그 외에는 로또 먼저 시도
  const lottoResult = parseLottoQr(decodedText);
  if (lottoResult.success) {
    return lottoResult.data;
  }

  const pensionResult = parsePensionQr(decodedText);
  if (pensionResult.success) {
    return pensionResult.data;
  }

  return {
    type: "unknown",
    rawQr: decodedText || ""
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
    const url = new URL(rawQr);
    v = url.searchParams.get("v") || "";
  } catch (e) {
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

  try {
    const url = new URL(rawQr);
    v = url.searchParams.get("v") || "";
  } catch (e) {
    const match = rawQr.match(/v=([^&]+)/);
    v = match ? match[1] : "";
  }

  // v값이 없으면 원문에서 숫자만 추출 시도
  if (!v) {
    const pureDigits = rawQr.replace(/[^0-9]/g, '');
    if (pureDigits.length === 11) v = pureDigits;
  }

  // 'p' 접두사 제거 (연금복권 특유의 접두사)
  if (v.toLowerCase().startsWith('p')) {
    v = v.substring(1);
  }

  if (v && v.length >= 11) {
    const drawNo = parseInt(v.substring(0, 4));
    const group = parseInt(v.substring(4, 5));
    const number = v.substring(5, 11);

    if (!isNaN(drawNo) && !isNaN(group) && number.length === 6) {
      return {
        success: true,
        data: {
          type: "pension720",
          drawNo: Number(drawNo),
          group: Number(group),
          number,
          fullNumber: `${group}조 ${number}`,
          rawQr
        }
      };
    }
  }

  return { success: false, reason: "연금복권 형식이 아닙니다.", rawQr };
};
