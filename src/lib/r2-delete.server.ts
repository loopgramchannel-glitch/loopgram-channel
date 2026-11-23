// Server-only: deletes owner uploads from the R2 bucket (only keys under media/).
import { isDeletableKey } from "./upload-keys";

export async function deleteR2Keys(keys: string[]): Promise<{ deleted: string[]; failed: string[] }> {
  const need = ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ENDPOINT", "R2_BUCKET_NAME"];
  if (need.some((k) => !process.env[k])) throw new Error("503: Media bucket isn't set up.");
  const { AwsClient } = await import("aws4fetch");
  const client = new AwsClient({ accessKeyId: process.env["R2_ACCESS_KEY_ID"]!, secretAccessKey: process.env["R2_SECRET_ACCESS_KEY"]!, service: "s3", region: "auto" });
  const bucketUrl = `${process.env["R2_ENDPOINT"]!.replace(/\/$/, "")}/${process.env["R2_BUCKET_NAME"]}`;
  const enc = (k: string) => k.split("/").map(encodeURIComponent).join("/");
  const { redis } = await import("./backend.server");
  const deleted: string[] = [], failed: string[] = [];
  const list = [...new Set(keys)].filter(isDeletableKey);
  for (let i = 0; i < list.length; i += 8) {
    await Promise.all(list.slice(i, i + 8).map(async (key) => {
      try {
        const r = await client.fetch(`${bucketUrl}/${enc(key)}`, { method: "DELETE", signal: AbortSignal.timeout(8000) });
        if (r.ok || r.status === 404) {
          deleted.push(key);
          const stem = key.replace(/(\/index\.m3u8|\.mp4)$/, "");
          await redis(["DEL", `stream:v1:${stem}`]).catch(() => null);
        } else failed.push(key);
      } catch { failed.push(key); }
    }));
  }
  if (deleted.length) await redis(["DEL", "uploads:ids:v1"]).catch(() => null);
  return { deleted, failed };
}
