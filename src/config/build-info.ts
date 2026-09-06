import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { env } from "./env";

// Both source and build output config directories are located two levels below the project root, avoiding dependency on the working directory.
const { version } = JSON.parse(
  readFileSync(resolve(__dirname, "../../package.json"), "utf8"),
) as { version: string };

export const buildInfo = {
  version,
  ...(env.BUILD_COMMIT ? { commit: env.BUILD_COMMIT } : {}),
};
