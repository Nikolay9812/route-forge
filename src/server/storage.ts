// Files in the private Cloudflare R2 bucket (document photos), over R2's S3 API with `aws4fetch`. Server only: the
// R2 keys never reach the app, which gets short-lived presigned URLs instead. Nothing here logs keys or URLs, since
// both point at personal data. No `@/` imports, so Node scripts (the seed, the checks) can use it too.
import { AwsClient } from "aws4fetch";

const UPLOAD_SECONDS = 5 * 60;
const VIEW_SECONDS = 60 * 60;

let client: AwsClient | undefined;

function env() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT;
  const bucket = process.env.R2_BUCKET;
  if (!accessKeyId || !secretAccessKey || !endpoint || !bucket) {
    throw new Error("R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT and R2_BUCKET must be set.");
  }
  client ??= new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
  return { client, bucketUrl: `${endpoint.replace(/\/$/, "")}/${bucket}` };
}

function objectUrl(key: string): URL {
  return new URL(`${env().bucketUrl}/${key.split("/").map(encodeURIComponent).join("/")}`);
}

async function presign(method: "GET" | "PUT", key: string, seconds: number, headers?: Record<string, string>) {
  const url = objectUrl(key);
  url.searchParams.set("X-Amz-Expires", String(seconds));
  // `allHeaders` signs the Content-Type too, so R2 refuses an upload of any other type.
  const signed = await env().client.sign(url, { method, headers, aws: { signQuery: true, allHeaders: true } });
  return signed.url;
}

/** A URL the app can PUT exactly one file of this type to, for 5 minutes. */
export function presignPut(key: string, contentType: string): Promise<string> {
  return presign("PUT", key, UPLOAD_SECONDS, { "Content-Type": contentType });
}

/** A URL that shows the file for an hour. */
export function presignGet(key: string): Promise<string> {
  return presign("GET", key, VIEW_SECONDS);
}

/** The stored file's size and type, or null when there is no such file. */
export async function headObject(key: string): Promise<{ size: number; contentType: string | null } | null> {
  const response = await env().client.fetch(objectUrl(key), { method: "HEAD" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`R2 HEAD failed: ${response.status}`);
  return { size: Number(response.headers.get("content-length") ?? 0), contentType: response.headers.get("content-type") };
}

/** Deletes the file; deleting one that isn't there is fine. */
export async function deleteObject(key: string): Promise<void> {
  const response = await env().client.fetch(objectUrl(key), { method: "DELETE" });
  if (!response.ok && response.status !== 404) throw new Error(`R2 DELETE failed: ${response.status}`);
}

/** Every key under a prefix (ListObjectsV2, page by page). */
export async function listKeys(prefix: string): Promise<string[]> {
  const { client, bucketUrl } = env();
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const url = new URL(bucketUrl);
    url.searchParams.set("list-type", "2");
    url.searchParams.set("prefix", prefix);
    if (token) url.searchParams.set("continuation-token", token);
    const response = await client.fetch(url);
    if (!response.ok) throw new Error(`R2 list failed: ${response.status}`);
    const xml = await response.text();
    for (const match of xml.matchAll(/<Key>([^<]*)<\/Key>/g)) keys.push(unescapeXml(match[1]));
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
      ? unescapeXml(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/.exec(xml)?.[1] ?? "")
      : undefined;
  } while (token);
  return keys;
}

/** Deletes every file under a prefix (the seed's clean start). */
export async function deletePrefix(prefix: string): Promise<number> {
  const keys = await listKeys(prefix);
  for (const key of keys) await deleteObject(key);
  return keys.length;
}

function unescapeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
