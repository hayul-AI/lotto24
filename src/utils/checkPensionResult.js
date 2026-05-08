/**
 * 연금복권 720+ 당첨 결과 확인 유틸리티
 */

export const checkPensionRank = (myTicket, winNumbers) => {
  if (!myTicket || !winNumbers) return null;

  // myTicket: { grade: number, numbers: number[] }
  // winNumbers: { grade: number, winning: number[] } (from Firestore)
  
  const { grade: myGrade, numbers: myNums } = myTicket;
  const { grade: winGrade, winning: winNums } = winNumbers;

  // 6자리 번호 일치 개수 (뒤에서부터 확인)
  let matchCount = 0;
  for (let i = 5; i >= 0; i--) {
    if (myNums[i] === winNums[i]) {
      matchCount++;
    } else {
      break;
    }
  }

  // 1등: 조 + 6자리 모두 일치
  if (myGrade === winGrade && matchCount === 6) {
    return { rank: 1, label: '1등', prize: '매월 700만원 x 20년' };
  }

  // 2등: 6자리 모두 일치 (조 상관없음)
  if (matchCount === 6) {
    return { rank: 2, label: '2등', prize: '매월 100만원 x 10년' };
  }

  // 3등: 뒤 5자리 일치
  if (matchCount === 5) {
    return { rank: 3, label: '3등', prize: '100만원' };
  }

  // 4등: 뒤 4자리 일치
  if (matchCount === 4) {
    return { rank: 4, label: '4등', prize: '10만원' };
  }

  // 5등: 뒤 3자리 일치
  if (matchCount === 3) {
    return { rank: 5, label: '5등', prize: '5만원' };
  }

  // 6등: 뒤 2자리 일치
  if (matchCount === 2) {
    return { rank: 6, label: '6등', prize: '5,000원' };
  }

  // 7등: 뒤 1자리 일치
  if (matchCount === 1) {
    return { rank: 7, label: '7등', prize: '1,000원' };
  }

  return { rank: 0, label: '낙첨', prize: '0원' };
};
