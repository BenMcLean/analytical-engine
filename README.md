# Analytical Engine

An Analytical Engine emulator for Node.

# Background

This library is an emulator of Charles Babbage's [Analytical Engine](https://en.wikipedia.org/wiki/Analytical_Engine), a Victorian era Turing-complete computer. The work of John Walker was used to build this, and it is mostly a port of his [web emulator](http://fourmilab.ch/babbage/emulator.html).

# Usage

Much better documentation than I could ever write can be found on John Walker's [Analytical Engine Table of Contents](http://fourmilab.ch/babbage/contents.html), particularly in the [Programming Cards](http://fourmilab.ch/babbage/cards.html) section, which explains how to program the machine.

This specific implementation differs from the web emulator in how you interact with it, which I will attempt to describe below.

## `AE`

`AE` is the object that you get when you import this library. It has listings for all of the individual components of the Analytical Engine, as well as a helper called `Interface`.

```js
import AE, { Interface } from 'analytical-engine';
```

For debugger-oriented embeddings, the package also exports `DebuggerSession`.

## `AE.Interface`

`AE.Interface` is an object that is meant to help set up the engine in a common way using only a few commands. If you were not to use this, it would take many lines of code to connect each of the separate components of the Analytical Engine together.

```js
const interface = new AE.Interface();
```

### `AE.Interface.clearState()`

The `clearState` method of `AE.Interface` is meant to clear the contents of the Mill and Store, as well as setting resetting the card stack to the beginning for another run. The current program is maintained, so you don't have to submit it again, but it is set back to the beginning.

### `AE.Interface.submitProgram(cards)`

The `submitProgram` method of `AE.Interface` is meant to be a shortcut method of setting up a program on the Analytical Engine. The program submitted should be a string. This method should return 0 if the internal libraries referenced in the program were expanded properly. If it doesn't, check the Attendant's log for errors in `interface.annunciator.L_output`.

### `AE.Interface.submitProgramAsync(cards, options)`

The `submitProgramAsync` method behaves like `submitProgram(cards)`, but allows library includes to be resolved by an asynchronous reader. This is the preferred API when embedding the emulator in browsers, web IDEs, editor extensions, or any host where Node's synchronous `fs` APIs are unavailable.

The optional `options` object may include:

* `sourceName`: a display name for the submitted program.
* `sourceUri`: a URI-like identifier for the submitted program. This is carried through to cards and library requests so editor integrations can map execution back to the originating document.

### `AE.Interface.submitProgramFromStream(stream, options)`

The `submitProgramFromStream` method reads program text from a modern JavaScript stream source and then submits it asynchronously. It accepts a WHATWG `ReadableStream`, an async iterable of strings or byte chunks, or any object with an async `read()` method returning text.

### `AE.Interface.runToCompletion()`

The `runToCompletion` method of `AE.Interface` will cause the engine to run until it either finishes or errors out. Errors can be checked for in the Attendant's log (`interface.annunciator.L_output`).

### `AE.Interface.getOutputs()`

Returns the current textual outputs as an object with `attendantLog`, `printer`, and `curveDrawingApparatus` properties.

### `AE.Interface.writeOutputsToStream(streams)`

Writes the current outputs to stream-like destinations. Each destination may be a WHATWG `WritableStream` or an object exposing an async `write(text)` method. The `streams` object can contain `attendantLog`, `printer`, and `curveDrawingApparatus`.

### `AE.Interface.setExecutionHooks(hooks)`

Registers optional execution hooks. This is intended to keep future debugger and breakpoint work straightforward.

* `beforeCard(card, engine)`: called immediately before a card executes. If it returns `false`, execution stops before the card is processed.
* `afterCard(card, engine, status)`: called after a card executes, with `status.halted` and `status.errorDetected`.

### Debugger API

For editor and IDE integrations, `AE.DebuggerSession` provides a higher-level debugging surface around `AE.Interface`.

* `submitProgram(...)`, `submitProgramAsync(...)`, `submitProgramFromStream(...)`
* `step()`, `stepCards(count)`, `runUntilPause(limit)`, `resume(limit)`, `start()`, `pause()`
* `getState()` for a structured machine snapshot
* `getDisplayState()` for card-reader, mill, store, and output display data
* `getCurrentCard()`, `getNextCard()`, `getLastDebugEvent()`
* `addBreakpoint(...)`, `setBreakpoints(...)`, `getBreakpoints()`, `removeBreakpoint(id)`, `clearBreakpoints()`

Breakpoints may match by `sourceUri`, `sourceName`, `sourceLine`, `cardIndex`, or exact card `text`, and may be disabled with `enabled: false`.

You may also construct a debugger session around an existing interface instance with `new AE.DebuggerSession({ interface })`, and retrieve it later with `getInterface()`. In that mode, the debugger session and interface share the same live emulator state. Reading state through the wrapped interface is fine, but driving execution or mutating emulator state through both APIs at once can lead to confusing ownership.

### `new AE.Interface(options)`

The constructor still works without arguments, preserving the existing desktop behavior. For web-friendly embeddings you may also provide:

* `libraryReader`: an async function that receives `{ kind, name, path }` and returns library card text.
* `libraryReaderSync`: a synchronous equivalent for custom desktop hosts.
* `executionHooks`: optional hooks equivalent to `setExecutionHooks(hooks)`.

