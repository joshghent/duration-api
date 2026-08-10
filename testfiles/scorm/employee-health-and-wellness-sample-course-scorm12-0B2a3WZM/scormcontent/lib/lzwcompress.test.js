import { describe, it, expect, beforeEach } from "vitest";
import lzwCompress from "./lzwcompress.js";

describe("lzwCompress", () => {
  beforeEach(() => {
    lzwCompress.enableLogging(false);
  });

  describe("pack/unpack round trips", () => {
    it("round trips a simple object", () => {
      const obj = { a: 1, b: "hello", c: true };
      const packed = lzwCompress.pack(obj);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
    });

    it("round trips a nested object", () => {
      const obj = {
        name: "John Doe",
        age: 30,
        address: {
          street: "123 Main St",
          city: "Anytown",
          zip: "12345"
        },
        tags: ["admin", "user"]
      };
      const packed = lzwCompress.pack(obj);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
    });

    it("round trips an array of objects", () => {
      const obj = [
        { question: "What is 2+2?", answer: "4" },
        { question: "What is the capital of France?", answer: "Paris" }
      ];
      const packed = lzwCompress.pack(obj);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
    });

    it("round trips a plain string", () => {
      const str = "The quick brown fox jumps over the lazy dog";
      const packed = lzwCompress.pack(str);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toBe(str);
    });

    it("round trips an empty object", () => {
      const obj = {};
      const packed = lzwCompress.pack(obj);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
    });

    it("round trips an object with repeated keys/values for compression benefit", () => {
      const obj = {
        item1: { status: "complete", status2: "complete", status3: "complete" },
        item2: { status: "complete", status2: "complete", status3: "complete" },
        item3: { status: "complete", status2: "complete", status3: "complete" }
      };
      const packed = lzwCompress.pack(obj);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
    });

    it("round trips numeric values inside objects", () => {
      const obj = { score: 95.5, attempts: 3, passed: true };
      const packed = lzwCompress.pack(obj);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
    });

    it("round trips deeply nested structures", () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              level4: "deep value",
              array: [1, 2, 3, { nested: true }]
            }
          }
        }
      };
      const packed = lzwCompress.pack(obj);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
    });
  });

  describe("pack", () => {
    it("returns falsy values unchanged", () => {
      expect(lzwCompress.pack(null)).toBeNull();
      expect(lzwCompress.pack(undefined)).toBeUndefined();
      expect(lzwCompress.pack(0)).toBe(0);
      expect(lzwCompress.pack("")).toBe("");
    });

    it("returns boolean true unchanged", () => {
      expect(lzwCompress.pack(true)).toBe(true);
    });

    it("returns Date instances unchanged", () => {
      const date = new Date();
      expect(lzwCompress.pack(date)).toBe(date);
    });

    it("compresses a string into an array of numbers", () => {
      const result = lzwCompress.pack("aaaaaaaaaaaaaaaaaaaa");
      expect(Array.isArray(result)).toBe(true);
      result.forEach((n) => expect(typeof n).toBe("number"));
    });

    it("compresses an object into an array (via JSON + key optimize)", () => {
      const result = lzwCompress.pack({ foo: "bar" });
      expect(Array.isArray(result)).toBe(true);
    });

    it("produces shorter or comparable output for repetitive strings", () => {
      const repetitive = "abcabcabcabcabcabcabcabcabcabcabcabc";
      const compressed = lzwCompress.pack(repetitive);
      expect(Array.isArray(compressed)).toBe(true);
      expect(compressed.length).toBeLessThan(repetitive.length);
    });
  });

  describe("unpack", () => {
    it("returns falsy values unchanged", () => {
      expect(lzwCompress.unpack(null)).toBeNull();
      expect(lzwCompress.unpack(undefined)).toBeUndefined();
      expect(lzwCompress.unpack(0)).toBe(0);
      expect(lzwCompress.unpack("")).toBe("");
    });

    it("returns boolean true unchanged", () => {
      expect(lzwCompress.unpack(true)).toBe(true);
    });

    it("returns Date instances unchanged", () => {
      const date = new Date();
      expect(lzwCompress.unpack(date)).toBe(date);
    });

    it("returns non-array compressed input unchanged when LZW unpack passes through", () => {
      // A plain string (not an array) is returned unchanged by LZWCompress.unpack
      const result = lzwCompress.unpack("not-an-array");
      expect(result).toBe("not-an-array");
    });

    it("returns the raw decompressed string when it is not valid JSON", () => {
      const packed = lzwCompress.pack("just a plain string, not JSON");
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toBe("just a plain string, not JSON");
    });
  });

  describe("enableLogging", () => {
    it("does not throw when logging is enabled and pack/unpack are called", () => {
      lzwCompress.enableLogging(true);
      expect(() => {
        const packed = lzwCompress.pack({ a: 1 });
        lzwCompress.unpack(packed);
      }).not.toThrow();
      lzwCompress.enableLogging(false);
    });

    it("can be toggled off again", () => {
      lzwCompress.enableLogging(true);
      lzwCompress.enableLogging(false);
      expect(() => lzwCompress.pack({ b: 2 })).not.toThrow();
    });
  });

  describe("edge cases", () => {
    it("handles single character strings", () => {
      const packed = lzwCompress.pack("a");
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toBe("a");
    });

    it("handles strings with special/unicode characters", () => {
      const str = "Héllo Wörld! 日本語 😀";
      const packed = lzwCompress.pack(str);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toBe(str);
    });

    it("handles arrays as top-level input", () => {
      const arr = [1, 2, 3, "four", { five: 5 }];
      const packed = lzwCompress.pack(arr);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(arr);
    });

    it("handles objects with array values", () => {
      const obj = { list: [1, 2, 3], nested: { list2: ["a", "b"] } };
      const packed = lzwCompress.pack(obj);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
    });

    it("handles objects with null values", () => {
      const obj = { a: null, b: "value" };
      const packed = lzwCompress.pack(obj);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
    });

    it("handles long realistic SCORM-like cmi data object", () => {
      const cmiData = {
        cmi: {
          core: {
            student_id: "12345",
            student_name: "Doe, John",
            lesson_location: "",
            credit: "credit",
            lesson_status: "incomplete",
            entry: "ab-initio",
            score: { raw: "", min: "", max: "100" },
            total_time: "0000:00:00.00",
            lesson_mode: "normal",
            exit: "",
            session_time: "0000:00:00"
          },
          suspend_data: "",
          launch_data: "",
          comments: "",
          objectives: [
            { id: "obj1", score: { raw: 80 }, status: "completed" },
            { id: "obj2", score: { raw: 90 }, status: "completed" }
          ]
        }
      };
      const packed = lzwCompress.pack(cmiData);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(cmiData);
    });
  });

  describe("LZWCompress internals via pack/unpack of plain strings", () => {
    it("compress returns the original uncompressed value for non-string input", () => {
      // pack() on a number (non-object, non-string) returns straight through LZWCompress.pack
      const result = lzwCompress.pack(42);
      expect(result).toBe(42);
    });

    it("decompress on a non-array returns unchanged (covered by unpack fallback)", () => {
      const result = lzwCompress.unpack(42);
      expect(result).toBe(42);
    });
  });
});