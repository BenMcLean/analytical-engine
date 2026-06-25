"use strict";

const fs = require("fs");
const path = require("path");

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

module.exports = {
  readCardsSync: readCardsSync
};
