import { getHeaderFrom, HTTP } from "jaypie";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Subject
import app from "../app.js";

//
//
// Mock environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
});
afterEach(() => {
  process.env = DEFAULT_ENV;
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("Express Backend", () => {
  describe("app", () => {
    it("Is a function", () => {
      expect(app).toBeFunction();
    });
    it("Works", async () => {
      const res = await request(app).get("/");
      expect(res.statusCode).toEqual(HTTP.CODE.NO_CONTENT);
      expect(res.body).toEqual({}); // The body is actually empty
    });
    it("Returns project headers", async () => {
      process.env.PROJECT_ENV = "MOCK_ENV";
      process.env.PROJECT_KEY = "MOCK_KEY";

      const res = await request(app).get("/");

      expect(getHeaderFrom(HTTP.HEADER.POWERED_BY, res)).toBeDefined();
      expect(getHeaderFrom(HTTP.HEADER.POWERED_BY, res)).not.toBe("Express");
      expect(getHeaderFrom(HTTP.HEADER.PROJECT.ENVIRONMENT, res)).toBe(
        "MOCK_ENV",
      );
      expect(getHeaderFrom(HTTP.HEADER.PROJECT.KEY, res)).toBe("MOCK_KEY");

      // * This doesn't work in test because there is no AWS invocation to return
      // * We could mock that, but that would be testing something we assume @jaypie/express does correctly
      // expect(res.header[HTTP.HEADER.PROJECT.INVOCATION]).toBeDefined();
    });
  });
});
