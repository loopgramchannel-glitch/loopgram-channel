// Live presence rules (pure, shared by server + tests). Signed-in users ping every PING_MS;
// anyone seen within ONLINE_MS counts as online.
export const PING_MS = 45_000;
export const ONLINE_MS = 90_000;
export const PRESENCE_KEY = "lg:online";
export function onlineCutoff(now: number) { return now - ONLINE_MS; }
export function isOnline(lastSeen: number | null | undefined, now: number) { return !!lastSeen && lastSeen > onlineCutoff(now); }
/** Owner and other protected accounts can never be deleted. */
export function canDelete(uid: string, me: string, ownerUid: string | undefined) { return uid !== me && uid !== ownerUid; }
