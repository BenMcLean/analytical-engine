"use strict";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function getModuleDirectory() {
  if (typeof import.meta === "undefined" || !import.meta.url) {
    return null;
  }

  return path.dirname(fileURLToPath(import.meta.url));
}

function readCardsSync(request) {
  if (request.kind == "system") {
    const moduleDirectory = getModuleDirectory();

    if (!moduleDirectory) {
      throw new Error(
        "Node filesystem support is unavailable in this build. " +
          "Use submitProgramAsync() with a libraryReader, " +
          "submitProgramFromStream(), or provide libraryReaderSync()."
      );
    }

    return fs.readFileSync(path.resolve(moduleDirectory, "..", request.path), {
      encoding: "utf8"
    });
  }

  return fs.readFileSync(path.resolve(".", request.path), {
    encoding: "utf8"
  });
}

export { readCardsSync };
