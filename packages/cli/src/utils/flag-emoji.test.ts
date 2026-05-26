import { describe, expect, it } from "vitest";
import { flagEmoji } from "./flag-emoji.js";

describe("flagEmoji", () => {
  it("converts valid country code to flag emoji", () => {
    expect(flagEmoji("US")).toBe("🇺🇸");
    expect(flagEmoji("JP")).toBe("🇯🇵");
    expect(flagEmoji("CN")).toBe("🇨🇳");
  });

  it("handles lowercase input", () => {
    expect(flagEmoji("us")).toBe("🇺🇸");
    expect(flagEmoji("jp")).toBe("🇯🇵");
  });

  it("returns globe for null/undefined", () => {
    expect(flagEmoji(null)).toBe("🌐");
    expect(flagEmoji(undefined)).toBe("🌐");
  });

  it("returns globe for single char", () => {
    expect(flagEmoji("U")).toBe("🌐");
  });

  it("returns globe for empty string", () => {
    expect(flagEmoji("")).toBe("🌐");
  });

  it("returns globe for three-char code", () => {
    expect(flagEmoji("USA")).toBe("🌐");
  });
});
