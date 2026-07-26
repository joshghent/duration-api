import { describe, it, expect } from "vitest";
import lzwCompress from "./lzwcompress.js";

describe("lzwCompress.pack / unpack", () => {
  it("compresses and decompresses a simple object", () => {
    const obj = { name: "John Doe", age: 30, active: true };
    const packed = lzwCompress.pack(obj);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toEqual(obj);
  });

  it("compresses and decompresses a nested object", () => {
    const obj = {
      user: {
        name: "Alice",
        address: {
          city: "Wonderland",
          zip: "12345",
        },
      },
      tags: ["a", "b", "c"],
    };
    const packed = lzwCompress.pack(obj);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toEqual(obj);
  });

  it("compresses and decompresses an array of objects", () => {
    const obj = [
      { id: 1, value: "one" },
      { id: 2, value: "two" },
      { id: 3, value: "three" },
    ];
    const packed = lzwCompress.pack(obj);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toEqual(obj);
  });

  it("returns an array (compressed representation) for objects", () => {
    const obj = { a: 1, b: 2 };
    const packed = lzwCompress.pack(obj);
    expect(Array.isArray(packed)).toBe(true);
  });

  it("compresses and decompresses a plain string", () => {
    const str = "hello world hello world hello world";
    const packed = lzwCompress.pack(str);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toBe(str);
  });

  it("handles repeated key names efficiently via KeyOptimize", () => {
    const obj = {
      items: [
        { name: "item1", value: 100 },
        { name: "item2", value: 200 },
        { name: "item3", value: 300 },
      ],
    };
    const packed = lzwCompress.pack(obj);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toEqual(obj);
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

  it("handles empty string", () => {
    const str = "";
    const packed = lzwCompress.pack(str);
    // empty string is falsy, so pack returns it unchanged
    expect(packed).toBe(str);
  });
});

// ---------------------------------------------------------------------------
// Edge cases / falsy & special values
// ---------------------------------------------------------------------------

describe("lzwCompress edge cases", () => {
  it("returns falsy values unchanged when packing", () => {
    expect(lzwCompress.pack(null)).toBeNull();
    expect(lzwCompress.pack(undefined)).toBeUndefined();
    expect(lzwCompress.pack(0)).toBe(0);
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
    expect(lzwCompress.unpack(false)).toBe(false);
  });

  it("returns true unchanged when unpacking", () => {
    expect(lzwCompress.unpack(true)).toBe(true);
  });

  it("returns Date instances unchanged when unpacking", () => {
    const date = new Date();
    expect(lzwCompress.unpack(date)).toBe(date);
  });

  it("handles a number value", () => {
    const packed = lzwCompress.pack(42);
    expect(packed).toBe(42);
  });

  it("handles single-character strings", () => {
    const str = "a";
    const packed = lzwCompress.pack(str);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toBe(str);
  });

  it("handles strings with repeated single character", () => {
    const str = "aaaaaaaaaaaaaaaaaaaaaaaa";
    const packed = lzwCompress.pack(str);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toBe(str);
  });

  it("handles strings with unicode characters", () => {
    const str = "héllo wörld こんにちは";
    const packed = lzwCompress.pack(str);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toBe(str);
  });

  it("handles long repetitive JSON payloads", () => {
    const obj = {
      records: Array.from({ length: 50 }, (_, i) => ({
        id: i,
        name: `Record ${i}`,
        description: "This is a repeated description used for compression testing.",
      })),
    };
    const packed = lzwCompress.pack(obj);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toEqual(obj);
  });
});

// ---------------------------------------------------------------------------
// enableLogging
// ---------------------------------------------------------------------------

describe("lzwCompress.enableLogging", () => {
  it("does not throw when enabled and packing/unpacking", () => {
    lzwCompress.enableLogging(true);
    try {
      const obj = { foo: "bar" };
      const packed = lzwCompress.pack(obj);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(obj);
    } finally {
      lzwCompress.enableLogging(false);
    }
  });

  it("does not throw when disabled", () => {
    lzwCompress.enableLogging(false);
    const obj = { foo: "bar" };
    const packed = lzwCompress.pack(obj);
    const unpacked = lzwCompress.unpack(packed);
    expect(unpacked).toEqual(obj);
  });
});

// ---------------------------------------------------------------------------
// Round-trip integrity across a variety of shapes
// ---------------------------------------------------------------------------

describe("lzwCompress round-trip integrity", () => {
  const cases = [
    { label: "flat object", value: { a: 1, b: "two", c: true } },
    { label: "array of numbers", value: [1, 2, 3, 4, 5] },
    { label: "array of strings", value: ["alpha", "beta", "gamma"] },
    {
      label: "deeply nested object",
      value: { a: { b: { c: { d: { e: "deep value" } } } } },
    },
    {
      label: "mixed types object",
      value: { str: "text", num: 3.14, bool: false, arr: [1, "two", 3], nested: { x: 1 } },
    },
  ];

  cases.forEach(({ label, value }) => {
    it(`round-trips: ${label}`, () => {
      const packed = lzwCompress.pack(value);
      const unpacked = lzwCompress.unpack(packed);
      expect(unpacked).toEqual(value);
    });
  });
});