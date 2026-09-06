import { createServer } from "node:http";

import { createApp } from "./app";
import { registerProcessLifecycle } from "./common/lifecycle/shutdown";
import { buildInfo } from "./config/build-info";
import { env } from "./config/env";
import { logger } from "./config/logger";

const app = createApp();
const server = createServer(app);

server.on("error", (error: NodeJS.ErrnoException) => {
  logger.fatal({ err: error, port: env.PORT }, "Failed to start HTTP server");
  process.exit(1);
});

server.listen(env.PORT, () => {
  logger.info(
    {
      appName: env.APP_NAME,
      environment: env.NODE_ENV,
      ...buildInfo,
    },
    "Lily backend server started with resolved configuration",
  );
});

registerProcessLifecycle({
  server,
  logger,
  processLike: process,
});
