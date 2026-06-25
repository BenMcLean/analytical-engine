"use strict";

function readCardsSync() {
  throw new Error(
    "Node filesystem support is unavailable in this build. " +
      "Use submitProgramAsync() with a libraryReader, " +
      "submitProgramFromStream(), or provide libraryReaderSync()."
  );
}

module.exports = {
  readCardsSync: readCardsSync
};
