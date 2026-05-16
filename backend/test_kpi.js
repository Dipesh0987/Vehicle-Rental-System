// Simple test script to query the KPI endpoint
const fetch = global.fetch || require('node-fetch');

async function run() {
  const base = process.env.KPI_BASE || 'http://localhost:3001';
  const res = await fetch(`${base}/api/kpis`);
  const json = await res.json();
  console.log('KPI response:', JSON.stringify(json, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
