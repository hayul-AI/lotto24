const { db } = require('./firebaseAdmin.cjs');

async function check() {
  try {
    const lottoStatus = await db.collection('sync_status').doc('lotto').get();
    console.log("--- sync_status/lotto ---");
    console.log(JSON.stringify(lottoStatus.data(), null, 2));

    const latestLotto = await db.collection('lotto_results').orderBy('drawNo', 'desc').limit(1).get();
    if (!latestLotto.empty) {
      console.log("\n--- Latest lotto_results ---");
      const data = latestLotto.docs[0].data();
      console.log(JSON.stringify({
        drawNo: data.drawNo,
        source: data.source,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
      }, null, 2));
    }
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

check();
