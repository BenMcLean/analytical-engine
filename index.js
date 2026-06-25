const Annunciator = require('./scripts/annunciator');
const Timing = require('./scripts/timing');
const Printer = require('./scripts/printer');
const CurveDrawingApparatus = require('./scripts/curvedrawing');
const Attendant = require('./scripts/attendant');
const Mill = require('./scripts/mill');
const Program = require('./scripts/program');
const Store = require('./scripts/store');
const Engine = require('./scripts/engine');
const StreamIO = require('./scripts/streamio');

exports.Annunciator = Annunciator;
exports.Timing = Timing;
exports.Printer = Printer;
exports.CurveDrawingApparatus = CurveDrawingApparatus;
exports.Attendant = Attendant;
exports.Mill = Mill;
exports.Program = Program;
exports.Store = Store;
exports.Engine = Engine;
exports.readTextStream = StreamIO.readTextStream;
exports.writeTextStream = StreamIO.writeTextStream;
exports.createUriLibraryReader = createUriLibraryReader;

function Interface(options) {
	options = options || {};

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
	if (options.executionHooks) {
		this.engine.setExecutionHooks(options.executionHooks);
	}
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
	this.engine.setExecutionHooks(hooks);
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

Interface.prototype.getOutputs = function() {
	return {
		attendantLog: this.annunciator.L_output,
		printer: this.printer.O_output,
		curveDrawingApparatus: this.curveDrawingApparatus.printScreen()
	};
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

exports.Interface = Interface;

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
