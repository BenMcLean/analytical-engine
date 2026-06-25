"use strict";

function isReadableStream(value) {
  return value && typeof value.getReader === "function";
}

function isWritableStream(value) {
  return value && typeof value.getWriter === "function";
}

function normalizeText(text) {
  return text.replace(/\r\n/g, "\n");
}

async function readTextStream(stream) {
  if (typeof stream === "string") {
    return normalizeText(stream);
  }

  if (stream && typeof stream.read === "function") {
    return normalizeText(await stream.read());
  }

  if (isReadableStream(stream)) {
    var reader = stream.getReader();
    var decoder = new TextDecoder();
    var text = "";

    try {
      while (true) {
        var result = await reader.read();
        if (result.done) {
          break;
        }
        text += typeof result.value === "string"
          ? result.value
          : decoder.decode(result.value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      if (typeof reader.releaseLock === "function") {
        reader.releaseLock();
      }
    }

    return normalizeText(text);
  }

  if (stream && typeof stream[Symbol.asyncIterator] === "function") {
    var asyncText = "";
    var asyncDecoder = new TextDecoder();

    for await (var chunk of stream) {
      asyncText += typeof chunk === "string"
        ? chunk
        : asyncDecoder.decode(chunk, { stream: true });
    }
    asyncText += asyncDecoder.decode();
    return normalizeText(asyncText);
  }

  throw new TypeError("Unsupported readable stream source.");
}

async function writeTextStream(stream, text) {
  if (!stream) {
    throw new TypeError("A writable stream destination is required.");
  }

  if (typeof stream.write === "function") {
    await stream.write(text);
    if (typeof stream.close === "function") {
      await stream.close();
    } else if (typeof stream.end === "function") {
      stream.end();
    }
    return;
  }

  if (isWritableStream(stream)) {
    var writer = stream.getWriter();
    try {
      await writer.write(text);
      await writer.close();
    } finally {
      if (typeof writer.releaseLock === "function") {
        writer.releaseLock();
      }
    }
    return;
  }

  throw new TypeError("Unsupported writable stream destination.");
}

export { normalizeText, readTextStream, writeTextStream };
