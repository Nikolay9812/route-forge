// Sets the bucket's lifecycle rules: `pending/` (uploads the app never confirmed) is emptied after one day, and
// vehicle check photos under `shifts/` after `SHIFT_PHOTO_DAYS`. Other rules on the bucket are kept. Uses the
// Cloudflare API with CLOUDFLARE_API_TOKEN, for local use only.
// Run with `npm run r2:lifecycle` (the bucket in R2_BUCKET of .env.local, or of the env file you pass).
import { SHIFT_PHOTO_DAYS, SHIFT_PHOTO_ROOT } from "../src/domain/photos.ts";

const { CLOUDFLARE_API_TOKEN, R2_ACCOUNT_ID, R2_BUCKET } = process.env;
if (!CLOUDFLARE_API_TOKEN || !R2_ACCOUNT_ID || !R2_BUCKET) {
  throw new Error("CLOUDFLARE_API_TOKEN, R2_ACCOUNT_ID and R2_BUCKET must be set.");
}

const url = `https://api.cloudflare.com/client/v4/accounts/${R2_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/lifecycle`;
const headers = { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" };

const DAY = 24 * 60 * 60;
const ours = [
  {
    id: "delete-pending-uploads",
    enabled: true,
    conditions: { prefix: "pending/" },
    deleteObjectsTransition: { condition: { type: "Age", maxAge: DAY } },
  },
  {
    id: "delete-shift-photos",
    enabled: true,
    conditions: { prefix: SHIFT_PHOTO_ROOT },
    deleteObjectsTransition: { condition: { type: "Age", maxAge: SHIFT_PHOTO_DAYS * DAY } },
  },
];

const current = await fetch(url, { headers });
if (!current.ok) throw new Error(`Reading the lifecycle rules failed: ${current.status}`);
const ids = new Set(ours.map((r) => r.id));
const rules = ((await current.json()).result?.rules ?? []).filter((r) => !ids.has(r.id));

const saved = await fetch(url, { method: "PUT", headers, body: JSON.stringify({ rules: [...rules, ...ours] }) });
if (!saved.ok) throw new Error(`Saving the lifecycle rules failed: ${saved.status} ${await saved.text()}`);
console.log(
  `${R2_BUCKET}: pending/ uploads are deleted after one day, ${SHIFT_PHOTO_ROOT} after ${SHIFT_PHOTO_DAYS} days ` +
    `(${rules.length} other rule(s) kept).`,
);
