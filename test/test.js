import test from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import AE from '../index.js';
import * as noNodeFileIO from '../scripts/no-node-fileio.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('clear state test', async () => {
	let eng = new AE.Interface();
	let cards = `N000 1
N001 2
+
L000
L001
S002`;

	eng.submitProgram(cards);
	eng.runToCompletion();

	assert.equal(eng.store.get(2).value, 3n);
	assert.equal(eng.mill.egress[0].value, 3n);
	assert.notEqual(eng.mill.operation, 0);

	eng.clearState();

	assert.equal(eng.store.get(2).value, 0n);
	assert.equal(eng.mill.egress[0].value, 0n);
	assert.equal(eng.mill.operation, 0);
});

test('addition test', async () => {
	let eng = new AE.Interface();
	let cards = `N000 1
N001 2
+
L000
L001
S002`;

	eng.submitProgram(cards);
	eng.runToCompletion();
	assert.equal(eng.store.get(2).value, 3n);
});

test('sqrt test', async () => {
	let eng = new AE.Interface();
	let cards = `A set decimal places to 5
N000 4.0
A include from library cards for sqrt`;

	eng.submitProgram(cards);
	eng.runToCompletion();

	assert.equal(eng.store.get(0).value, 200000n);
});

test('custom function test', async () => {
	let eng = new AE.Interface();
	let cards = `N000 4
A include cards test/addtwo`;

	eng.submitProgram(cards);
	eng.runToCompletion();

	assert.equal(eng.store.get(0).value, 6n);
});

test('relative user includes resolve from the including file source uri', async () => {
	const fixtureRoot = path.join(__dirname, '.tmp-relative-user-include');
	const nestedDir = path.join(fixtureRoot, 'programs', 'math');
	const helperDir = path.join(nestedDir, 'helpers');
	const mainPath = path.join(nestedDir, 'main.ae');
	const helperPath = path.join(helperDir, 'addtwo.ae');

	fs.rmSync(fixtureRoot, { recursive: true, force: true });
	fs.mkdirSync(helperDir, { recursive: true });
	fs.writeFileSync(mainPath, `N000 4
A include cards helpers/addtwo`);
	fs.writeFileSync(helperPath, `N001 2
+
L000
L001
S000`);

	try {
		let eng = new AE.Interface();
		const cards = fs.readFileSync(mainPath, 'utf8');

		eng.submitProgram(cards, {
			sourceName: 'main.ae',
			sourceUri: pathToFileURL(mainPath).toString()
		});
		eng.runToCompletion();

		assert.equal(eng.store.get(0).value, 6n);
	} finally {
		fs.rmSync(fixtureRoot, { recursive: true, force: true });
	}
});

test('library includes prefer a local Library override before the packaged library', async () => {
	const fixtureRoot = path.join(__dirname, '.tmp-library-override');
	const programDir = path.join(fixtureRoot, 'programs');
	const libraryDir = path.join(programDir, 'Library');
	const mainPath = path.join(programDir, 'main.ae');
	const overridePath = path.join(libraryDir, 'override_test.ae');

	fs.rmSync(fixtureRoot, { recursive: true, force: true });
	fs.mkdirSync(libraryDir, { recursive: true });
	fs.writeFileSync(mainPath, `N000 4
A include from library cards for override_test`);
	fs.writeFileSync(overridePath, `N001 2
+
L000
L001
S000`);

	try {
		let eng = new AE.Interface();
		const cards = fs.readFileSync(mainPath, 'utf8');

		eng.submitProgram(cards, {
			sourceName: 'main.ae',
			sourceUri: pathToFileURL(mainPath).toString()
		});
		eng.runToCompletion();

		assert.equal(eng.store.get(0).value, 6n);
	} finally {
		fs.rmSync(fixtureRoot, { recursive: true, force: true });
	}
});

test('combinatorial cards test', async () => {
	let eng = new AE.Interface();
	let cards = `N0 6
N1 1
N2 1
*
L1
L0
S1
-
L0
L2
S0
L2
L0
CB?11`;

	eng.submitProgram(cards);
	eng.runToCompletion();

	assert.equal(eng.store.get(1).value, 720n);
});

test('combinatorial cards shorthand test', async () => {
	let eng = new AE.Interface();
	let cards = `N0 7
N1 1
N2 1
(?
*
L1
L0
S1
-
L0
L2
S0
L2
L0
)`;

	eng.submitProgram(cards);
	eng.runToCompletion();

	assert.equal(eng.store.get(1).value, 5040n);
});

