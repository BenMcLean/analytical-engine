//  Program Cards

"use strict";

const debug = require("./debug");

//  Program display/editing panel

var loadButton;

function Program(c, att, cr, st, cda, t, eng) {
  this.cards = c;
  this.attendant = att;
  this.cardreader = cr;
  this.store = st;
  this.curvedraw = cda;
  this.timing = t;
  this.engine = eng;
  this.sourceInfo = null;
}

Program.prototype.clear = function() {
  this.cards = "";
};

Program.prototype.setSourceInfo = function(sourceInfo) {
  this.sourceInfo = sourceInfo || null;
};

Program.prototype.getSourceInfo = function() {
  if (this.sourceInfo) {
    return {
      sourceName: this.sourceInfo.sourceName || "Analyst",
      sourceUri: this.sourceInfo.sourceUri
    };
  }

  return {
    sourceName: "Analyst",
    sourceUri: null
  };
};

/*  Submit the contents of the Analyst's Program by
        passing lines to the attendant to be appended to
        the card chain. */
Program.prototype.submit0 = function(comments) {
  this.attendant.newCardChain();
  var lines = this.cards.split("\n");
  for (var i = 0; i < lines.length; i++) {
    this.attendant.appendCard(lines[i], "Analyst", 0);
  }
};

Program.prototype.submit1 = function(comments) {
  var stat = this.attendant.expandLibraryRequests(0);
  if (stat != 1) {
    this.attendant.examineCards(comments);
    this.cardreader.mountCards(this.attendant.deliverCardChain());
    //	    this.attendant.restart(); 	// Reset attendant modes to start
    this.engine.reset(); // Reset the engine
    this.engine.commence(); // Set up to run a new chain of cards
    //	    this.store.reset();     	// Clear the store
    //	    this.curvedraw.changePaper(); // Change paper in curve drawing apparatus
    this.timing.reset(); // Reset timing
  }
  return stat; // Return indication of pending library load
};

/*  Submit the contents of the Analyst's Program by
        passing lines to the attendant to be appended to
        the card chain. */
Program.prototype.submit = function(comments) {
  this.attendant.newCardChain();
  var sourceInfo = this.getSourceInfo();
  var lines = this.cards.replace(/\r\n/g, '\n').split("\n");
  for (var i = 0; i < lines.length; i++) {
    this.attendant.appendCard(lines[i], sourceInfo, i);
  }
  var stat = this.attendant.expandLibraryRequests(0);
  if (stat != 1) {
    this.attendant.examineCards(comments);
    this.cardreader.mountCards(this.attendant.deliverCardChain());
    //	    this.attendant.restart(); 	// Reset attendant modes to start
    this.engine.reset(); // Reset the engine
    this.engine.commence(); // Set up to run a new chain of cards
    //	    this.store.reset();     	// Clear the store
    //	    this.curvedraw.changePaper(); // Change paper in curve drawing apparatus
    this.timing.reset(); // Reset timing
  }
  return stat; // Return indication of pending library load
}

Program.prototype.submitAsync = async function(comments) {
  this.attendant.newCardChain();
  var sourceInfo = this.getSourceInfo();
  var lines = this.cards.replace(/\r\n/g, "\n").split("\n");
  for (var i = 0; i < lines.length; i++) {
    this.attendant.appendCard(lines[i], sourceInfo, i);
  }
  var stat = await this.attendant.expandLibraryRequestsAsync(0);
  if (stat != 1) {
    this.attendant.examineCards(comments);
    this.cardreader.mountCards(this.attendant.deliverCardChain());
    this.engine.reset();
    this.engine.commence();
    this.timing.reset();
  }
  return stat;
};

//  A single card

function Card(s, i, si) {
  this.text = s; // Contents of card
  this.index = i; // Index in chain of cards
  this.source = si; // Index in list of sources
}

Card.prototype.toString = function() {
  return (
    this.index +
    1 +
    ". (" +
    this.source.sourceName +
    ":" +
    (this.index - this.source.startIndex + 1) +
    ") " +
    this.text
  );
};

Card.prototype.getSourceLine = function() {
  return debug.getCardSourceLine(this);
};

Card.prototype.toDebugObject = function() {
  return debug.createCardSnapshot(this);
};

//  Card source index

function CardSource(sn, si, su) {
  this.sourceName = sn; // Card source (usually file name)
  this.startIndex = si; // First index from this source
  this.sourceUri = su || null; // Optional URI-ish identifier for editor integrations
}

//  The card reader

function CardReader(p, a, t) {
  this.panel = p; // Annunciator panel
  this.attendant = a; // Attendant
  this.timing = t; // Timing

  this.reset();
}

//  Clear card chain to void
CardReader.prototype.reset = function() {
  this.cards = []; // Card chain
  this.ncards = 0; // Number of cards
  this.nextCardNumber = 0; // Next card to read
};

//  Mount a chain of cards in the reader
CardReader.prototype.mountCards = function(cChain) {
  if (cChain) {
    this.reset();
  }
  if (cChain) {
    this.panel.mountCardReaderChain((this.cards = cChain));
    this.ncards = this.cards.length;
    this.firstCard();
  }
};

//  Rewind card chain to start
CardReader.prototype.firstCard = function() {
  this.nextCardNumber = 0;
};

//  Return next card from chain; advance chain
CardReader.prototype.nextCard = function() {
  if (this.nextCardNumber < this.ncards) {
    var c = this.cards[this.nextCardNumber++];
    this.timing.cardProcess();
    return c;
  } else {
    return null;
  }
};

CardReader.prototype.peekCard = function() {
  if (this.nextCardNumber < this.ncards) {
    return this.cards[this.nextCardNumber];
  }
  return null;
};

CardReader.prototype.currentCard = function() {
  if (this.nextCardNumber > 0 && this.nextCardNumber <= this.ncards) {
    return this.cards[this.nextCardNumber - 1];
  }
  return null;
};

CardReader.prototype.getState = function() {
  return {
    nextCardNumber: this.nextCardNumber,
    totalCards: this.ncards,
    currentCard: this.currentCard()
      ? this.currentCard().toDebugObject()
      : null,
    nextCard: this.peekCard() ? this.peekCard().toDebugObject() : null,
    cards: this.cards.map(function(card) {
      return card.toDebugObject();
    })
  };
};

CardReader.prototype.getDisplayState = function(contextBefore, windowSize) {
  var before = contextBefore === undefined ? 2 : contextBefore;
  var size = windowSize === undefined ? 5 : windowSize;
  var start = Math.max(this.nextCardNumber - before, 0);
  var visibleCards = [];

  for (var i = start; i < start + size && i < this.cards.length; i++) {
    visibleCards.push({
      isCurrent: i === this.nextCardNumber,
      card: this.cards[i].toDebugObject()
    });
  }

  return {
    currentIndex: this.nextCardNumber,
    visibleCards: visibleCards
  };
};

//  Advance the chain n cards.  Returns true if within
//  chain, false if we've run off the end.
CardReader.prototype.advance = function(n) {
  this.timing.cardAdvance(n);
  if (this.nextCardNumber + n >= this.ncards) {
    return false;
  }
  this.nextCardNumber += n;
  return true;
};

//  Back up the chain n cards.  Returns true if within
//  chain, false if we've run off the start.
CardReader.prototype.repeat = function(n) {
  this.timing.cardBack(n);
  if (this.nextCardNumber - n < 0) {
    return false;
  }
  this.nextCardNumber -= n;
  return true;
};

module.exports = {
  CardReader: CardReader,
  CardSource: CardSource,
  Card: Card,
  Program: Program
}
