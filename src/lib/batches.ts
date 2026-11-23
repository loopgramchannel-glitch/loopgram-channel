// Splits a big selection into small groups so one bulk delete never overloads a single server call.
export const POST_DELETE_BATCH = 20;
export const MEDIA_DELETE_BATCH = 50;

export function chunk<T>(items: T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}
