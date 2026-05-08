const { fetchLatestLotto } = require('./fetchLatestLotto.cjs');
const { fetchLatestPension } = require('./fetchLatestPension.cjs');

async function runSync() {
  const mode = process.argv[2] || 'all'; // lotto, pension, all
  console.log(`🔄 Running Sync Mode: ${mode}`);

  try {
    if (mode === 'lotto' || mode === 'all') {
      await fetchLatestLotto();
    }

    if (mode === 'pension' || mode === 'all') {
      await fetchLatestPension();
    }

    console.log("✨ All sync tasks finished.");
  } catch (err) {
    console.error("❌ Sync Task Failed:", err);
    process.exit(1);
  }
}

runSync();
