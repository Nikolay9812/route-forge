// Makes a member an owner of a firm, or makes an owner a courier again (prompts/27): the app never changes owners.
// Writes the `firm_members` row and mirrors it in Clerk (`org:admin` for owners, `org:member` for everyone else).
// Refuses to remove a firm's last owner. Uses the Clerk instance and Neon branch the environment points at (.env.local
// by default; for production, run it under the production env like db:push:prod).
//   npm run role:owner -- <email> "<firm name>" add|remove
import { neon } from "@neondatabase/serverless";

const { CLERK_SECRET_KEY, DATABASE_URL } = process.env;
if (!CLERK_SECRET_KEY || !DATABASE_URL) throw new Error("CLERK_SECRET_KEY and DATABASE_URL must be set.");

const [email, firmName, action] = process.argv.slice(2);
if (!email || !firmName || !["add", "remove"].includes(action)) {
  console.error('Usage: npm run role:owner -- <email> "<firm name>" add|remove');
  process.exit(2);
}

const sql = neon(DATABASE_URL);

async function clerk(path, method = "GET", body) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Clerk ${method} ${path}: ${res.status}`);
  return res.json();
}

const { data: orgs } = await clerk(`/organizations?query=${encodeURIComponent(firmName)}&limit=10`);
const firm = orgs.find((o) => o.name === firmName);
if (!firm) throw new Error(`No Clerk organization named "${firmName}".`);
const [user] = await clerk(`/users?email_address=${encodeURIComponent(email.trim().toLowerCase())}`);
if (!user) throw new Error(`No Clerk user ${email}.`);
const { data: memberships } = await clerk(`/organizations/${firm.id}/memberships?user_id=${user.id}`);
if (memberships.length === 0) throw new Error(`${email} isn't a member of ${firmName}: invite them first.`);

if (action === "remove") {
  const owners = await sql`select user_id from firm_members where firm_id = ${firm.id} and role = 'owner'`;
  if (!owners.some((o) => o.user_id === user.id)) throw new Error(`${email} isn't an owner of ${firmName}.`);
  if (owners.length === 1) throw new Error(`${email} is ${firmName}'s last owner: add another owner first.`);
}

const role = action === "add" ? "owner" : "courier";
await sql`
  insert into firm_members (firm_id, user_id, role, set_by) values (${firm.id}, ${user.id}, ${role}, 'script')
  on conflict (firm_id, user_id) do update set role = excluded.role, set_by = excluded.set_by, updated_at = now()`;
await sql`delete from dispatcher_depots where firm_id = ${firm.id} and user_id = ${user.id}`;
await clerk(`/organizations/${firm.id}/memberships/${user.id}`, "PATCH", { role: action === "add" ? "org:admin" : "org:member" });
console.log(`${email} is now ${role === "owner" ? "an owner" : "a courier"} of ${firmName}.`);
