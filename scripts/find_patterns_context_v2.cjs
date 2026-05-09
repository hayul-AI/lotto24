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
    const targetLine = 2284;
    for (let i = targetLine; i < targetLine + 200; i++) {
        if (lines[i]) console.log(`${i}: ${lines[i].trim()}`);
    }
  } catch (err) {
    console.error(err.message);
  }
}

find();
