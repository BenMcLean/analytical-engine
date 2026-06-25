const test = require('node:test');
const assert = require('node:assert/strict');

const AE = require('../index');

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
	let emptySvg = '<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg"></svg>';

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

	assert.notEqual(eng.curveDrawingApparatus.printScreen(), emptySvg);
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
