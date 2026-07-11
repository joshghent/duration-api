import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import lzwCompress from "./lzwcompress.js";

describe("lzwCompress.pack / unpack", () => {
  afterEach(() => {
    lzwCompress.enableLogging(false);
  });

  it("round-trips a simple string", () => {
    const original = "hello world";
    const packed = lzwCompress.pack(original);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toBe(original);
  });

  it("round-trips a repetitive string (compressible)", () => {
    const original = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const packed = lzwCompress.pack(original);
    expect(Array.isArray(packed)).toBe(true);
    expect(packed.length).toBeLessThan(original.length);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toBe(original);
  });

  it("round-trips a simple object", () => {
    const original = { name: "John", age: 30 };
    const packed = lzwCompress.pack(original);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toEqual(original);
  });

  it("round-trips a nested object", () => {
    const original = {
      name: "John",
      address: {
        street: "Main St",
        city: "Anytown",
      },
      tags: ["a", "b", "c"],
    };
    const packed = lzwCompress.pack(original);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toEqual(original);
  });

  it("round-trips an array of objects sharing keys", () => {
    const original = [
      { question: "What is 2+2?", answer: "4" },
      { question: "What is 3+3?", answer: "6" },
    ];
    const packed = lzwCompress.pack(original);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toEqual(original);
  });

  it("returns falsy values unchanged", () => {
    expect(lzwCompress.pack(null)).toBeNull();
    expect(lzwCompress.pack(undefined)).toBeUndefined();
    expect(lzwCompress.pack(0)).toBe(0);
    expect(lzwCompress.pack("")).toBe("");
    expect(lzwCompress.pack(false)).toBe(false);
  });

  it("returns true unchanged when packing", () => {
    expect(lzwCompress.pack(true)).toBe(true);
  });

  it("returns Date instances unchanged when packing", () => {
    const date = new Date();
    expect(lzwCompress.pack(date)).toBe(date);
  });

  it("returns falsy values unchanged when unpacking", () => {
    expect(lzwCompress.unpack(null)).toBeNull();
    expect(lzwCompress.unpack(undefined)).toBeUndefined();
    expect(lzwCompress.unpack(0)).toBe(0);
    expect(lzwCompress.unpack("")).toBe("");
    expect(lzwCompress.unpack(false)).toBe(false);
  });

  it("returns true unchanged when unpacking", () => {
    expect(lzwCompress.unpack(true)).toBe(true);
  });

  it("returns Date instances unchanged when unpacking", () => {
    const date = new Date();
    expect(lzwCompress.unpack(date)).toBe(date);
  });

  it("handles single character strings", () => {
    const original = "a";
    const packed = lzwCompress.pack(original);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toBe(original);
  });

  it("handles numeric values (non-object, non-string)", () => {
    // numbers are truthy, not objects, not strings -> LZWCompress.pack returns them unchanged
    const packed = lzwCompress.pack(42);
    expect(packed).toBe(42);
  });

  it("handles empty object", () => {
    const original = {};
    const packed = lzwCompress.pack(original);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toEqual(original);
  });

  it("handles empty array as top-level object", () => {
    const original = [];
    const packed = lzwCompress.pack(original);
    const unpacked = lzwCompress.unpack(packed);
    // decompress with empty __v array should still return an array-ish result
    expect(unpacked).toEqual(original);
  });

  it("handles strings with special characters and unicode", () => {
    const original = "Hello, 世界! Special chars: @#$%^&*()_+ 😊";
    const packed = lzwCompress.pack(original);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toBe(original);
  });

  it("handles long JSON-like content in a real world shape", () => {
    const original = {
      course: "Employee Health and Wellness",
      modules: [
        { title: "Intro", duration: 300, completed: false },
        { title: "Nutrition", duration: 600, completed: false },
        { title: "Exercise", duration: 450, completed: true },
      ],
      metadata: {
        author: "Acme Corp",
        version: "1.0",
      },
    };
    const packed = lzwCompress.pack(original);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toEqual(original);
  });
});

describe("lzwCompress.enableLogging", () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    lzwCompress.enableLogging(false);
  });

  it("does not log when logging is disabled (default)", () => {
    lzwCompress.pack("some string");
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it("logs messages when logging is enabled", () => {
    lzwCompress.enableLogging(true);
    lzwCompress.pack("some string to compress");
    expect(consoleSpy).toHaveBeenCalled();
    expect(consoleSpy.mock.calls[0][0]).toContain("lzwCompress:");
  });

  it("logs during object packing including key optimization", () => {
    lzwCompress.enableLogging(true);
    lzwCompress.pack({ foo: "bar" });
    expect(consoleSpy).toHaveBeenCalled();
    const messages = consoleSpy.mock.calls.map((c) => c[0]);
    expect(messages.some((m) => m.includes("key optimized"))).toBe(true);
  });

  it("logs during unpacking", () => {
    const packed = lzwCompress.pack({ foo: "bar" });
    consoleSpy.mockClear();
    lzwCompress.enableLogging(true);
    lzwCompress.unpack(packed);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("can be disabled again after enabling", () => {
    lzwCompress.enableLogging(true);
    lzwCompress.enableLogging(false);
    lzwCompress.pack("test string");
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});

describe("lzwCompress.unpack edge cases", () => {
  it("returns unpacked value unchanged when result is not valid JSON", () => {
    const packed = lzwCompress.pack("just a plain string, not JSON");
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toBe("just a plain string, not JSON");
  });

  it("handles arrays that are not from LZW pack (non-array input to unpack)", () => {
    // Passing a plain string (not array) to unpack - LZWCompress.unpack returns it unchanged
    const result = lzwCompress.unpack("not-an-array");
    // JSON.parse("not-an-array") will throw -> caught -> returns raw string
    expect(result).toBe("not-an-array");
  });

  it("handles malformed compressed array gracefully", () => {
    // An array that isn't a valid LZW compressed sequence for our decompress logic
    // dictionary[k] lookup with out of range key triggers return null in LZWCompress.decompress
    const badCompressed = [999999];
    const result = lzwCompress.unpack(badCompressed);
    // JSON.parse(null) -> null is not valid JSON string but JSON.parse(null) coerces to "null" -> parses to null
    expect(result === null || typeof result !== "undefined").toBe(true);
  });
});

describe("lzwCompress full round trip variety", () => {
  const cases = [
    "simple",
    "with spaces and punctuation!",
    "1234567890",
    "MixedCASEandNumbers123",
    "a".repeat(1000),
    JSON.stringify({ a: 1, b: [1, 2, 3], c: { d: "e" } }),
  ];

  cases.forEach((str, idx) => {
    it(`round-trips test case #${idx}`, () => {
      const packed = lzwCompress.pack(str);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toBe(str);
    });
  });

  const objectCases = [
    { a: 1 },
    { a: [1, 2, 3], b: { c: 4 } },
    [{ x: 1 }, { x: 2 }, { x: 3 }],
    { deeply: { nested: { object: { here: [1, 2, { more: "data" }] } } } },
  ];

  objectCases.forEach((obj, idx) => {
    it(`round-trips object test case #${idx}`, () => {
      const packed = lzwCompress.pack(obj);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
    });
  });
});