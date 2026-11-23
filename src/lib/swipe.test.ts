import { describe, expect, it } from "vitest";
import { dragOffset, releaseStep, swipeStep } from "./swipe";

describe("swipeStep", () => {
  it("swipe up moves to the next video", () => expect(swipeStep(0, -80)).toBe(1));
  it("swipe down moves to the previous video", () => expect(swipeStep(5, 80)).toBe(-1));
  it("a small move under 50px stays a tap", () => expect(swipeStep(0, -40)).toBe(0));
  it("a mostly sideways move does not change video", () => expect(swipeStep(120, -60)).toBe(0));
});

describe("releaseStep", () => {
  it("a slow drag past 15% of the screen goes to the next video", () => expect(releaseStep(0, -100, 800, 600)).toBe(1));
  it("a slow short drag springs back", () => expect(releaseStep(0, -60, 800, 600)).toBe(0));
  it("a quick short flick down goes to the previous video", () => expect(releaseStep(0, 40, 60, 600)).toBe(-1));
  it("a tiny quick twitch under 20px springs back", () => expect(releaseStep(0, -15, 10, 600)).toBe(0));
  it("a sideways move never changes video", () => expect(releaseStep(200, -150, 100, 600)).toBe(0));
});

describe("dragOffset", () => {
  it("follows the finger 1:1 when there is a video that way", () => expect(dragOffset(-100, true, true)).toBe(-100));
  it("pulling down on the first video only moves 30%", () => expect(dragOffset(100, false, true)).toBe(30));
  it("pulling up on the last video only moves 30%", () => expect(dragOffset(-100, true, false)).toBe(-30));
});
