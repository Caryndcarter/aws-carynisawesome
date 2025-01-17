import { describe, expect, it } from "vitest";

import handler from "../index.js";

//
//
// Run tests
//

describe("Express Backend", () => {
  describe("index", () => {
    it("Works", () => {
      expect(handler).toBeFunction();
    });
  });
});
