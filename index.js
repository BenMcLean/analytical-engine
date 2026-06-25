import Annunciator from './scripts/annunciator.js';
import Timing from './scripts/timing.js';
import Printer from './scripts/printer.js';
import CurveDrawingApparatus from './scripts/curvedrawing.js';
import Attendant from './scripts/attendant.js';
import Mill from './scripts/mill.js';
import * as Program from './scripts/program.js';
import Store from './scripts/store.js';
import Engine from './scripts/engine.js';
import * as StreamIO from './scripts/streamio.js';
import * as debug from './scripts/debug.js';

export {
	Annunciator,
	Timing,
	Printer,
	CurveDrawingApparatus,
	Attendant,
	Mill,
	Program,
	Store,
	Engine
};
export const readTextStream = StreamIO.readTextStream;
export const writeTextStream = StreamIO.writeTextStream;
export { createUriLibraryReader, DebuggerSession };

function Interface(options) {
	options = options || {};
	this.breakpointId = 0;
	this.breakpoints = [];
	this.lastDebugEvent = null;
	this.externalExecutionHooks = options.executionHooks || null;

	// Annunciator
	this.annunciator = new Annunciator();

	//  Timing
	this.timing = new Timing();

	//  Printer
	this.printer = new Printer();

	//  Curve Drawing Apparatus
	this.curveDrawingApparatus = new CurveDrawingApparatus(512, 512);

	//  Attendant
	this.attendant = new Attendant(this.annunciator, this.timing);
	this.attendant.setLibraryTemplate("Library/$.ae");
	if (options.libraryReader) {
		this.attendant.setLibraryReader(options.libraryReader);
	}
	if (options.libraryReaderSync) {
		this.attendant.setLibraryReaderSync(options.libraryReaderSync);
	}

	//  Mill
	this.mill = new Mill(this.annunciator, this.attendant, this.timing);

	//  Card Reader
	this.cardReader = new Program.CardReader(this.annunciator, this.attendant, this.timing);

	//  Store
	this.store = new Store(this.annunciator, this.attendant, this.timing);

	//  Engine
	this.engine = new Engine(this.annunciator, this.attendant, this.mill, this.store, this.cardReader, this.printer, this.curveDrawingApparatus);
	this.installExecutionHooks();
}

Interface.prototype.clearState = function() {
	this.engine.commence();
	this.timing.reset();
}

Interface.prototype.createProgram = function(cards, options) {
	options = options || {};
	this.program = new Program.Program(cards, this.attendant, this.cardReader, this.store, this.curveDrawingApparatus, this.timing, this.engine);
	if (options.sourceName || options.sourceUri) {
		this.program.setSourceInfo({
			sourceName: options.sourceName,
			sourceUri: options.sourceUri
		});
	}
	return this.program;
}

Interface.prototype.setExecutionHooks = function(hooks) {
	this.externalExecutionHooks = hooks || null;
	this.installExecutionHooks();
}

Interface.prototype.installExecutionHooks = function() {
	var self = this;

	this.engine.setExecutionHooks({
		beforeCard: function(card, engine) {
			var matchedBreakpoint = self.findMatchingBreakpoint(card);
			if (matchedBreakpoint) {
				self.lastDebugEvent = {
					type: 'breakpoint',
					breakpoint: matchedBreakpoint,
					card: debug.createCardSnapshot(card)
				};
				return false;
			}

			if (
				self.externalExecutionHooks &&
				typeof self.externalExecutionHooks.beforeCard === 'function'
			) {
				return self.externalExecutionHooks.beforeCard(card, engine);
			}

			return true;
		},
		afterCard: function(card, engine, status) {
			self.lastDebugEvent = {
				type: status.errorDetected ? 'error' : status.halted ? 'halt' : 'step',
				card: debug.createCardSnapshot(card),
				status: status
			};

			if (
				self.externalExecutionHooks &&
				typeof self.externalExecutionHooks.afterCard === 'function'
			) {
				self.externalExecutionHooks.afterCard(card, engine, status);
			}
		}
	});
}

Interface.prototype.submitProgram = function(cards, options) {
	this.createProgram(cards, options);
	return this.program.submit();
}

Interface.prototype.submitProgramAsync = async function(cards, options) {
	this.createProgram(cards, options);
	return await this.program.submitAsync();
}

Interface.prototype.submitProgramFromStream = async function(stream, options) {
	return await this.submitProgramAsync(await StreamIO.readTextStream(stream), options);
}

