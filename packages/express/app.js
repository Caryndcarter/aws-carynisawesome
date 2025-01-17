import { echoRoute, EXPRESS, noContentRoute } from "jaypie";

import express from "express";

//
//
// Init
//

const app = express();

//
//
// Routing
//

// Return empty content for the site root
app.get(EXPRESS.PATH.ROOT, noContentRoute);
app.get(EXPRESS.PATH.ANY, echoRoute);

//
//
// Export
//

// API Gateway is listening and providing the request
// Express does not need to listen to a port
// app.listen(3000);
export default app;
