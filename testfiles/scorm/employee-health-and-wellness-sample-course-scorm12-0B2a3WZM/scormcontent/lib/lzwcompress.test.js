import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import lzwCompress from "./lzwcompress.js";

describe("lzwCompress", () => {
  afterEach(() => {
    lzwCompress.enableLogging(false);
  });

  // ---------------------------------------------------------------------
  // Round trip tests for pack/unpack
  // ---------------------------------------------------------------------

  describe("pack/unpack round trip", () => {
    it("round trips a simple object", () => {
      const obj = { name: "John", age: 30 };
      const packed = lzwCompress.pack(obj);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
    });

    it("round trips a nested object", () => {
      const obj = {
        name: "Jane",
        address: {
          street: "123 Main St",
          city: "Anytown",
          zip: "12345",
        },
        hobbies: ["reading", "hiking", "coding"],
      };
      const packed = lzwCompress.pack(obj);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
    });

    it("round trips an array of objects", () => {
      const obj = [
        { id: 1, value: "a" },
        { id: 2, value: "b" },
        { id: 3, value: "c" },
      ];
      const packed = lzwCompress.pack(obj);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
    });

    it("round trips an object with repeated keys (typical LMS data)", () => {
      const obj = {
        cmi: {
          core: {
            student_id: "12345",
            student_name: "Doe, John",
            lesson_location: "",
            credit: "credit",
            lesson_status: "incomplete",
            entry: "ab-initio",
            score: { raw: "", min: "", max: "" },
          },
          suspend_data: "",
          launch_data: "",
          comments: "",
        },
      };
      const packed = lzwCompress.pack(obj);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
    });

    it("round trips a large repetitive string within an object", () => {
      const obj = { data: "abcabcabcabcabcabcabcabcabcabcabcabcabcabc" };
      const packed = lzwCompress.pack(obj);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
    });

    it("compresses repetitive data smaller than JSON string when serialized", () => {
      const obj = { value: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" };
      const jsonStr = JSON.stringify(obj);
      const packed = lzwCompress.pack(obj);
      expect(Array.isArray(packed)).toBe(true);
      expect(packed.length).toBeLessThan(jsonStr.length);
    });
  });

  // ---------------------------------------------------------------------
  // Edge cases for pack()
  // ---------------------------------------------------------------------

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

    it("packs a plain string", () => {
      const packed = lzwCompress.pack("hello world");
      expect(Array.isArray(packed)).toBe(true);
    });

    it("packs a number as-is (non-object non-string passthrough via LZW)", () => {
      // Numbers are not objects, so KeyOptimize is skipped and LZWCompress.pack
      // returns the input unchanged since it is not a string.
      const packed = lzwCompress.pack(42);
      expect(packed).toBe(42);
    });

    it("packs an empty object", () => {
      const packed = lzwCompress.pack({});
      expect(Array.isArray(packed)).toBe(true);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual({});
    });

    it("packs an empty array", () => {
      const packed = lzwCompress.pack([]);
      expect(Array.isArray(packed)).toBe(true);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------
  // Edge cases for unpack()
  // ---------------------------------------------------------------------

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

    it("returns non-array input unchanged when passed to LZWCompress.unpack", () => {
      // A plain object, when passed to unpack directly (not previously packed),
      // is not an array, so LZWCompress.unpack returns it unchanged; then
      // JSON.parse on an object will throw, causing pack to fall back to
      // returning the object itself.
      const obj = { foo: "bar" };
      const result = lzwCompress.unpack(obj);
      expect(result).toBe(obj);
    });

    it("handles unpacking a plain compressed string (non-JSON result)", () => {
      const packed = lzwCompress.pack("just a string, not json");
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toBe("just a string, not json");
    });

    it("returns null-ish result gracefully for malformed compressed arrays", () => {
      // An array of numbers that doesn't correspond to real dictionary state
      // exercises the LZW decompress "unknown code" branch.
      const malformed = [65, 999];
      const result = lzwCompress.unpack(malformed);
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------

  describe("enableLogging", () => {
    it("does not throw when logging is enabled", () => {
      lzwCompress.enableLogging(true);
      expect(() => {
        lzwCompress.pack({ a: 1, b: [1, 2, 3] });
      }).not.toThrow();
    });

    it("calls console.log when logging enabled", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      lzwCompress.enableLogging(true);
      lzwCompress.pack({ x: "y" });
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("does not call console.log when logging disabled", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      lzwCompress.enableLogging(false);
      lzwCompress.pack({ x: "y" });
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------
  // Special characters / unicode
  // ---------------------------------------------------------------------

  describe("special content", () => {
    it("round trips strings with special characters", () => {
      const obj = { text: "Hello, \"world\"! It's a test: 100% success." };
      const packed = lzwCompress.pack(obj);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
    });

    it("round trips objects with numeric and boolean values", () => {
      const obj = { count: 42, active: true, ratio: 3.14, empty: null };
      const packed = lzwCompress.pack(obj);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
    });

    it("round trips deeply nested arrays and objects", () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              level4: ["a", "b", { level5: "deep" }],
            },
          },
        },
      };
      const packed = lzwCompress.pack(obj);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
    });

    it("round trips objects with duplicate key names at different levels", () => {
      const obj = {
        name: "outer",
        child: { name: "inner", child: { name: "innermost" } },
      };
      const packed = lzwCompress.pack(obj);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
    });
  });

  // ---------------------------------------------------------------------
  // Module exposure
  // ---------------------------------------------------------------------

  describe("module API", () => {
    it("exposes pack, unpack, and enableLogging functions", () => {
      expect(typeof lzwCompress.pack).toBe("function");
      expect(typeof lzwCompress.unpack).toBe("function");
      expect(typeof lzwCompress.enableLogging).toBe("function");
    });
  });
});