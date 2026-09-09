import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import lzwCompress from "./lzwcompress.js";

describe("lzwCompress", () => {
  afterEach(() => {
    lzwCompress.enableLogging(false);
  });

  describe("pack/unpack round-trip", () => {
    it("compresses and decompresses a simple object", () => {
      const obj = { name: "John", age: 30 };
      const packed = lzwCompress.pack(obj);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
    });

    it("compresses and decompresses a nested object", () => {
      const obj = {
        name: "John",
        address: { city: "NYC", zip: "10001" },
        tags: ["a", "b", "c"],
      };
      const packed = lzwCompress.pack(obj);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
    });

    it("compresses and decompresses an array of objects", () => {
      const obj = [
        { question: "What is 2+2?", answer: "4" },
        { question: "What is 3+3?", answer: "6" },
      ];
      const packed = lzwCompress.pack(obj);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
    });

    it("compresses and decompresses repeated-key objects (key optimization benefit)", () => {
      const obj = {
        items: [
          { question: "Q1", answer: "A1", score: 1 },
          { question: "Q2", answer: "A2", score: 2 },
          { question: "Q3", answer: "A3", score: 3 },
        ],
      };
      const packed = lzwCompress.pack(obj);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
    });

    it("compresses and decompresses a plain string", () => {
      const str = "Hello, world! This is a test string with repeated words words words.";
      const packed = lzwCompress.pack(str);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toBe(str);
    });

    it("handles empty string", () => {
      const packed = lzwCompress.pack("");
      // Falsy value short-circuits and returns as-is
      expect(packed).toBe("");
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toBe("");
    });

    it("handles empty object", () => {
      const obj = {};
      const packed = lzwCompress.pack(obj);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
    });

    it("handles empty array", () => {
      const obj = [];
      const packed = lzwCompress.pack(obj);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
    });
  });

  describe("pack edge cases", () => {
    it("returns falsy values unchanged", () => {
      expect(lzwCompress.pack(null)).toBeNull();
      expect(lzwCompress.pack(undefined)).toBeUndefined();
      expect(lzwCompress.pack(0)).toBe(0);
      expect(lzwCompress.pack("")).toBe("");
      expect(lzwCompress.pack(false)).toBe(false);
    });

    it("returns true unchanged", () => {
      expect(lzwCompress.pack(true)).toBe(true);
    });

    it("returns Date instances unchanged", () => {
      const date = new Date();
      expect(lzwCompress.pack(date)).toBe(date);
    });

    it("compresses numbers as non-object values via LZW pack passthrough", () => {
      // typeof 5 !== 'object', so KeyOptimize is skipped;
      // LZWCompress.pack only handles strings, otherwise returns input unchanged.
      const result = lzwCompress.pack(5);
      expect(result).toBe(5);
    });
  });

  describe("unpack edge cases", () => {
    it("returns falsy values unchanged", () => {
      expect(lzwCompress.unpack(null)).toBeNull();
      expect(lzwCompress.unpack(undefined)).toBeUndefined();
      expect(lzwCompress.unpack(0)).toBe(0);
      expect(lzwCompress.unpack("")).toBe("");
      expect(lzwCompress.unpack(false)).toBe(false);
    });

    it("returns true unchanged", () => {
      expect(lzwCompress.unpack(true)).toBe(true);
    });

    it("returns Date instances unchanged", () => {
      const date = new Date();
      expect(lzwCompress.unpack(date)).toBe(date);
    });

    it("returns non-array input unchanged when unpacking garbage", () => {
      // LZWCompress.unpack requires an array; a plain object bypasses it and
      // returns the object itself, which then fails JSON.parse and is returned.
      const garbage = { foo: "bar" };
      const result = lzwCompress.unpack(garbage);
      expect(result).toEqual(garbage);
    });

    it("returns string unchanged if not valid compressed array", () => {
      const result = lzwCompress.unpack("not an array");
      expect(result).toBe("not an array");
    });
  });

  describe("LZWCompress internal behavior via pack/unpack of strings", () => {
    it("round-trips a long repeated string well", () => {
      const str = "abcabcabcabcabcabcabcabcabcabcabcabcabc";
      const packed = lzwCompress.pack(str);
      expect(Array.isArray(packed)).toBe(true);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toBe(str);
    });

    it("round-trips single character string", () => {
      const str = "a";
      const packed = lzwCompress.pack(str);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toBe(str);
    });

    it("round-trips strings with unicode characters", () => {
      const str = "héllo wörld ünïcödé";
      const packed = lzwCompress.pack(str);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toBe(str);
    });
  });

  describe("enableLogging", () => {
    it("does not throw when logging is enabled during pack/unpack", () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      lzwCompress.enableLogging(true);
      const obj = { hello: "world" };
      const packed = lzwCompress.pack(obj);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it("disables logging correctly", () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      lzwCompress.enableLogging(false);
      lzwCompress.pack({ a: 1 });
      expect(logSpy).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });

  describe("large realistic SCORM-like payload", () => {
    it("round-trips a moderately large object with many repeated keys", () => {
      const items = [];
      for (let i = 0; i < 50; i++) {
        items.push({
          id: i,
          question: `Question number ${i}`,
          answers: ["Option A", "Option B", "Option C", "Option D"],
          correctAnswer: "Option A",
          metadata: { difficulty: "medium", category: "general" },
        });
      }
      const obj = { items, total: items.length };

      const packed = lzwCompress.pack(obj);
      expect(typeof packed).not.toBe("undefined");
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
    });
  });

  describe("module shape", () => {
    it("exposes pack, unpack, enableLogging functions", () => {
      expect(typeof lzwCompress.pack).toBe("function");
      expect(typeof lzwCompress.unpack).toBe("function");
      expect(typeof lzwCompress.enableLogging).toBe("function");
    });
  });
});