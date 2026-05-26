import { describe, expect, it } from "vitest";
import { colorCountry } from "./color-country.js";

describe("colorCountry", () => {
  it("wraps country code in cyan ANSI when color enabled", () => {
    expect(colorCountry("US")).toBe("\x1b[36mUS\x1b[0m");
    expect(colorCountry("JP")).toBe("\x1b[36mJP\x1b[0m");
  });

  it("returns plain text when noColor is true", () => {
    expect(colorCountry("US", true)).toBe("US");
    expect(colorCountry("JP", true)).toBe("JP");
  });

  it("returns dash for null/undefined", () => {
    expect(colorCountry(null)).toBe("—");
    expect(colorCountry(undefined)).toBe("—");
  });
});
