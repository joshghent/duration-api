import { describe, it, expect, beforeEach } from "vitest";

// The source file uses UMD pattern, we need to require it
let lzwCompress;

// Mock the module loading since the file uses UMD pattern
beforeEach(() => {
  // Clear any previous module cache
  delete global.lzwCompress;
  
  // Load the module by executing it
  const fs = require("fs");
  const path = require("path");
  const sourceCode = fs.readFileSync(
    path.resolve(__dirname, "./lzwcompress.js"),
    "utf8"
  );
  
  // Execute the source code in the global context
  eval(sourceCode);
  
  // Get the exported module
  if (typeof module !== 'undefined' && module.exports) {
    lzwCompress = module.exports;
  } else if (global.lzwCompress) {
    lzwCompress = global.lzwCompress;
  }
});

// ---------------------------------------------------------------------------
// Basic compression/decompression tests
// ---------------------------------------------------------------------------

describe("lzwCompress basic functionality", () => {
  it("compresses and decompresses simple strings", () => {
    const original = "hello world";
    const compressed = lzwCompress.pack(original);
    const decompressed = lzwCompress.unpack(compressed);
    expect(decompressed).toBe(original);
  });

  it("compresses and decompresses repeated patterns", () => {
    const original = "ababababababababababab";
    const compressed = lzwCompress.pack(original);
    const decompressed = lzwCompress.unpack(compressed);
    expect(decompressed).toBe(original);
    expect(Array.isArray(compressed)).toBe(true);
    expect(compressed.length).toBeLessThan(original.length);
  });

  it("compresses and decompresses empty string", () => {
    const original = "";
    const compressed = lzwCompress.pack(original);
    const decompressed = lzwCompress.unpack(compressed);
    expect(decompressed).toBe(original);
  });

  it("compresses and decompresses long text", () => {
    const original = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(100);
    const compressed = lzwCompress.pack(original);
    const decompressed = lzwCompress.unpack(compressed);
    expect(decompressed).toBe(original);
  });

  it("compresses and decompresses special characters", () => {
    const original = "Hello! @#$%^&*()_+-=[]{}|;':\",./<>?";
    const compressed = lzwCompress.pack(original);
    const decompressed = lzwCompress.unpack(compressed);
    expect(decompressed).toBe(original);
  });

  it("compresses and decompresses unicode characters", () => {
    const original = "Hello 世界 🌍 café";
    const compressed = lzwCompress.pack(original);
    const decompressed = lzwCompress.unpack(compressed);
    expect(decompressed).toBe(original);
  });

  it("compresses and decompresses newlines and tabs", () => {
    const original = "line1\nline2\tcolumn1\tcolumn2\r\nline3";
    const compressed = lzwCompress.pack(original);
    const decompressed = lzwCompress.unpack(compressed);
    expect(decompressed).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// Object compression tests
// ---------------------------------------------------------------------------

describe("lzwCompress object handling", () => {
  it("compresses and decompresses simple objects", () => {
    const original = { name: "John", age: 30, city: "New York" };
    const compressed = lzwCompress.pack(original);
    const decompressed = lzwCompress.unpack(compressed);
    expect(decompressed).toEqual(original);
  });

  it("compresses and decompresses nested objects", () => {
    const original = {
      user: {
        name: "Jane",
        profile: {
          age: 25,
          location: "London"
        }
      }
    };
    const compressed = lzwCompress.pack(original);
    const decompressed = lzwCompress.unpack(compressed);
    expect(decompressed).toEqual(original);
  });

  it("compresses and decompresses arrays", () => {
    const original = { items: [1, 2, 3, 4, 5], names: ["a", "b", "c"] };
    const compressed = lzwCompress.pack(original);
    const decompressed = lzwCompress.unpack(compressed);
    expect(decompressed).toEqual(original);
  });

  it("compresses and decompresses objects with repeated keys", () => {
    const original = {
      item1: { name: "A", value: 1 },
      item2: { name: "B", value: 2 },
      item3: { name: "C", value: 3 }
    };
    const compressed = lzwCompress.pack(original);
    const decompressed = lzwCompress.unpack(compressed);
    expect(decompressed).toEqual(original);
  });

  it("compresses and decompresses empty objects", () => {
    const original = {};
    const compressed = lzwCompress.pack(original);
    const decompressed = lzwCompress.unpack(compressed);
    expect(decompressed).toEqual(original);
  });

  it("compresses and decompresses empty arrays", () => {
    const original = { items: [] };
    const compressed = lzwCompress.pack(original);
    const decompressed = lzwCompress.unpack(compressed);
    expect(decompressed).toEqual(original);
  });

  it("compresses and decompresses mixed nested structures", () => {
    const original = {
      data: [
        { id: 1, tags: ["tag1", "tag2"] },
        { id: 2, tags: ["tag3", "tag4"] }
      ],
      meta: {
        count: 2,
        status: "active"
      }
    };
    const compressed = lzwCompress.pack(original);
    const decompressed = lzwCompress.unpack(compressed);
    expect(decompressed).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// Edge cases and error handling
// ---------------------------------------------------------------------------

describe("lzwCompress edge cases", () => {
  it("handles null input", () => {
    const result = lzwCompress.pack(null);
    expect(result).toBe(null);
    expect(lzwCompress.unpack(null)).toBe(null);
  });

  it("handles undefined input", () => {
    const result = lzwCompress.pack(undefined);
    expect(result).toBe(undefined);
    expect(lzwCompress.unpack(undefined)).toBe(undefined);
  });

  it("handles boolean true", () => {
    const result = lzwCompress.pack(true);
    expect(result).toBe(true);
    expect(lzwCompress.unpack(true)).toBe(true);
  });

  it("handles boolean false", () => {
    const compressed = lzwCompress.pack(false);
    const decompressed = lzwCompress.unpack(compressed);
    expect(compressed).toEqual([102, 97, 108, 115, 101]);
    expect(decompressed).toBe("false");
  });

  it("handles Date objects", () => {
    const date = new Date("2024-01-01");
    const result = lzwCompress.pack(date);
    expect(result).toBeInstanceOf(Date);
    expect(lzwCompress.unpack(date)).toBeInstanceOf(Date);
  });

  it("handles numbers by converting to strings", () => {
    const original = 12345;
    const compressed = lzwCompress.pack(original);
    const decompressed = lzwCompress.unpack(compressed);
    expect(decompressed).toBe("12345");
  });

  it("handles single character strings", () => {
    const original = "a";
    const compressed = lzwCompress.pack(original);
    const decompressed = lzwCompress.unpack(compressed);
    expect(decompressed).toBe(original);
  });

  it("handles strings with only repeated characters", () => {
    const original = "aaaaaaaaaa";
    const compressed = lzwCompress.pack(original);
    const decompressed = lzwCompress.unpack(compressed);
    expect(decompressed).toBe(original);
  });

  it("returns uncompressed data when compression would make it larger", () => {
    // Very short string where compression overhead exceeds benefit
    const original = "ab";
    const compressed = lzwCompress.pack(original);
    const decompressed = lzwCompress.unpack(compressed);
    expect(decompressed).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// Compression effectiveness tests
// ---------------------------------------------------------------------------

describe("lzwCompress compression effectiveness", () => {
  it("achieves compression on repetitive data", () => {
    const original = "TOBEORNOTTOBEORTOBEORNOT";
    const compressed = lzwCompress.pack(original);
    expect(Array.isArray(compressed)).toBe(true);
    expect(compressed.length).toBeLessThan(original.length);
  });

  it("compresses JSON data effectively", () => {
    const original = JSON.stringify({
      users: Array(10).fill({ name: "User", status: "active", role: "member" })
    });
    const compressed = lzwCompress.pack(original);
    expect(Array.isArray(compressed)).toBe(true);
    const compressionRatio = compressed.length / original.length;
    expect(compressionRatio).toBeLessThan(1);
  });

  it("maintains data integrity with large objects", () => {
    const original = {
      data: Array(100).fill(null).map((_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: "This is a description that repeats",
        active: true,
        tags: ["tag1", "tag2", "tag3"]
      }))
    };
    const compressed = lzwCompress.pack(original);
    const decompressed = lzwCompress.unpack(compressed);
    expect(decompressed).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// KeyOptimize functionality tests
// ---------------------------------------------------------------------------

describe("lzwCompress key optimization", () => {
  it("optimizes repeated keys in objects", () => {
    const original = {
      person1: { firstName: "John", lastName: "Doe", age: 30 },
      person2: { firstName: "Jane", lastName: "Smith", age: 25 },
      person3: { firstName: "Bob", lastName: "Johnson", age: 35 }
    };
    const compressed = lzwCompress.pack(original);
    const decompressed = lzwCompress.unpack(compressed);
    expect(decompressed).toEqual(original);
  });

  it("handles objects with many unique keys", () => {
    const original = Object.fromEntries(
      Array(50).fill(null).map((_, i) => [`key${i}`, `value${i}`])
    );
    const compressed = lzwCompress.pack(original);
    const decompressed = lzwCompress.unpack(compressed);
    expect(decompressed).toEqual(original);
  });

  it("preserves key order in decompressed objects", () => {
    const original = { z: 1, a: 2, m: 3, b: 4 };
    const compressed = lzwCompress.pack(original);
    const decompressed = lzwCompress.unpack(compressed);
    expect(Object.keys(decompressed)).toEqual(Object.keys(original));
  });
});

// ---------------------------------------------------------------------------
// Logging functionality tests
// ---------------------------------------------------------------------------

describe("lzwCompress logging", () => {
  it("enables and disables logging without errors", () => {
    expect(() => lzwCompress.enableLogging(true)).not.toThrow();
    expect(() => lzwCompress.enableLogging(false)).not.toThrow();
  });

  it("compresses data with logging enabled", () => {
    lzwCompress.enableLogging(true);
    const original = "test data";
    const compressed = lzwCompress.pack(original);
    const decompressed = lzwCompress.unpack(compressed);
    expect(decompressed).toBe(original);
    lzwCompress.enableLogging(false);
  });
});

// ---------------------------------------------------------------------------
// SCORM-specific use cases
// ---------------------------------------------------------------------------

describe("lzwCompress SCORM use cases", () => {
  it("compresses SCORM CMI data structure", () => {
    const cmiData = {
      "cmi.core.student_name": "John Doe",
      "cmi.core.lesson_status": "incomplete",
      "cmi.core.score.raw": "75",
      "cmi.core.score.min": "0",
      "cmi.core.score.max": "100",
      "cmi.suspend_data": "bookmark=page5;progress=50%",
      "cmi.interactions.0.id": "q1",
      "cmi.interactions.0.result": "correct",
      "cmi.interactions.1.id": "q2",
      "cmi.interactions.1.result": "incorrect"
    };
    const compressed = lzwCompress.pack(cmiData);
    const decompressed = lzwCompress.unpack(compressed);
    expect(decompressed).toEqual(cmiData);
  });

  it("compresses SCORM session data", () => {
    const sessionData = {
      slides: [
        { id: 1, viewed: true, timeSpent: 45 },
        { id: 2, viewed: true, timeSpent: 60 },
        { id: 3, viewed: false, timeSpent: 0 }
      ],
      quiz: {
        score: 80,
        attempts: 2,
        answers: ["a", "b", "c", "d"]
      }
    };
    const compressed = lzwCompress.pack(sessionData);
    const decompressed = lzwCompress.unpack(compressed);
    expect(decompressed).toEqual(sessionData);
  });

  it("handles large suspend_data strings", () => {
    const suspendData = JSON.stringify({
      progress: Array(100).fill(null).map((_, i) => ({
        page: i,
        status: "viewed",
        timestamp: Date.now()
      }))
    });
    const compressed = lzwCompress.pack(suspendData);
    const decompressed = lzwCompress.unpack(compressed);
    expect(decompressed).toBe(suspendData);
  });
});

// ---------------------------------------------------------------------------
// Round-trip stability tests
// ---------------------------------------------------------------------------

describe("lzwCompress round-trip stability", () => {
  it("maintains stability over multiple compress/decompress cycles", () => {
    let data = { test: "data", value: 123, nested: { key: "value" } };
    
    for (let i = 0; i < 5; i++) {
      const compressed = lzwCompress.pack(data);
      data = lzwCompress.unpack(compressed);
    }
    
    expect(data).toEqual({ test: "data", value: 123, nested: { key: "value" } });
  });

  it("handles alternating compression of different data types", () => {
    const string = "test string";
    const object = { key: "value" };
    
    const c1 = lzwCompress.pack(string);
    const c2 = lzwCompress.pack(object);
    
    expect(lzwCom