"use strict";

function toDebugValue(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "object" && typeof value.toString === "function") {
    if (
      typeof value.add === "function" &&
      typeof value.multiply === "function" &&
      typeof value.isZero === "function"
    ) {
      return value.toString();
    }
  }

  if (Array.isArray(value)) {
    return value.map(toDebugValue);
  }

  return value;
}

function getCardSourceLine(card) {
  if (!card || !card.source) {
    return null;
  }

  return card.index - card.source.startIndex + 1;
}

function createCardSnapshot(card) {
  if (!card) {
    return null;
  }

  return {
    text: card.text,
    cardIndex: card.index,
    chainIndex: card.index,
    sourceName: card.source ? card.source.sourceName : null,
    sourceUri: card.source ? card.source.sourceUri : null,
    sourceLine: getCardSourceLine(card)
  };
}

export { toDebugValue, getCardSourceLine, createCardSnapshot };
