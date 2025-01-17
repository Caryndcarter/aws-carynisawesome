import { log, lambdaHandler } from "jaypie";

//
//
// Helper Functions
//

//
//
// Handler
//

export const handler = lambdaHandler(
  // eslint-disable-next-line no-unused-vars
  async (event, context) => {
    log.debug("Hello, world");
    return "Hello, world";
  },
  { name: "hello" },
);
