const axios = require('axios');

async function debug() {
  try {
    const response = await axios.get('https://www.dhlottery.co.kr/smarPage', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/004.1'
      }
    });
    const html = response.data;
    
    const drawNoMatch = html.match(/<div class="round-num">\s*([0-9,]+)/);
    const parsedDrawNo = parseInt(drawNoMatch[1].replace(/,/g, ''));
    console.log("Parsed DrawNo:", parsedDrawNo);

    const dateMatch = html.match(/<div class="today-date">\s*([0-9]{4})년\s*([0-9]{2})월\s*([0-9]{2})일/);
    const parsedDrawDate = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : "Unknown";
    console.log("Parsed Date:", parsedDrawDate);

    const ballBoxParts = html.split('result-ballBox');
    const ballBoxSection = ballBoxParts[1].split('figure')[0];
    const ballMatches = ballBoxSection.match(/<div class="result-ball [^"]+">\s*([0-9]+)\s*<\/div>/g);
    const parsedNumbers = ballMatches.slice(0, 6).map(s => parseInt(s.match(/>\s*([0-9]+)\s*</)[1])).sort((a, b) => a - b);
    console.log("Parsed Numbers:", parsedNumbers);

    const bonusParts = html.split('보너스번호');
    const bonusMatch = bonusParts[1].match(/<div class="result-ball [^"]+">\s*([0-9]+)\s*<\/div>/);
    const parsedBonusNo = bonusMatch ? parseInt(bonusMatch[1]) : 0;
    console.log("Parsed Bonus:", parsedBonusNo);

    const prizeMatch = html.match(/<span id="rnk1SumWnAmtTop">\s*([0-9,]+)/);
    const parsedFirstPrizeAmount = prizeMatch ? parseInt(prizeMatch[1].replace(/,/g, '')) : 0;
    console.log("Parsed Prize:", parsedFirstPrizeAmount);

    const winnerMatch = html.match(/<span id="rnk1WnNopeTop">\s*([0-9,]+)/);
    const parsedFirstWinnerCount = winnerMatch ? parseInt(winnerMatch[1].replace(/,/g, '')) : 0;
    console.log("Parsed Winner Count:", parsedFirstWinnerCount);

  } catch (err) {
    console.error(err.message);
  }
}

debug();