Interface.prototype.runToCompletion = function() {
	//library loads gave no errors, run the program
	this.annunciator.setOverride(true);
	this.engine.start();
	this.annunciator.setOverride(false);
	while(this.engine.processCard()) {}
	this.annunciator.setOverride(true);
	this.engine.halt();
	this.annunciator.setOverride(false);
}

Interface.prototype.start = function() {
	this.engine.start();
}

Interface.prototype.pause = function() {
	this.engine.halt();
}

Interface.prototype.step = function() {
	if (!this.engine.isRunning()) {
		this.engine.start();
	}
	var progressed = this.engine.processCard();
	if (this.engine.isRunning()) {
		this.engine.halt();
	}
	return {
		progressed: progressed,
		event: this.lastDebugEvent,
		state: this.getDebugState()
	};
}

Interface.prototype.stepCards = function(count) {
	var steps = [];
	for (var i = 0; i < count; i++) {
		var result = this.step();
		steps.push(result);
		if (!result.progressed) {
			break;
		}
	}
	return steps;
}

Interface.prototype.runUntilPause = function(limit) {
	var steps = 0;
	this.engine.start();
	while ((limit === undefined || steps < limit) && this.engine.processCard()) {
		steps++;
	}
	if (this.engine.isRunning()) {
		this.engine.halt();
	}
	return {
		steps: steps,
		event: this.lastDebugEvent,
		state: this.getDebugState()
	};
}

Interface.prototype.resume = function(limit) {
	return this.runUntilPause(limit);
}

Interface.prototype.getOutputs = function() {
	return {
		attendantLog: this.annunciator.L_output,
		printer: this.printer.O_output,
		curveDrawingApparatus: this.curveDrawingApparatus.printScreen()
	};
}

Interface.prototype.getCurrentCard = function() {
	return debug.createCardSnapshot(this.engine.getCurrentCard());
}

Interface.prototype.getNextCard = function() {
	return debug.createCardSnapshot(this.engine.getNextCard());
}

Interface.prototype.getDisplayState = function() {
	return {
		mill: this.mill.getState(),
		store: this.store.getDisplayState(),
		cardReader: this.cardReader.getDisplayState(),
		outputs: this.getOutputs(),
		annunciator: this.annunciator.getState()
	};
}

Interface.prototype.getDebugState = function() {
	return {
		engine: this.engine.getState(),
		mill: this.mill.getState(),
		store: this.store.getState(),
		cardReader: this.cardReader.getState(),
		timing: this.timing.getState(),
		annunciator: this.annunciator.getState(),
		outputs: this.getOutputs(),
		breakpoints: this.getBreakpoints(),
		lastEvent: this.lastDebugEvent
	};
}

Interface.prototype.getLastDebugEvent = function() {
	return this.lastDebugEvent;
}

Interface.prototype.addBreakpoint = function(breakpoint) {
	var normalized = normalizeBreakpoint(++this.breakpointId, breakpoint);
	this.breakpoints.push(normalized);
	return normalized;
}

Interface.prototype.setBreakpoints = function(breakpoints) {
	this.breakpoints = [];
	for (var i = 0; i < breakpoints.length; i++) {
		this.addBreakpoint(breakpoints[i]);
	}
	return this.getBreakpoints();
}

Interface.prototype.getBreakpoints = function() {
	return this.breakpoints.slice();
}

Interface.prototype.clearBreakpoints = function() {
	this.breakpoints = [];
}

Interface.prototype.removeBreakpoint = function(id) {
	this.breakpoints = this.breakpoints.filter(function(breakpoint) {
		return breakpoint.id !== id;
	});
}

Interface.prototype.findMatchingBreakpoint = function(card) {
	for (var i = 0; i < this.breakpoints.length; i++) {
		if (cardMatchesBreakpoint(card, this.breakpoints[i])) {
			return this.breakpoints[i];
		}
	}
	return null;
}

Interface.prototype.writeOutputsToStream = async function(streams) {
	streams = streams || {};
	var outputs = this.getOutputs();

	if (streams.attendantLog) {
		await StreamIO.writeTextStream(streams.attendantLog, outputs.attendantLog);
	}
	if (streams.printer) {
		await StreamIO.writeTextStream(streams.printer, outputs.printer);
	}
	if (streams.curveDrawingApparatus) {
		await StreamIO.writeTextStream(streams.curveDrawingApparatus, outputs.curveDrawingApparatus);
	}

	return outputs;
}

