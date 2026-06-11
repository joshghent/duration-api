import { describe, it, expect, beforeEach, afterEach } from "vitest";

// The module uses UMD pattern, so we need to handle different export styles
let lzwCompress;

// Mock the module environment for testing
beforeEach(() => {
  // Load the module fresh for each test
  const moduleCode = `
    (function () {
      var exports = {};
      var module = { exports: exports };
      ${require('fs').readFileSync('./lzwcompress.js', 'utf8')}
      return module.exports;
    })();
  `;
  lzwCompress = eval(moduleCode);
});

describe("lzwCompress", () => {
  describe("basic compression and decompression", () => {
    it("compresses and decompresses simple strings", () => {
      const original = "Hello, world!";
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toBe(original);
    });

    it("compresses and decompresses repeated patterns", () => {
      const original = "TOBEORNOTTOBEORTOBEORNOT";
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toBe(original);
      expect(compressed).not.toBe(original);
      expect(Array.isArray(compressed)).toBe(true);
    });

    it("compresses and decompresses empty string", () => {
      const original = "";
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toBe(original);
    });

    it("compresses and decompresses single character", () => {
      const original = "A";
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toBe(original);
    });

    it("handles long strings with many repetitions", () => {
      const original = "abcabcabcabcabcabc".repeat(10);
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toBe(original);
      expect(Array.isArray(compressed)).toBe(true);
      expect(compressed.length).toBeLessThan(original.length);
    });

    it("handles unicode characters", () => {
      const original = "Hello 世界 🌍";
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toBe(original);
    });

    it("handles special characters", () => {
      const original = "!@#$%^&*()_+-=[]{}|;':\"<>?,./\\";
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toBe(original);
    });

    it("handles newlines and whitespace", () => {
      const original = "Line 1\nLine 2\r\nLine 3\tTabbed";
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toBe(original);
    });
  });

  describe("object compression", () => {
    it("compresses and decompresses simple objects", () => {
      const original = { name: "John", age: 30, city: "New York" };
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toEqual(original);
    });

    it("compresses and decompresses nested objects", () => {
      const original = {
        user: {
          profile: {
            name: "Alice",
            details: {
              age: 25,
              location: "London"
            }
          }
        }
      };
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toEqual(original);
    });

    it("compresses and decompresses arrays", () => {
      const original = { items: [1, 2, 3, 4, 5], tags: ["a", "b", "c"] };
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toEqual(original);
    });

    it("compresses and decompresses objects with repeated keys", () => {
      const original = [
        { name: "Alice", age: 25, city: "NYC" },
        { name: "Bob", age: 30, city: "LA" },
        { name: "Charlie", age: 35, city: "SF" }
      ];
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toEqual(original);
    });

    it("handles objects with null values", () => {
      const original = { value: null, other: "test" };
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toEqual(original);
    });

    it("handles objects with boolean values", () => {
      const original = { active: true, deleted: false, verified: true };
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toEqual(original);
    });

    it("handles objects with number values", () => {
      const original = { count: 42, price: 19.99, negative: -5, zero: 0 };
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toEqual(original);
    });

    it("handles empty objects", () => {
      const original = {};
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toEqual(original);
    });

    it("handles empty arrays", () => {
      const original = { items: [] };
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toEqual(original);
    });

    it("handles complex SCORM-like data", () => {
      const original = {
        cmi: {
          core: {
            student_id: "12345",
            student_name: "Doe, John",
            lesson_status: "incomplete",
            score: {
              raw: "85",
              min: "0",
              max: "100"
            }
          },
          suspend_data: "bookmarks=page5;answers=1,2,3,4",
          interactions: [
            { id: "q1", type: "choice", result: "correct", latency: "PT5S" },
            { id: "q2", type: "choice", result: "wrong", latency: "PT3S" }
          ]
        }
      };
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toEqual(original);
    });
  });

  describe("edge cases and special values", () => {
    it("returns null as is", () => {
      expect(lzwCompress.pack(null)).toBe(null);
      expect(lzwCompress.unpack(null)).toBe(null);
    });

    it("returns undefined as is", () => {
      expect(lzwCompress.pack(undefined)).toBe(undefined);
      expect(lzwCompress.unpack(undefined)).toBe(undefined);
    });

    it("returns true as is", () => {
      expect(lzwCompress.pack(true)).toBe(true);
      expect(lzwCompress.unpack(true)).toBe(true);
    });

    it("returns false normally (not special-cased)", () => {
      const compressed = lzwCompress.pack(false);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toBe(false);
    });

    it("handles Date objects", () => {
      const date = new Date("2024-01-01T00:00:00Z");
      expect(lzwCompress.pack(date)).toBe(date);
      expect(lzwCompress.unpack(date)).toBe(date);
    });

    it("handles numbers", () => {
      const num = 42;
      const compressed = lzwCompress.pack(num);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toBe(num);
    });

    it("handles very long strings", () => {
      const original = "A".repeat(10000);
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toBe(original);
    });

    it("handles strings with all ASCII characters", () => {
      let original = "";
      for (let i = 32; i < 127; i++) {
        original += String.fromCharCode(i);
      }
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toBe(original);
    });
  });

  describe("compression efficiency", () => {
    it("compresses repetitive data effectively", () => {
      const original = "aaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      const compressed = lzwCompress.pack(original);
      expect(Array.isArray(compressed)).toBe(true);
      expect(compressed.length).toBeLessThan(original.length);
    });

    it("may not compress random data efficiently", () => {
      const original = "abcdefghijklmnopqrstuvwxyz0123456789";
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toBe(original);
    });

    it("compresses JSON with repeated keys", () => {
      const original = {
        students: [
          { studentId: "1", studentName: "Alice", studentGrade: 90 },
          { studentId: "2", studentName: "Bob", studentGrade: 85 },
          { studentId: "3", studentName: "Charlie", studentGrade: 92 }
        ]
      };
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toEqual(original);
      expect(Array.isArray(compressed)).toBe(true);
    });
  });

  describe("LZWCompress module", () => {
    it("returns original for non-string input in pack", () => {
      const original = 123;
      const result = lzwCompress.pack(original);
      expect(result).toBe(original);
    });

    it("returns original for non-array input in unpack", () => {
      const original = "not-an-array";
      const result = lzwCompress.unpack(original);
      expect(result).toBe(original);
    });

    it("handles corrupted compressed data gracefully", () => {
      // Valid compression followed by invalid data
      const validCompressed = lzwCompress.pack("test");
      const corrupted = [...validCompressed, 999999];
      const result = lzwCompress.unpack(corrupted);
      expect(result).toBeNull();
    });
  });

  describe("KeyOptimize module", () => {
    it("optimizes keys in nested objects", () => {
      const original = {
        longKeyName1: "value1",
        longKeyName2: "value2",
        nested: {
          longKeyName1: "nested1",
          longKeyName3: "nested3"
        }
      };
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toEqual(original);
    });

    it("handles objects without __k property on decompress", () => {
      const obj = { regular: "object", without: "special", keys: "test" };
      const decompressed = lzwCompress.unpack(obj);
      expect(typeof decompressed).toBe("string");
      expect(() => JSON.parse(decompressed)).not.toThrow();
    });
  });

  describe("enableLogging", () => {
    it("accepts enable/disable calls without error", () => {
      expect(() => lzwCompress.enableLogging(true)).not.toThrow();
      expect(() => lzwCompress.enableLogging(false)).not.toThrow();
    });

    it("does not affect compression/decompression", () => {
      lzwCompress.enableLogging(true);
      const original = "test string";
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      lzwCompress.enableLogging(false);
      expect(decompressed).toBe(original);
    });
  });

  describe("round-trip consistency", () => {
    it("maintains data integrity through multiple compress/decompress cycles", () => {
      let data = { test: "data", number: 42, nested: { value: "test" } };
      
      for (let i = 0; i < 5; i++) {
        const compressed = lzwCompress.pack(data);
        data = lzwCompress.unpack(compressed);
      }
      
      expect(data).toEqual({ test: "data", number: 42, nested: { value: "test" } });
    });

    it("handles alternating string and object compression", () => {
      const str = "test string";
      const obj = { key: "value" };
      
      const compressedStr = lzwCompress.pack(str);
      const compressedObj = lzwCompress.pack(obj);
      
      expect(lzwCompress.unpack(compressedStr)).toBe(str);
      expect(lzwCompress.unpack(compressedObj)).toEqual(obj);
    });
  });

  describe("real-world SCORM scenarios", () => {
    it("compresses typical suspend_data", () => {
      const suspendData = "page=5|score=85|bookmarks=intro,chapter1,chapter2|answers=1,2,3,4,1,2,3,4";
      const compressed = lzwCompress.pack(suspendData);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toBe(suspendData);
    });

    it("compresses lesson location data", () => {
      const location = "module3/lesson2/page5";
      const compressed = lzwCompress.pack(location);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toBe(location);
    });

    it("compresses interaction data", () => {
      const interactions = {
        interactions: [
          { id: "interaction_1", type: "true-false", student_response: "true", result: "correct", latency: "PT10S" },
          { id: "interaction_2", type: "choice", student_response: "a", result: "wrong", latency: "PT5S" },
          { id: "interaction_3", type