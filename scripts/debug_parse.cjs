const axios = require('axios');

async function debug() {
  try {
    const response = await axios.get('https://www.dhlottery.co.kr/smarPage', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/004.1'
      }
    });
    const html = response.data;
    console.log("HTML Length:", html.length);
    
    // Look for drawNo (e.g., 1100회)
    const drawNoMatch = html.match(/<strong[^>]*>([0-9,]+)<\/strong>회/);
    console.log("DrawNo Match:", drawNoMatch ? drawNoMatch[1] : "Not found");

    // Look for numbers - search for ball_645 class
    const numRegex = /<span class="ball_645 [^"]+">([0-9]+)<\/span>/g;
    let match;
    const nums = [];
    while ((match = numRegex.exec(html)) !== null) {
      nums.push(match[1]);
    }
    console.log("Numbers Found:", nums);

    // Look for date
    const dateMatch = html.match(/\(([0-9]{4}-[0-9]{2}-[0-9]{2}) 추첨\)/);
    console.log("Date Match:", dateMatch ? dateMatch[1] : "Not found");

    // Look for prize info
    const prizeMatch = html.match(/<strong>([0-9,]+)<\/strong>원/);
    console.log("Prize Match:", prizeMatch ? prizeMatch[1] : "Not found");

    // Look for winner count
    const winnerMatch = html.match(/<strong>([0-9,]+)<\/strong>명/);
    console.log("Winner Match:", winnerMatch ? winnerMatch[1] : "Not found");

    // Find the section with the results
    const resultIdx = html.indexOf('회 당첨결과');
    if (resultIdx !== -1) {
        console.log("Result Section Context:", html.slice(resultIdx - 50, resultIdx + 500));
    } else {
        console.log("'회 당첨결과' text not found");
    }

    // Save a snippet to file for manual inspection
    const fs = require('fs');
    fs.writeFileSync('scripts/smarPage_snippet.html', html.slice(0, 10000));
  } catch (err) {
    console.error(err.message);
  }
}

debug();
