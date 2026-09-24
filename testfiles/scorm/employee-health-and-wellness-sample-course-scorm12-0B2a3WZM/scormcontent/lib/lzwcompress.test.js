import { describe, it, expect } from "vitest";
import lzwCompress from "./lzwcompress.js";

// ---------------------------------------------------------------------------
// pack / unpack round trip tests
// ---------------------------------------------------------------------------

describe("lzwCompress.pack / unpack round trip", () => {
  it("compresses and decompresses a simple object", () => {
    const obj = { name: "John", age: 30, city: "New York" };
    const packed = lzwCompress.pack(obj);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toEqual(obj);
  });

  it("compresses and decompresses a nested object", () => {
    const obj = {
      name: "Jane",
      address: {
        street: "123 Main St",
        city: "Springfield",
        zip: "12345"
      },
      hobbies: ["reading", "cycling", "chess"]
    };
    const packed = lzwCompress.pack(obj);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toEqual(obj);
  });

  it("compresses and decompresses an array of objects", () => {
    const obj = [
      { question: "What is 2+2?", answer: "4" },
      { question: "What is 3+3?", answer: "6" }
    ];
    const packed = lzwCompress.pack(obj);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toEqual(obj);
  });

  it("compresses and decompresses repetitive data efficiently", () => {
    const obj = { data: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" };
    const packed = lzwCompress.pack(obj);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toEqual(obj);
  });

  it("handles an empty object", () => {
    const obj = {};
    const packed = lzwCompress.pack(obj);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toEqual(obj);
  });

  it("handles an empty array", () => {
    const obj = [];
    const packed = lzwCompress.pack(obj);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toEqual(obj);
  });

  it("handles objects with duplicate keys across nested structures", () => {
    const obj = {
      items: [
        { id: 1, value: "a" },
        { id: 2, value: "b" },
        { id: 3, value: "c" }
      ]
    };
    const packed = lzwCompress.pack(obj);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toEqual(obj);
  });

  it("handles objects with numeric and boolean values", () => {
    const obj = { count: 42, active: false, ratio: 3.14 };
    const packed = lzwCompress.pack(obj);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toEqual(obj);
  });

  it("handles objects with null values inside", () => {
    const obj = { name: "Test", value: null };
    const packed = lzwCompress.pack(obj);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toEqual(obj);
  });

  it("handles long strings with mixed characters", () => {
    const obj = { text: "The quick brown fox jumps over the lazy dog. ".repeat(20) };
    const packed = lzwCompress.pack(obj);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toEqual(obj);
  });
});

// ---------------------------------------------------------------------------
// pack behavior
// ---------------------------------------------------------------------------

describe("lzwCompress.pack", () => {
  it("returns falsy value unchanged", () => {
    expect(lzwCompress.pack(null)).toBeNull();
    expect(lzwCompress.pack(undefined)).toBeUndefined();
    expect(lzwCompress.pack(0)).toBe(0);
    expect(lzwCompress.pack("")).toBe("");
  });

  it("returns true unchanged", () => {
    expect(lzwCompress.pack(true)).toBe(true);
  });

  it("returns a Date instance unchanged", () => {
    const date = new Date();
    expect(lzwCompress.pack(date)).toBe(date);
  });

  it("returns an array result for object input", () => {
    const obj = { a: 1, b: 2 };
    const packed = lzwCompress.pack(obj);
    expect(Array.isArray(packed)).toBe(true);
  });

  it("compresses plain strings directly without KeyOptimize", () => {
    const str = "hello world hello world hello world";
    const packed = lzwCompress.pack(str);
    expect(Array.isArray(packed)).toBe(true);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toBe(str);
  });

  it("passes through numbers unchanged (not string/object handling for LZW)", () => {
    // numbers are not objects and not strings, so LZWCompress.pack returns them unchanged
    const packed = lzwCompress.pack(42);
    expect(packed).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// unpack behavior
// ---------------------------------------------------------------------------

describe("lzwCompress.unpack", () => {
  it("returns falsy compressed values unchanged", () => {
    expect(lzwCompress.unpack(null)).toBeNull();
    expect(lzwCompress.unpack(undefined)).toBeUndefined();
    expect(lzwCompress.unpack(0)).toBe(0);
    expect(lzwCompress.unpack("")).toBe("");
  });

  it("returns true unchanged", () => {
    expect(lzwCompress.unpack(true)).toBe(true);
  });

  it("returns a Date instance unchanged", () => {
    const date = new Date();
    expect(lzwCompress.unpack(date)).toBe(date);
  });

  it("returns non-array input unchanged from LZWCompress.unpack, and then attempts JSON parse", () => {
    // A non-array, non-falsy, non-Date value passed to unpack will be passed to LZWCompress.unpack,
    // which returns non-arrays unchanged. Then JSON.parse will be attempted.
    const result = lzwCompress.unpack("just a string");
    // JSON.parse('just a string') fails -> catch block returns the raw string
    expect(result).toBe("just a string");
  });

  it("returns null for malformed/corrupted compressed array", () => {
    // An array that doesn't correspond to valid LZW-compressed data structure
    // Using an out-of-sequence code that isn't in the dictionary should yield null
    const corrupted = [300, 301, 302];
    const result = lzwCompress.unpack(corrupted);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// KeyOptimize internal behavior via full round trip
// ---------------------------------------------------------------------------

describe("KeyOptimize behavior (through pack/unpack)", () => {
  it("shortens repeated object keys under the hood", () => {
    const obj = {
      firstName: "Alice",
      lastName: "Smith",
      contacts: [
        { firstName: "Bob", lastName: "Jones" },
        { firstName: "Carol", lastName: "White" }
      ]
    };
    const packed = lzwCompress.pack(obj);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toEqual(obj);
  });

  it("handles deeply nested structures", () => {
    const obj = {
      level1: {
        level2: {
          level3: {
            level4: {
              value: "deep value"
            }
          }
        }
      }
    };
    const packed = lzwCompress.pack(obj);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toEqual(obj);
  });

  it("handles arrays of primitives inside objects", () => {
    const obj = { numbers: [1, 2, 3, 4, 5], letters: ["a", "b", "c"] };
    const packed = lzwCompress.pack(obj);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toEqual(obj);
  });
});

// ---------------------------------------------------------------------------
// enableLogging
// ---------------------------------------------------------------------------

describe("lzwCompress.enableLogging", () => {
  it("can be enabled and disabled without throwing", () => {
    expect(() => lzwCompress.enableLogging(true)).not.toThrow();
    expect(() => lzwCompress.enableLogging(false)).not.toThrow();
  });

  it("logging enabled still allows normal pack/unpack operation", () => {
    lzwCompress.enableLogging(true);
    try {
      const obj = { message: "logged compression test" };
      const packed = lzwCompress.pack(obj);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
    } finally {
      lzwCompress.enableLogging(false);
    }
  });
});

// ---------------------------------------------------------------------------
// SCORM-realistic payloads
// ---------------------------------------------------------------------------

describe("lzwCompress with SCORM-like data structures", () => {
  it("round trips a SCORM suspend_data-like structure", () => {
    const suspendData = {
      currentSlide: 5,
      totalSlides: 20,
      visitedSlides: [1, 2, 3, 4, 5],
      quizAnswers: [
        { questionId: "q1", answer: "A", correct: true },
        { questionId: "q2", answer: "C", correct: false }
      ],
      score: 80,
      completed: false
    };
    const packed = lzwCompress.pack(suspendData);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toEqual(suspendData);
  });

  it("round trips a larger dataset with repeated structure (interactions)", () => {
    const interactions = {
      interactions: Array.from({ length: 15 }, (_, i) => ({
        id: `interaction_${i}`,
        type: "choice",
        learnerResponse: i % 2 === 0 ? "yes" : "no",
        result: i % 2 === 0 ? "correct" : "incorrect"
      }))
    };
    const packed = lzwCompress.pack(interactions);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toEqual(interactions);
  });
});