function createUriLibraryReader(options) {
	options = options || {};
	var textDecoder = options.textDecoder || new TextDecoder();

	function decodeText(contents) {
		if (typeof contents === "string") {
			return contents;
		}
		return textDecoder.decode(contents);
	}

	return async function(request) {
		var resolved = request.kind === "system"
			? await options.resolveSystemUri(request)
			: await options.resolveUserUri(request);
		var contents = await options.readFile(resolved, request);
		return {
			text: decodeText(contents),
			sourceName: request.name + " [Library]",
			sourceUri: resolved && typeof resolved.toString === "function"
				? resolved.toString()
				: resolved
		};
	};
}

function normalizeBreakpoint(id, breakpoint) {
	breakpoint = breakpoint || {};
	return {
		id: breakpoint.id || id,
		enabled: breakpoint.enabled !== false,
		sourceUri: breakpoint.sourceUri || null,
		sourceName: breakpoint.sourceName || null,
		sourceLine: breakpoint.sourceLine || null,
		cardIndex: breakpoint.cardIndex !== undefined ? breakpoint.cardIndex : null,
		text: breakpoint.text || null
	};
}

function cardMatchesBreakpoint(card, breakpoint) {
	if (!card || !breakpoint) {
		return false;
	}
	if (breakpoint.enabled === false) {
		return false;
	}

	if (breakpoint.sourceUri && (!card.source || card.source.sourceUri !== breakpoint.sourceUri)) {
		return false;
	}
	if (breakpoint.sourceName && (!card.source || card.source.sourceName !== breakpoint.sourceName)) {
		return false;
	}
	if (breakpoint.sourceLine !== null && card.getSourceLine() !== breakpoint.sourceLine) {
		return false;
	}
	if (breakpoint.cardIndex !== null && card.index !== breakpoint.cardIndex) {
		return false;
	}
	if (breakpoint.text && card.text !== breakpoint.text) {
		return false;
	}

	return true;
}

function DebuggerSession(options) {
	options = options || {};
	this.interface = options.interface || new Interface(options);
}

DebuggerSession.prototype.submitProgram = function(cards, options) {
	return this.interface.submitProgram(cards, options);
}

DebuggerSession.prototype.submitProgramAsync = function(cards, options) {
	return this.interface.submitProgramAsync(cards, options);
}

DebuggerSession.prototype.submitProgramFromStream = function(stream, options) {
	return this.interface.submitProgramFromStream(stream, options);
}

DebuggerSession.prototype.step = function() {
	return this.interface.step();
}

DebuggerSession.prototype.stepCards = function(count) {
	return this.interface.stepCards(count);
}

DebuggerSession.prototype.runUntilPause = function(limit) {
	return this.interface.runUntilPause(limit);
}

DebuggerSession.prototype.resume = function(limit) {
	return this.interface.resume(limit);
}

DebuggerSession.prototype.start = function() {
	return this.interface.start();
}

DebuggerSession.prototype.pause = function() {
	return this.interface.pause();
}

DebuggerSession.prototype.getState = function() {
	return this.interface.getDebugState();
}

DebuggerSession.prototype.getDisplayState = function() {
	return this.interface.getDisplayState();
}

DebuggerSession.prototype.getInterface = function() {
	return this.interface;
}

DebuggerSession.prototype.getLastDebugEvent = function() {
	return this.interface.getLastDebugEvent();
}

DebuggerSession.prototype.getCurrentCard = function() {
	return this.interface.getCurrentCard();
}

DebuggerSession.prototype.getNextCard = function() {
	return this.interface.getNextCard();
}

DebuggerSession.prototype.addBreakpoint = function(breakpoint) {
	return this.interface.addBreakpoint(breakpoint);
}

DebuggerSession.prototype.setBreakpoints = function(breakpoints) {
	return this.interface.setBreakpoints(breakpoints);
}

DebuggerSession.prototype.getBreakpoints = function() {
	return this.interface.getBreakpoints();
}

DebuggerSession.prototype.clearBreakpoints = function() {
	return this.interface.clearBreakpoints();
}

DebuggerSession.prototype.removeBreakpoint = function(id) {
	return this.interface.removeBreakpoint(id);
}

export { Interface };

export default {
	Annunciator,
	Timing,
	Printer,
	CurveDrawingApparatus,
	Attendant,
	Mill,
	Program,
	Store,
	Engine,
	Interface,
	DebuggerSession,
	readTextStream,
	writeTextStream,
	createUriLibraryReader
};