When no reader is supplied, the existing Node filesystem behavior is retained for backwards compatibility.

## Accessing Engine Components

The components of the engine of an `AE.Interface` instance can be accessed using the following attributes.

* annunciator
* timing
* printer
* curveDrawingApparatus
* attendant
* mill
* cardReader
* store
* engine

The constructors for each of these components can be found in the `AE` main export.

* Annunciator
* Timing
* Printer
* CurveDrawingApparatus
* Attendant
* Mill
* Program
	* CardReader
	* CardSource
	* Card
	* Program
* Store
* Engine

## Libraries

All of the functions described in [The Mathematical Function Library](http://fourmilab.ch/babbage/library.html) are included in this emulator and can be run by using a `A include from library cards for libraryname` card.

You can write your own libraries as well. They must end with the extension `.ae`. You can include them in your code by using a `A include cards relative/path/to/library` card, where the extension is omitted from the library name.

### Include Resolution Rules

This package applies one consistent include-resolution rule across the Node CLI, direct Node embedding, and URI-based editor or browser hosts.

* `A include cards some/path` resolves `some/path.ae` relative to the file containing that include card.
* `A include from library cards for sqrt` first checks for a user override at `Library/sqrt.ae` relative to the including file.
* If no such user override exists, the built-in packaged library card set is used.

This is a deliberate behavior change from the older 2017 emulator lineage, which effectively relied on the process working directory for user includes and always loaded packaged library cards for library includes. The language syntax is unchanged, but multi-file program resolution is now source-relative, which makes large program trees, nested includes, and project-local library overrides behave consistently.

### Web / Editor Embedding

The default desktop usage assumes a Node environment for reading program files and expanding `A include ...` cards. That path still works unchanged.

For web builds or editor embeddings, construct the interface with a `libraryReader` and submit source via `submitProgramFromStream()` or `submitProgramAsync()`. This allows you to bridge the emulator to browser-native streams, `fetch()`, virtual file systems, or editor-provided file APIs without depending on Node `fs`.

Library requests carry enough information for a host environment to resolve them realistically:

* `kind`: `"system"` for built-in library cards, `"user"` for `A include cards ...`.
* `name`: the requested library name.
* `path`: the current library path token the emulator expects, including `.ae` for user includes.
* `sourceName` and `sourceUri`: the source document that requested the include.

Hosts should preserve the same search rule described above: resolve user includes relative to the including source, and for system includes try a same-project `Library/<name>.ae` override before falling back to packaged library cards.

The package also exports `AE.createUriLibraryReader(...)` to make `Uri`-based resolution easier in environments that use URI-addressed resources.

```js
import AE from 'analytical-engine';
import * as vscode from 'vscode';

const libraryReader = AE.createUriLibraryReader({
  resolveSystemUri: async request =>
    vscode.Uri.joinPath(extensionUri, request.path),
  resolveUserUri: async request => {
    const importer = vscode.Uri.parse(request.sourceUri);
    const parent = vscode.Uri.joinPath(importer, '..');
    return vscode.Uri.joinPath(parent, request.path);
  },
  readFile: async uri => vscode.workspace.fs.readFile(uri)
});

const engine = new AE.Interface({ libraryReader });

await engine.submitProgramFromStream(programReadableStream, {
  sourceName: document.fileName,
  sourceUri: document.uri.toString()
});
engine.runToCompletion();

const outputs = engine.getOutputs();
```

The example above uses Visual Studio Code because it has a convenient `Uri` and workspace file API, but the same host-facing API can be adapted to other IDEs, browser tools, sandboxes or custom runtimes that provide text and library data through URIs or stream-like abstractions.

### Packaging Notes

The package is native ESM and targets modern Node runtimes. The command-line interface remains Node-specific, while browser-oriented bundlers can use the package entry point together with the browser-safe filesystem adapter mapping in `package.json`.

### Breakpoints / Future Tracing

Breakpoint tracing is not fully implemented yet, but the API is shaped so it can be added without replacing the program-loading contract:

* Cards can retain `sourceUri` metadata from the submitted program or injected libraries.
* Library readers can report the `sourceUri` for included files.
* Execution hooks can stop before a card executes, which is a natural point for line or card breakpoints.

## Curve Drawing Apparatus

In the [Programming Cards](http://fourmilab.ch/babbage/cards.html) section, the Curve Drawing Apparatus is mentioned as a way to draw images using the engine. When you have run a program that you expect a drawing out of, `interface.curveDrawingApparatus.printScreen()` will return an SVG string of the curve that was drawn. This SVG can then be inserted into html or saved and opened up in an SVG editor to be viewed.

## Command Line Interface

The `analytical-engine` command line program is provided to give you a quick method of running Analytical Engine programs. To use this program, simply give it the location of an Analytical Engine program and it will run it to completion.

Example: `analytical-engine scripts/mandelbrot.ae`

After the program is finished executing, it will print out the contents of the Attendant's Log, Printer, and Curve Drawing Apparatus in that order. If you want to see the result of a calculation, I suggest using Print cards.

## Analytical Engine Language for Atom

Now is as good a time as any to plug my work on a very simple package which provides Analytical Engine language support for the Atom text editor, [language-analytical-engine](https://atom.io/packages/language-analytical-engine).
