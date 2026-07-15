// Run: node diagnose-shipengine.mjs
import { readFileSync, existsSync } from 'fs';

function loadEnvFile(filename) {
  if (!existsSync(filename)) return false;
  let txt = readFileSync(filename, 'utf8');
  txt = txt.replace(/^\uFEFF/, ''); // strip BOM if present
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[m[1]] = value;
  }
  return true;
}

const candidates = ['.env.local', '.env', '.env.development.local', '.env.production.local'];
const loaded = candidates.filter(loadEnvFile);
console.log('Loaded env files:', loaded.length ? loaded : '(none found — checked ' + candidates.join(', ') + ')');

const apiKey = process.env.SHIPENGINE_API_KEY;
const carrierIds = (process.env.SHIPENGINE_CARRIER_IDS ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean);

if (!apiKey) {
  console.error('SHIPENGINE_API_KEY not found in env or .env.local');
  process.exit(1);
}

console.log('Using key prefix:', apiKey.slice(0, 8) + '...', apiKey.startsWith('TEST_') ? '(SANDBOX)' : '(LIVE)');
console.log('Carrier IDs from env:', carrierIds.length ? carrierIds : '(none — will auto-fetch)');

async function main() {
  const carriersRes = await fetch('https://api.shipstation.com/v1/carriers', {
    headers: { 'API-Key': apiKey, Accept: 'application/json' },
  });
  const carriersBody = await carriersRes.json();
  console.log('\n--- GET /v1/carriers ---');
  console.log('status:', carriersRes.status);
  console.log(JSON.stringify(carriersBody, null, 2));

  const realCarrierIds = carrierIds.length
    ? carrierIds
    : (carriersBody.carriers ?? []).map((c) => c.carrier_id).filter(Boolean);

  const payload = {
    shipment: {
      ship_from: {
        name: 'Test Sender', phone: '5555555555',
        address_line1: '123 Main St', city_locality: 'New York',
        state_province: 'NY', postal_code: '10001', country_code: 'US',
        address_residential_indicator: 'no',
      },
      ship_to: {
        name: 'Test Recipient', phone: '5555555555',
        address_line1: '456 Market St', city_locality: 'Los Angeles',
        state_province: 'CA', postal_code: '90012', country_code: 'US',
        address_residential_indicator: 'yes',
      },
      packages: [{ weight: { value: 1, unit: 'pound' } }],
    },
    rate_options: realCarrierIds.length ? { carrier_ids: realCarrierIds } : undefined,
  };

  const ratesRes = await fetch('https://api.shipstation.com/v1/rates', {
    method: 'POST',
    headers: { 'API-Key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const ratesBody = await ratesRes.json();
  console.log('\n--- POST /v1/rates ---');
  console.log('status:', ratesRes.status);
  console.log(JSON.stringify(ratesBody, null, 2));
}

main().catch((e) => console.error('Script error:', e));