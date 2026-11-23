/** Vertical swipe between Shorts (TikTok style). Pure so it can be tested.
 *  Swipe up = next video, swipe down = previous. Short or mostly sideways moves count as taps. */
export const SWIPE_MIN_PX = 50;
/** A slow drag must cover this share of the screen height to change video. */
export const SWIPE_SCREEN_SHARE = 0.15;
/** A quick flick (px per ms) changes video even when it is short. */
export const FLICK_SPEED = 0.5;
export const FLICK_MIN_PX = 20;
/** Pulling past the first/last Short only moves this much of the finger distance. */
export const EDGE_RESISTANCE = 0.3;

export function swipeStep(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dy) < SWIPE_MIN_PX || Math.abs(dy) <= Math.abs(dx)) return 0;
  return dy < 0 ? 1 : -1;
}

/** Decide on finger release: go to next (1), previous (-1) or spring back (0). */
export function releaseStep(dx: number, dy: number, ms: number, height: number): -1 | 0 | 1 {
  const ady = Math.abs(dy);
  if (ady <= Math.abs(dx)) return 0;
  const far = ady >= Math.max(SWIPE_MIN_PX, height * SWIPE_SCREEN_SHARE);
  const flick = ady >= FLICK_MIN_PX && ady / Math.max(ms, 1) >= FLICK_SPEED;
  if (!far && !flick) return 0;
  return dy < 0 ? 1 : -1;
}

/** How far the reel follows the finger; it drags heavily when there is nothing more in that direction. */
export function dragOffset(dy: number, canPrev: boolean, canNext: boolean): number {
  if ((dy > 0 && !canPrev) || (dy < 0 && !canNext)) return dy * EDGE_RESISTANCE;
  return dy;
}
