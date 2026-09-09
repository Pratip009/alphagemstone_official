/**
 * check-fulfillment-address.mjs
 * ──────────────────────────────
 * Verifies that the address ShipStation will actually print on the next
 * label ("ship_from") is your real fulfilment address, not the old demo
 * placeholder.
 *
 * WHY THIS EXISTS
 * The ship-from address is NOT re-typed at label-purchase time. It is baked
 * in once, when a shipping *rate* is fetched at checkout
 * (src/services/shipengine.service.ts -> getShipEngineRates -> ship_from).
 * `purchaseLabelFromRate()` later only needs a rateId — it does not take an
 * address at all. So the address that matters is whatever
 * `STORE_ORIGIN` (src/lib/shipping-config.ts) resolves to *right now*.
 *
 * `STORE_ORIGIN` reads from env vars first (STORE_STREET1, STORE_CITY,
 * STORE_STATE, STORE_POSTAL, STORE_COUNTRY, STORE_PHONE) and only falls back
 * to the hardcoded strings in the file if those env vars are unset. That
 * means there are two places this can silently be wrong:
 *   1. The hardcoded fallback strings in shipping-config.ts
 *   2. An old/stale STORE_* value sitting in .env.local / your host's env
 *      vars, quietly overriding whatever you edited in the file.
 *
 * This script resolves STORE_ORIGIN the exact same way the app does, flags
 * it if it still matches a known demo/placeholder value, and (if
 * SHIPSTATION_API_KEY is set) asks ShipStation's real address-validation API
 * to confirm the address is real and deliverable, then requests one live
 * rate quote to prove ShipStation accepts it as a ship_from address.
 *
 * Run with:
 *   node scripts/check-fulfillment-address.mjs
 *
 * Optional flags:
 *   --dest-zip=90012        ZIP to request a live test rate to (default 90012, LA)
 *   --dest-country=US       Country for the test destination (default US)
 *   --skip-live             Only do the static file/env check, skip ShipStation API calls
 */

import { config } from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const envLocal = resolve(process.cwd(), '.env.local');
if (existsSync(envLocal)) {
  config({ path: envLocal });
} else {
  config();
}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

// ─── Known demo/placeholder values seen in this repo's history ────────────
// (123 Diamond Way / New York / 10001 / 2125550100 was the original demo
// address; add to this list if you know of other placeholders you've used.)
const DEMO_SIGNATURES = [
  '123 diamond way',
  'new york, ny 10001',
  '2125550100',
  '(212) 555-0100',
  'alpha gemstone fulfilment', // old demo fullName, pre-dates the real company name
  'alpha imports fulfilment',
  'test address',
  'demo address',
  '123 main st',
  '123 main street',
];

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exitCode = 1;
}
function warn(msg) {
  console.warn(`⚠️  ${msg}`);
}
function ok(msg) {
  console.log(`✅ ${msg}`);
}

// ─── Step 1: resolve STORE_ORIGIN exactly the way shipping-config.ts does ──
const configPath = resolve(process.cwd(), 'src/lib/shipping-config.ts');
if (!existsSync(configPath)) {
  fail(`Could not find src/lib/shipping-config.ts at ${configPath}. Run this from the project root.`);
  process.exit(1);
}
const configSrc = readFileSync(configPath, 'utf8');

// Pull each `field: process.env.VAR ?? 'default'` (or a bare literal like
// fullName) straight out of the real file, so this script can't drift out
// of sync with however the file gets edited later.
function extractField(name) {
  const withEnv = new RegExp(`${name}:\\s*process\\.env\\.([A-Z0-9_]+)\\s*\\?\\?\\s*'([^']*)'`);
  const literal = new RegExp(`${name}:\\s*'([^']*)'`);
  const m1 = configSrc.match(withEnv);
  if (m1) {
    const [, envVar, fallback] = m1;
    return { envVar, fallback, resolved: process.env[envVar] ?? fallback, overridden: Boolean(process.env[envVar]) };
  }
  const m2 = configSrc.match(literal);
  if (m2) {
    return { envVar: null, fallback: m2[1], resolved: m2[1], overridden: false };
  }
  return null;
}

const fields = ['fullName', 'street1', 'city', 'state', 'postalCode', 'country', 'phone'];
const resolvedOrigin = {};
console.log('── Resolved STORE_ORIGIN (what the app will actually use) ──\n');
for (const f of fields) {
  const info = extractField(f);
  if (!info) {
    warn(`Could not find field "${f}" in shipping-config.ts — check the file wasn't restructured.`);
    continue;
  }
  resolvedOrigin[f] = info.resolved;
  const source = info.overridden ? `env:${info.envVar}` : info.envVar ? `file default (${info.envVar} not set)` : 'hardcoded literal';
  console.log(`  ${f.padEnd(11)} = ${JSON.stringify(info.resolved).padEnd(45)} [${source}]`);
}

console.log('\nFull address that will be sent as ship_from:');
console.log(
  `  ${resolvedOrigin.fullName}\n  ${resolvedOrigin.street1}\n  ${resolvedOrigin.city}, ${resolvedOrigin.state} ${resolvedOrigin.postalCode}, ${resolvedOrigin.country}\n  ${resolvedOrigin.phone}\n`
);

