/**
 * 로또 번호별 실제 한국 로또볼 색상 반환
 */
export const getBallColor = (number) => {
  const n = Number(number);
  if (n >= 1 && n <= 10) return "#FBC400";
  if (n >= 11 && n <= 20) return "#4AA3FF";
  if (n >= 21 && n <= 30) return "#FF5A5A";
  if (n >= 31 && n <= 40) return "#777777";
  if (n >= 41 && n <= 45) return "#5AC85A";
  return "#BBBBBB";
};

/**
 * 로또 당첨 판정
 */
export const checkLottoWinning = (myGame, officialResult) => {
  if (!myGame || !myGame.numbers || !officialResult || !officialResult.numbers) {
    return { rank: 0, prize: "낙첨", matchedCount: 0 };
  }
  
  const winningNumbers = officialResult.numbers;
  const bonusNumber = officialResult.bonusNo;
  
  const matchedNumbers = myGame.numbers.filter(n => winningNumbers.includes(n));
  const matchedCount = matchedNumbers.length;
  const isBonusMatch = myGame.numbers.includes(bonusNumber);

  if (matchedCount === 6) return { rank: 1, prize: "1등", matchedCount };
  if (matchedCount === 5 && isBonusMatch) return { rank: 2, prize: "2등", matchedCount, isBonusMatch: true };
  if (matchedCount === 5) return { rank: 3, prize: "3등", matchedCount };
  if (matchedCount === 4) return { rank: 4, prize: "4등", matchedCount };
  if (matchedCount === 3) return { rank: 5, prize: "5등", matchedCount };
  
  return { rank: 0, prize: "낙첨", matchedCount };
};

/**
 * 연금복권 당첨 판정
 * @param {string} myGroup - 내 조 (예: "1")
 * @param {string} myNumber - 내 6자리 번호 (예: "123456")
 * @param {object} officialResult - 공식 결과 (drawNo, firstPrizeNumber: { group, numbers })
 */
export const checkPensionWinning = (myGroup, myNumber, officialResult) => {
  if (!myNumber || !officialResult || !officialResult.firstPrizeNumber) {
    return { rank: 0, prize: "낙첨" };
  }

  const official = officialResult.firstPrizeNumber;
  const winGroup = String(official.group);
  const winNums = official.numbers.join(''); // Array to string "123456"

  // 1. 1등 판별 (조 일치 + 6자리 일치)
  if (String(myGroup) === winGroup && myNumber === winNums) {
    return { rank: 1, prize: "1등" };
  }

  // 2. 2등 판별 (조 상관없이 6자리 일치)
  if (myNumber === winNums) {
    return { rank: 2, prize: "2등" };
  }

  // 3. 끝자리 일치 판별 (3~7등)
  // 뒤에서부터 몇 자리가 일치하는지 계산
  let matchCount = 0;
  for (let i = 1; i <= 5; i++) {
    if (myNumber.endsWith(winNums.slice(-i))) {
      matchCount = i;
    } else {
      break;
    }
  }

  if (matchCount === 5) return { rank: 3, prize: "3등" };
  if (matchCount === 4) return { rank: 4, prize: "4등" };
  if (matchCount === 3) return { rank: 5, prize: "5등" };
  if (matchCount === 2) return { rank: 6, prize: "6등" };
  if (matchCount === 1) return { rank: 7, prize: "7등" };

  // 보너스 번호 판별 로직은 데이터 구조에 따라 추가 가능 (현재는 1~7등 위주)
  return { rank: 0, prize: "낙첨" };
};
