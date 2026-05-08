/**
 * 금액을 한국 통화 형식으로 변환 (예: 2850000000 -> 28억 5,000만원)
 * 0 또는 null일 경우 "당첨금 정보 준비 중" 반환
 */
export const formatCurrencyKRW = (amount) => {
  if (!amount || amount <= 0) return "당첨금 정보 준비 중";

  const eok = Math.floor(amount / 100000000);
  const man = Math.floor((amount % 100000000) / 10000);

  let result = "";
  if (eok > 0) result += `${eok}억 `;
  if (man > 0) result += `${man.toLocaleString()}만원`;
  else if (eok > 0) result += ""; // 억 단위만 있을 때
  else result = `${amount.toLocaleString()}원`;

  return result.trim();
};

/**
 * 날짜 포맷 변환 (YYYY-MM-DD -> YYYY.MM.DD)
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return "";
  return dateStr.replace(/-/g, ".");
};

/**
 * 회차 번호 포맷 (1222 -> 1222회)
 */
export const formatDrawNo = (no) => {
  if (!no) return "";
  return `${no}회`;
};