test('drawing test', async () => {
	let eng = new AE.Interface();
	let emptySvg = '<svg viewBox="0 0 512 512" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"></svg>';

	let cards = `        Iteration variable
N000 -10000000000000000000000000

        Step
N001 100000000000000000000000

        Number of steps
N002    201

        Constants
N003    1
N004    0

+
L000
DX
*
L000
L000
>25
S005
L000
L005
>25
DY
D+
+
L000
L001
S000
-
L002
L003
S002
L004
L002
CB?24`;

	assert.equal(eng.curveDrawingApparatus.printScreen(), emptySvg);

	eng.submitProgram(cards);
	eng.runToCompletion();

	let svg = eng.curveDrawingApparatus.printScreen();
	assert.notEqual(svg, emptySvg);
	assert.match(svg, /^<svg viewBox="0 0 512 512" preserveAspectRatio="xMidYMid meet" xmlns="http:\/\/www\.w3\.org\/2000\/svg">/);
	assert.match(svg, /<polyline /);
});

test('async stream submission test', async () => {
	let eng = new AE.Interface();
	let cards = `N000 1
N001 2
+
L000
L001
S002`;

	await eng.submitProgramFromStream({
		read: async () => cards.slice(0, 8) + cards.slice(8)
	});
	eng.runToCompletion();

	assert.equal(eng.store.get(2).value, 3n);
});

test('async library reader test', async () => {
	let eng = new AE.Interface({
		libraryReader: async request => {
			if (request.kind === 'user' && request.path === 'test/addtwo.ae') {
				return `N001 2
+
L000
L001
S000`;
			}

			throw new Error(`Unexpected request: ${request.path}`);
		}
	});

	let cards = `N000 4
A include cards test/addtwo`;

	await eng.submitProgramAsync(cards);
	eng.runToCompletion();

	assert.equal(eng.store.get(0).value, 6n);
});

test('write outputs to stream test', async () => {
	let eng = new AE.Interface();
	let cards = `N000 1
P`;

	eng.submitProgram(cards);
	eng.runToCompletion();

	let writes = {
		attendantLog: '',
		printer: '',
		curveDrawingApparatus: ''
	};

	let outputs = await eng.writeOutputsToStream({
		attendantLog: { write: async text => { writes.attendantLog = text; } },
		printer: { write: async text => { writes.printer = text; } },
		curveDrawingApparatus: { write: async text => { writes.curveDrawingApparatus = text; } }
	});

	assert.equal(writes.attendantLog, outputs.attendantLog);
	assert.equal(writes.printer, outputs.printer);
	assert.equal(writes.curveDrawingApparatus, outputs.curveDrawingApparatus);
});

test('uri library reader helper test', async () => {
	let reader = AE.createUriLibraryReader({
		resolveSystemUri: async request => `mem:/system/${request.path}`,
		resolveUserUri: async request => `mem:/user/${request.path}`,
		readFile: async uri => new TextEncoder().encode(`. ${uri}`)
	});

	let userLibrary = await reader({ kind: 'user', name: 'addtwo', path: 'test/addtwo.ae' });
	let systemLibrary = await reader({ kind: 'system', name: 'sqrt', path: 'Library/sqrt.ae' });

	assert.equal(userLibrary.sourceUri, 'mem:/user/test/addtwo.ae');
	assert.equal(systemLibrary.text, '. mem:/system/Library/sqrt.ae');
});

test('uri library reader helper prefers a user Library override before system library cards', async () => {
	let reader = AE.createUriLibraryReader({
		resolveSystemUri: async request => `mem:/system/${request.path}`,
		resolveUserUri: async request => `mem:/workspace/project/${request.path}`,
		readFile: async uri => {
			if (uri === 'mem:/workspace/project/Library/sqrt.ae') {
				return new TextEncoder().encode('. user override');
			}

			return new TextEncoder().encode(`. ${uri}`);
		}
	});

	let systemLibrary = await reader({
		kind: 'system',
		name: 'sqrt',
		path: 'Library/sqrt.ae',
		sourceName: 'program.ae',
		sourceUri: 'mem:/workspace/project/program.ae'
	});

	assert.equal(systemLibrary.text, '. user override');
	assert.equal(systemLibrary.sourceUri, 'mem:/workspace/project/Library/sqrt.ae');
});

test('execution hooks can halt before a card executes', async () => {
	let seen = [];
	let eng = new AE.Interface({
		executionHooks: {
			beforeCard: currentCard => {
				seen.push({
					text: currentCard.text,
					sourceName: currentCard.source.sourceName,
					sourceUri: currentCard.source.sourceUri
				});
				return currentCard.text !== '+';
			}
		}
	});

	let cards = `N000 1
N001 2
+
L000
L001
S002`;

	await eng.submitProgramAsync(cards, {
		sourceName: 'program.ae',
		sourceUri: 'mem:/workspace/program.ae'
	});
	eng.runToCompletion();

	assert.deepEqual(seen.map(card => card.text), ['N000 1', 'N001 2', '+']);
	assert.equal(seen[0].sourceUri, 'mem:/workspace/program.ae');
});

test('browser-safe filesystem stub throws a clear error', async () => {
	assert.throws(
		() => noNodeFileIO.readCardsSync({ kind: 'system', path: 'Library/sqrt.ae' }),
		/error.*unavailable|unavailable.*build/i
	);
});

