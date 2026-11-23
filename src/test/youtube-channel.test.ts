import { describe, expect, it } from "vitest";
import { channelQuery, isWideVideo, isoSeconds, longVideosPlaylist, ytPostId } from "@/lib/youtube-channel";

describe("youtube channel import", () => {
  it("reads handles and channel ids", () => {
    expect(channelQuery("https://www.youtube.com/@MrBeast")).toEqual({ forHandle: "@MrBeast" });
    expect(channelQuery("@MrBeast")).toEqual({ forHandle: "@MrBeast" });
    expect(channelQuery("https://youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA")).toEqual({ id: "UCX6OQ3DkcsbYNE6H8uQQuVA" });
  });
  it("uses the long-videos playlist", () => expect(longVideosPlaylist("UCX6OQ3DkcsbYNE6H8uQQuVA")).toBe("UULFX6OQ3DkcsbYNE6H8uQQuVA"));
  it("keeps case-different ids apart", () => expect(ytPostId("abcDEF12345")).not.toBe(ytPostId("ABCdef12345")));
  it("leaves out videos of 3 minutes or less", () => {
    expect(isWideVideo(isoSeconds("PT3M"))).toBe(false);
    expect(isWideVideo(isoSeconds("PT3M1S"))).toBe(true);
    expect(isoSeconds("PT1H2M3S")).toBe(3723);
  });
});
