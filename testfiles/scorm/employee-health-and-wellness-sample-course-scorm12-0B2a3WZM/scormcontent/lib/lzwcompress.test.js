import { describe, it, expect, beforeEach, afterEach } from "vitest";

// The lzwcompress.js file uses UMD pattern and will be available as module.exports
const lzwCompress = require("./lzwcompress.js");

describe("lzwCompress", () => {
  describe("basic pack/unpack", () => {
    it("compresses and decompresses simple strings", () => {
      const original = "hello world";
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toBe(original);
    });

    it("compresses and decompresses longer strings", () => {
      const original = "the quick brown fox jumps over the lazy dog ".repeat(10);
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toBe(original);
    });

    it("compresses and decompresses empty string", () => {
      const original = "";
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toBe(original);
    });

    it("compresses and decompresses single character", () => {
      const original = "a";
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toBe(original);
    });

    it("compresses and decompresses repeated patterns", () => {
      const original = "aaaaaabbbbbbccccccdddddd";
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toBe(original);
    });

    it("compresses and decompresses special characters", () => {
      const original = "!@#$%^&*()_+-=[]{}|;':\",./<>?";
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toBe(original);
    });

    it("compresses and decompresses unicode characters", () => {
      const original = "Hello 世界 🌍";
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toBe(original);
    });

    it("compresses and decompresses newlines and tabs", () => {
      const original = "line1\nline2\tindented\r\nline3";
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
          name: "Alice",
          profile: {
            age: 25,
            location: {
              city: "Boston",
              country: "USA"
            }
          }
        }
      };
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toEqual(original);
    });

    it("compresses and decompresses arrays", () => {
      const original = [1, 2, 3, 4, 5];
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toEqual(original);
    });

    it("compresses and decompresses arrays of objects", () => {
      const original = [
        { id: 1, name: "Item 1" },
        { id: 2, name: "Item 2" },
        { id: 3, name: "Item 3" }
      ];
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toEqual(original);
    });

    it("compresses and decompresses objects with arrays", () => {
      const original = {
        items: ["apple", "banana", "cherry"],
        counts: [5, 10, 15],
        nested: {
          values: [1, 2, 3]
        }
      };
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toEqual(original);
    });

    it("compresses and decompresses empty object", () => {
      const original = {};
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toEqual(original);
    });

    it("compresses and decompresses empty array", () => {
      const original: any[] = [];
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toEqual(original);
    });

    it("handles objects with repeated keys", () => {
      const original = {
        key1: "value1",
        key2: "value2",
        key3: "value3",
        nested1: { key1: "nested", key2: "values" },
        nested2: { key1: "more", key3: "data" }
      };
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toEqual(original);
    });
  });

  describe("edge cases and special values", () => {
    it("handles null values", () => {
      const original = null;
      const compressed = lzwCompress.pack(original);
      expect(compressed).toBe(null);
    });

    it("handles undefined values", () => {
      const original = undefined;
      const compressed = lzwCompress.pack(original);
      expect(compressed).toBe(undefined);
    });

    it("handles boolean true", () => {
      const original = true;
      const compressed = lzwCompress.pack(original);
      expect(compressed).toBe(true);
    });

    it("handles boolean false", () => {
      const original = false;
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toBe(original);
    });

    it("handles Date objects", () => {
      const original = new Date("2024-01-01");
      const compressed = lzwCompress.pack(original);
      expect(compressed).toBe(original);
    });

    it("handles numbers in objects", () => {
      const original = { value: 42, float: 3.14, negative: -10 };
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toEqual(original);
    });

    it("handles mixed type arrays", () => {
      const original = [1, "two", true, null, { key: "value" }];
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toEqual(original);
    });

    it("handles objects with null values", () => {
      const original = { name: "test", value: null, count: 0 };
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toEqual(original);
    });
  });

  describe("compression efficiency", () => {
    it("compresses repetitive data efficiently", () => {
      const original = "a".repeat(1000);
      const compressed = lzwCompress.pack(original);
      expect(Array.isArray(compressed)).toBe(true);
      if (Array.isArray(compressed)) {
        expect(compressed.length).toBeLessThan(original.length);
      }
    });

    it("handles large objects with repeated keys", () => {
      const original = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: `Description for item ${i}`,
        category: "test",
        status: "active"
      }));
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toEqual(original);
    });
  });

  describe("real-world SCORM-like data", () => {
    it("compresses SCORM CMI data", () => {
      const original = {
        "cmi.core.student_id": "12345",
        "cmi.core.student_name": "Doe, John",
        "cmi.core.lesson_location": "page_5",
        "cmi.core.lesson_status": "incomplete",
        "cmi.core.score.raw": "75",
        "cmi.core.score.min": "0",
        "cmi.core.score.max": "100",
        "cmi.suspend_data": "checkpoint=5;attempts=3;answers=a,b,c"
      };
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toEqual(original);
    });

    it("compresses quiz responses", () => {
      const original = {
        questions: [
          { id: "q1", answer: "A", correct: true, score: 10 },
          { id: "q2", answer: "C", correct: false, score: 0 },
          { id: "q3", answer: "B", correct: true, score: 10 },
          { id: "q4", answer: "D", correct: true, score: 10 }
        ],
        totalScore: 30,
        maxScore: 40,
        percentage: 75
      };
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toEqual(original);
    });
  });

  describe("decompression of invalid data", () => {
    it("handles decompression of non-compressed strings", () => {
      const input = "not compressed";
      const result = lzwCompress.unpack(input);
      expect(result).toBe(input);
    });

    it("handles decompression of plain numbers", () => {
      const input = 42;
      const result = lzwCompress.unpack(input);
      expect(result).toBe(input);
    });

    it("handles decompression of null", () => {
      const result = lzwCompress.unpack(null);
      expect(result).toBe(null);
    });

    it("handles decompression of true", () => {
      const result = lzwCompress.unpack(true);
      expect(result).toBe(true);
    });

    it("handles decompression of Date", () => {
      const date = new Date();
      const result = lzwCompress.unpack(date);
      expect(result).toBe(date);
    });
  });

  describe("enableLogging", () => {
    let consoleLogSpy: any;

    beforeEach(() => {
      consoleLogSpy = { calls: [] as any[] };
      const originalLog = console.log;
      console.log = (...args: any[]) => {
        consoleLogSpy.calls.push(args);
        originalLog.apply(console, args);
      };
    });

    afterEach(() => {
      lzwCompress.enableLogging(false);
    });

    it("enables logging", () => {
      lzwCompress.enableLogging(true);
      const original = "test string";
      lzwCompress.pack(original);
      // Logging should have been called (implementation detail test)
      lzwCompress.enableLogging(false);
    });

    it("disables logging by default", () => {
      const original = "test string";
      lzwCompress.pack(original);
      // Should work without logging
      expect(lzwCompress.unpack(lzwCompress.pack(original))).toBe(original);
    });
  });

  describe("round-trip consistency", () => {
    it("maintains data integrity through multiple pack/unpack cycles", () => {
      let data: any = {
        nested: {
          array: [1, 2, 3],
          string: "test",
          object: { key: "value" }
        }
      };

      for (let i = 0; i < 5; i++) {
        const compressed = lzwCompress.pack(data);
        data = lzwCompress.unpack(compressed);
      }

      expect(data).toEqual({
        nested: {
          array: [1, 2, 3],
          string: "test",
          object: { key: "value" }
        }
      });
    });
  });

  describe("KeyOptimize functionality", () => {
    it("optimizes repeated keys in large datasets", () => {
      const original = {
        users: [
          { firstName: "John", lastName: "Doe", email: "john@example.com" },
          { firstName: "Jane", lastName: "Smith", email: "jane@example.com" },
          { firstName: "Bob", lastName: "Johnson", email: "bob@example.com" }
        ]
      };
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toEqual(original);
    });

    it("handles deeply nested objects with repeated key patterns", () => {
      const original = {
        level1: {
          level2: {
            level3: {
              level4: {
                data: "deep",
                value: 42
              },
              data: "medium",
              value: 30
            },
            data: "shallow",
            value: 20
          },
          data: "root",
          value: 10
        }
      };
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toEqual(original);
    });
  });

  describe("LZW-specific patterns", () => {
    it("compresses strings with all ASCII characters", () => {
      const original = Array.from({ length: 256 }, (_, i) => String.fromCharCode(i)).join("");
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toBe(original);
    });

    it("handles strings that expand during compression", () => {
      // Strings with no repetition might not compress well
      const original = Array.from({ length: 100 }, (_, i) => String.fromCharCode(i + 65)).join("");
      const compressed = lzwCompress.pack(original);
      const decompressed = lzwCompress.unpack(compressed);
      expect(decompressed).toBe(original);
    });
  });
});