import { describe, expect, it } from "vitest";

import {
  digitsFromSeconds,
  displayFromDigits,
  secondsFromDigits,
  TIMECODE_BUFFER_SIZE,
} from "@/lib/utils";

describe("timecode-buffer", () => {
  it("TIMECODE_BUFFER_SIZE is 6 (HHMMSS)", () => {
    expect(TIMECODE_BUFFER_SIZE).toBe(6);
  });

  describe("digitsFromSeconds", () => {
    it("returns '000000' for zero", () => {
      expect(digitsFromSeconds(0)).toBe("000000");
    });

    it("encodes hours/minutes/seconds positions independently", () => {
      expect(digitsFromSeconds(1)).toBe("000001");
      expect(digitsFromSeconds(60)).toBe("000100");
      expect(digitsFromSeconds(3600)).toBe("010000");
      expect(digitsFromSeconds(3661)).toBe("010101");
    });

    it("clamps negative input to zero", () => {
      expect(digitsFromSeconds(-5)).toBe("000000");
    });

    it("floors fractional seconds", () => {
      expect(digitsFromSeconds(1.9)).toBe("000001");
    });

    it("keeps the last two digits when hours exceed 99", () => {
      // 100h:00:00 → '00' (last 2 digits of '100') + '00' + '00'
      expect(digitsFromSeconds(100 * 3600)).toBe("000000");
      expect(digitsFromSeconds(101 * 3600 + 1)).toBe("010001");
    });
  });

  describe("secondsFromDigits", () => {
    it("returns 0 for empty buffer", () => {
      expect(secondsFromDigits("")).toBe(0);
    });

    it("decodes 6-digit buffers", () => {
      expect(secondsFromDigits("000001")).toBe(1);
      expect(secondsFromDigits("010101")).toBe(3661);
      expect(secondsFromDigits("012545")).toBe(1 * 3600 + 25 * 60 + 45);
    });

    it("right-aligns shorter buffers (pad-left with zeros)", () => {
      expect(secondsFromDigits("1")).toBe(1);
      expect(secondsFromDigits("125")).toBe(1 * 60 + 25);
    });

    it("uses only the last 6 digits when buffer is longer", () => {
      expect(secondsFromDigits("12345678")).toBe(34 * 3600 + 56 * 60 + 78);
    });

    it("permits invalid clock values (mm/ss > 59) — caller normalizes", () => {
      // "00:00:99" is a valid mid-typing buffer state; seconds = 99
      expect(secondsFromDigits("000099")).toBe(99);
      // "00:99:99" → 99*60 + 99 = 6039
      expect(secondsFromDigits("009999")).toBe(99 * 60 + 99);
    });
  });

  describe("displayFromDigits", () => {
    it("formats as HH:MM:SS with zero padding", () => {
      expect(displayFromDigits("")).toBe("00:00:00");
      expect(displayFromDigits("1")).toBe("00:00:01");
      expect(displayFromDigits("125")).toBe("00:01:25");
      expect(displayFromDigits("012545")).toBe("01:25:45");
    });

    it("uses only the last 6 digits when buffer is longer", () => {
      expect(displayFromDigits("12345678")).toBe("34:56:78");
    });
  });
});
