const axios = require('axios');

async function find() {
  try {
    const response = await axios.get('https://www.dhlottery.co.kr/smarPage', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/004.1'
      }
    });
    const html = response.data;
    const lines = html.split('\n');
    lines.forEach((line, i) => {
      if (line.includes('ball_645') || line.includes('회') || line.includes('당첨결과')) {
        if (line.length < 500) {
            console.log(`${i}: ${line.trim()}`);
        }
      }
    });
  } catch (err) {
    console.error(err.message);
  }
}

find();