// ─── Step 2: flag demo/placeholder leftovers ───────────────────────────────
const haystack = Object.values(resolvedOrigin).join(' ').toLowerCase();
const hits = DEMO_SIGNATURES.filter((sig) => haystack.includes(sig));
if (hits.length > 0) {
  fail(`Resolved address still matches known demo/placeholder text: ${hits.join(', ')}`);
  fail('This is what will print on the next label. Fix shipping-config.ts and/or your .env.local STORE_* vars.');
} else {
  ok('Resolved address does not match any known demo/placeholder signature.');
}

// Sanity: nothing empty
const missing = fields.filter((f) => !resolvedOrigin[f]);
if (missing.length > 0) {
  fail(`These fields are empty: ${missing.join(', ')}`);
}

// ─── Step 3: warn about stale env overrides that don't match the file ─────
for (const f of fields) {
  const info = extractField(f);
  if (info?.overridden) {
    warn(
      `${f} is being overridden by env var ${info.envVar}="${process.env[info.envVar]}", ` +
      `NOT the value hardcoded in shipping-config.ts ("${info.fallback}"). ` +
      `If you only edited the .ts file and expected that to be the fix, this env var is what's actually winning.`
    );
  }
}

if (args['skip-live']) {
  console.log('\n--skip-live passed, skipping ShipStation API checks.');
  process.exit(process.exitCode ?? 0);
}

const apiKey = process.env.SHIPSTATION_API_KEY;
if (!apiKey) {
  warn('SHIPSTATION_API_KEY is not set — skipping live ShipStation validation and rate-quote checks.');
  warn('(Static file/env check above is still valid, but it cannot confirm ShipStation itself accepts this address.)');
  process.exit(process.exitCode ?? 0);
}

// ─── Step 4: ask ShipStation to validate the address for real ─────────────
const BASE = 'https://api.shipstation.com/v2';

async function ss(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'API-Key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new Error(`ShipStation ${path} failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

function toShipStationAddress(addr) {
  return {
    name: addr.fullName ?? '',
    phone: addr.phone ?? '',
    address_line1: addr.street1,
    city_locality: addr.city,
    state_province: addr.state,
    postal_code: addr.postalCode,
    country_code: (addr.country ?? 'US').toUpperCase(),
    address_residential_indicator: 'unknown',
  };
}

console.log('\n── Live ShipStation checks ──\n');

try {
  const [validation] = await ss('/addresses/validate', [toShipStationAddress(resolvedOrigin)]);
  console.log(`Address validation status: ${validation.status}`);
  if (validation.matched_address) {
    console.log('ShipStation-normalized match:', JSON.stringify(validation.matched_address, null, 2));
  }
  if (validation.messages?.length) {
    console.log('Messages:', validation.messages);
  }
  if (validation.status === 'verified') {
    ok('ShipStation confirms this is a real, deliverable address.');
  } else if (validation.status === 'warning') {
    warn('ShipStation validated this with warnings — double check the matched_address above is correct.');
  } else {
    fail(`ShipStation could not verify this address (status: ${validation.status}). It will likely fail or bounce at label-purchase time.`);
  }
} catch (err) {
  fail(`Address validation call failed: ${err.message}`);
}

// ─── Step 5: pull one live rate quote to prove ship_from is accepted ──────
const destZip = args['dest-zip'] || '90012';
const destCountry = args['dest-country'] || 'US';

try {
  const carriersRes = await fetch(`${BASE}/carriers`, { headers: { 'API-Key': apiKey, Accept: 'application/json' } });
  const carriersJson = await carriersRes.json();
  const carrierIds = (carriersJson.carriers ?? []).map((c) => c.carrier_id).filter(Boolean);

  if (carrierIds.length === 0) {
    warn('No carriers connected on this ShipStation account — cannot pull a live test rate.');
  } else {
    const rateResp = await ss('/rates', {
      shipment: {
        validate_address: 'no_validation',
        ship_from: toShipStationAddress(resolvedOrigin),
        ship_to: toShipStationAddress({
          fullName: 'Test Recipient',
          street1: '123 Test Recipient St',
          city: 'Los Angeles',
          state: 'CA',
          postalCode: destZip,
          country: destCountry,
          phone: '2135550100',
        }),
        packages: [{ weight: { value: 0.5, unit: 'pound' }, dimensions: { length: 6, width: 4, height: 2, unit: 'inch' } }],
      },
      rate_options: { carrier_ids: carrierIds },
    });

    const rates = rateResp.rate_response?.rates ?? rateResp.rates ?? [];
    const usable = rates.filter((r) => r.rate_type === 'shipment' && (!r.error_messages || r.error_messages.length === 0));

    if (usable.length > 0) {
      ok(`ShipStation accepted the resolved address as ship_from and returned ${usable.length} live rate(s).`);
      console.log(`Example: ${usable[0].carrier_friendly_name ?? usable[0].carrier_id} ${usable[0].service_type ?? ''} — $${usable[0].shipping_amount?.amount}`);
      console.log('\nThe next label purchased through checkout/admin will print the address shown above.');
    } else {
      fail('ShipStation returned no usable rates for this ship_from — the address may be rejected at label-purchase time.');
      console.log(JSON.stringify(rateResp, null, 2));
    }
  }
} catch (err) {
  fail(`Live rate-quote call failed: ${err.message}`);
}

process.exit(process.exitCode ?? 0);
