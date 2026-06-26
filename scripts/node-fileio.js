"use strict";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function getModuleDirectory() {
  if (typeof import.meta === "undefined" || !import.meta.url) {
    return null;
  }

  return path.dirname(fileURLToPath(import.meta.url));
}

function tryResolveRelativeToSource(request) {
  if (!request.sourceUri) {
    return null;
  }

  const sourceUrl = new URL(request.sourceUri);
  if (sourceUrl.protocol !== "file:") {
    return null;
  }

  return path.resolve(path.dirname(fileURLToPath(sourceUrl)), request.path);
}

function resolveSystemPath(request) {
  const moduleDirectory = getModuleDirectory();

  if (!moduleDirectory) {
    throw new Error(
      "Node filesystem support is unavailable in this build. " +
        "Use submitProgramAsync() with a libraryReader, " +
        "submitProgramFromStream(), or provide libraryReaderSync()."
    );
  }

  const userOverridePath = tryResolveRelativeToSource(request) || path.resolve(".", request.path);
  if (fs.existsSync(userOverridePath)) {
    return userOverridePath;
  }

  return path.resolve(moduleDirectory, "..", request.path);
}

function resolveUserPath(request) {
  return tryResolveRelativeToSource(request) || path.resolve(".", request.path);
}

function toLibraryResponse(request, resolvedPath) {
  const relativePath = path.relative(".", resolvedPath);
  const sourceName =
    request.kind == "system" && relativePath === request.path
      ? `${request.name} [Library]`
      : relativePath;

  return {
    text: fs.readFileSync(resolvedPath, { encoding: "utf8" }),
    sourceName,
    sourceUri: pathToFileURL(resolvedPath).toString()
  };
}

function readCardsSync(request) {
  if (request.kind == "system") {
    return toLibraryResponse(request, resolveSystemPath(request));
  }

  return toLibraryResponse(request, resolveUserPath(request));
}

export { readCardsSync };