test('esm entrypoint exposes the public api', async () => {
	const esm = await import('../index.js');

	assert.equal(typeof esm.default.Interface, 'function');
	assert.equal(esm.Interface, esm.default.Interface);
	assert.equal(typeof esm.createUriLibraryReader, 'function');
});

test('cli help exits successfully', async () => {
	const cliPath = path.resolve(__dirname, '..', 'analytical-engine');
	const output = childProcess.execFileSync(process.execPath, [cliPath, '--help'], {
		encoding: 'utf8'
	});

	assert.match(output, /Usage: .* filename/);
});

test('cli passes source uri so relative includes resolve from the program directory', async () => {
	const fixtureRoot = path.join(__dirname, '.tmp-cli-relative-include');
	const nestedDir = path.join(fixtureRoot, 'programs', 'math');
	const helperDir = path.join(nestedDir, 'helpers');
	const mainPath = path.join(nestedDir, 'main.ae');
	const helperPath = path.join(helperDir, 'addtwo.ae');
	const cliPath = path.resolve(__dirname, '..', 'analytical-engine');

	fs.rmSync(fixtureRoot, { recursive: true, force: true });
	fs.mkdirSync(helperDir, { recursive: true });
	fs.writeFileSync(mainPath, `N000 4
A include cards helpers/addtwo
P`);
	fs.writeFileSync(helperPath, `N001 2
+
L000
L001
S000`);

	try {
		const output = childProcess.execFileSync(process.execPath, [cliPath, mainPath], {
			encoding: 'utf8',
			cwd: __dirname
		});

		assert.match(output, /Printer:\n6\n/);
	} finally {
		fs.rmSync(fixtureRoot, { recursive: true, force: true });
	}
});

test('debugger api can step card by card and expose structured state', async () => {
	const session = new AE.DebuggerSession();
	await session.submitProgramAsync(`N000 1
N001 2
+
L000
L001
S002`, {
		sourceName: 'program.ae',
		sourceUri: 'mem:/workspace/program.ae'
	});

	const firstStep = session.step();
	assert.equal(firstStep.progressed, true);
	assert.equal(firstStep.state.engine.currentCard.text, 'N000 1');
	assert.equal(firstStep.state.engine.currentCard.sourceUri, 'mem:/workspace/program.ae');

	const displayState = session.interface.getDisplayState();
	assert.equal(displayState.cardReader.visibleCards[0].card.text, 'N000 1');
	assert.equal(Array.isArray(displayState.store.columns), true);
});

test('debugger breakpoints can stop by source uri and line', async () => {
	const session = new AE.DebuggerSession();
	await session.submitProgramAsync(`N000 1
N001 2
+
L000
L001
S002`, {
		sourceName: 'program.ae',
		sourceUri: 'mem:/workspace/program.ae'
	});

	session.addBreakpoint({
		sourceUri: 'mem:/workspace/program.ae',
		sourceLine: 3
	});

	const result = session.runUntilPause();
	assert.equal(result.event.type, 'breakpoint');
	assert.equal(result.state.engine.currentCard.text, '+');
	assert.equal(result.state.engine.lastStopReason, 'breakpoint');
});

test('debugger session can wrap and expose an existing interface', async () => {
	const existingInterface = new AE.Interface();
	const session = new AE.DebuggerSession({ interface: existingInterface });

	assert.equal(session.getInterface(), existingInterface);

	await session.submitProgramAsync(`N000 1
N001 2
+
L000
L001
S002`);

	session.stepCards(6);
	assert.equal(existingInterface.store.get(2).value, 3n);
});

test('disabled breakpoints do not pause execution and resume aliases runUntilPause', async () => {
	const session = new AE.DebuggerSession();
	await session.submitProgramAsync(`N000 1
N001 2
+
L000
L001
S002`, {
		sourceName: 'program.ae',
		sourceUri: 'mem:/workspace/program.ae'
	});

	session.addBreakpoint({
		sourceUri: 'mem:/workspace/program.ae',
		sourceLine: 3,
		enabled: false
	});

	const result = session.resume();
	assert.notEqual(result.event && result.event.type, 'breakpoint');
	assert.equal(session.getLastDebugEvent().type, 'step');
	assert.equal(session.getState().engine.lastStopReason, 'completed');
});

test('halt message HCF throws a JavaScript exception', async () => {
	const session = new AE.DebuggerSession();
	await session.submitProgramAsync(`N000 1
H HCF
N001 2`);

	assert.throws(
		() => session.resume(),
		/HCF: Engine halted with extreme prejudice\./
	);
	assert.equal(session.getState().engine.lastStopReason, 'hcf');
	assert.equal(session.getState().engine.errorDetected, true);
	assert.match(session.getState().annunciator.attendantLog, /Halt: HCF/);
});
