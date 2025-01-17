import { describe, expect, it } from "vitest";

// Subject
import { handler } from "../worker.js";

//
//
// Mock constants
//

//
//
// Mock modules
//

//
//
// Mock environment
//

// afterEach(() => {
//   vi.clearAllMocks();
// });

//
//
// Run tests
//

describe("Worker", () => {
  it("Works", async () => {
    const response = await handler();
    // eslint-disable-next-line no-console
    console.log("response :>> ", response);
    expect(response).not.toBeUndefined();
  });
});
