import { describe, expect, it } from "vitest";
import { colorCountry, colorCountryPad } from "./color-country.js";

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

describe("colorCountryPad", () => {
  it("pads based on visible width, not ANSI length", () => {
    const result = colorCountryPad("US", 10);
    expect(result).toBe("\x1b[36mUS\x1b[0m        ");
    const visibleLen = result.replaceAll("\x1b[36m", "").replaceAll("\x1b[0m", "").length;
    expect(visibleLen).toBe(10);
  });

  it("returns plain padded text when noColor is true", () => {
    expect(colorCountryPad("US", 10, true)).toBe("US        ");
  });

  it("returns padded dash for null/undefined", () => {
    expect(colorCountryPad(null, 10)).toBe("—         ");
    expect(colorCountryPad(undefined, 10)).toBe("—         ");
  });

  it("does not add negative padding for long text", () => {
    const result = colorCountryPad("LONGCOUNTRY", 5);
    expect(result).toBe("\x1b[36mLONGCOUNTRY\x1b[0m");
  });
});
