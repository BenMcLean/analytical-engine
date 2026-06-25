"use strict";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readCardsSync(request) {
  if (request.kind == "system") {
    return fs.readFileSync(path.resolve(__dirname, "..", request.path), {
      encoding: "utf8"
    });
  }

  return fs.readFileSync(path.resolve(".", request.path), {
    encoding: "utf8"
  });
}

export { readCardsSync };
