export type StreamReadableChunk = string | Uint8Array;

export type StreamReadable =
	| string
	| {
			read(): Promise<string>;
	  }
	| AsyncIterable<StreamReadableChunk>
	| {
			getReader(): {
				read(): Promise<{ done: boolean; value?: StreamReadableChunk }>;
				releaseLock?(): void;
			};
	  };

export type StreamWritable =
	| {
			write(text: string): Promise<void> | void;
			close?(): Promise<void> | void;
			end?(): void;
	  }
	| {
			getWriter(): {
				write(text: string): Promise<void>;
				close(): Promise<void>;
				releaseLock?(): void;
			};
	  };

export type ProgramSourceInfo = {
	sourceName?: string;
	sourceUri?: string;
};

export type LibraryRequest = {
	kind: "system" | "user";
	name: string;
	path: string;
	sourceName?: string;
	sourceUri?: string;
};

export type LibraryResponse = string | {
	text: string;
	sourceName?: string;
	sourceUri?: string;
};

export type LibraryReader = (request: LibraryRequest) => Promise<LibraryResponse>;
export type LibraryReaderSync = (request: LibraryRequest) => LibraryResponse;

export type Breakpoint = {
	id?: number;
	enabled?: boolean;
	sourceUri?: string | null;
	sourceName?: string | null;
	sourceLine?: number | null;
	cardIndex?: number | null;
	text?: string | null;
};

export type NormalizedBreakpoint = {
	id: number;
	enabled: boolean;
	sourceUri: string | null;
	sourceName: string | null;
	sourceLine: number | null;
	cardIndex: number | null;
	text: string | null;
};

export type CardSnapshot = {
	index?: number;
	text?: string;
	sourceLine?: number | null;
	sourceName?: string | null;
	sourceUri?: string | null;
	[key: string]: unknown;
};

export type ExecutionStatus = {
	halted?: boolean;
	errorDetected?: boolean;
	[key: string]: unknown;
};

export type ExecutionHooks = {
	beforeCard?: (card: CardSnapshot, engine: Engine) => boolean | void;
	afterCard?: (card: CardSnapshot, engine: Engine, status: ExecutionStatus) => void;
};

export type InterfaceOptions = {
	libraryReader?: LibraryReader;
	libraryReaderSync?: LibraryReaderSync;
	executionHooks?: ExecutionHooks | null;
};

export type SubmitProgramOptions = ProgramSourceInfo;

export type InterfaceOutputs = {
	attendantLog: string;
	printer: string;
	curveDrawingApparatus: string;
};

export type DisplayState = {
	mill: unknown;
	store: unknown;
	cardReader: unknown;
	outputs: InterfaceOutputs;
	annunciator: unknown;
};

export type DebugState = {
	engine: unknown;
	mill: unknown;
	store: unknown;
	cardReader: unknown;
	timing: unknown;
	annunciator: unknown;
	outputs: InterfaceOutputs;
	breakpoints: NormalizedBreakpoint[];
	lastEvent: DebugEvent | null;
};

export type StepResult = {
	progressed: boolean;
	event: DebugEvent | null;
	state: DebugState;
};

export type RunUntilPauseResult = {
	steps: number;
	event: DebugEvent | null;
	state: DebugState;
};

export type DebugEvent =
	| {
			type: "breakpoint";
			breakpoint: NormalizedBreakpoint;
			card: CardSnapshot;
	  }
	| {
			type: "error" | "halt" | "step";
			card: CardSnapshot;
			status: ExecutionStatus;
	  };

export type UriLibraryReaderOptions<TUri> = {
	resolveSystemUri(request: LibraryRequest): Promise<TUri> | TUri;
	resolveUserUri(request: LibraryRequest): Promise<TUri> | TUri;
	readFile(requestedUri: TUri, request: LibraryRequest): Promise<Uint8Array | string> | Uint8Array | string;
	textDecoder?: {
		decode(input?: ArrayBufferView | ArrayBuffer): string;
	};
};

export class Annunciator {
	L_output: string;
	getState(): unknown;
	setOverride(enabled: boolean): void;
}

export class Timing {
	reset(): void;
	getState(): unknown;
}

export class Printer {
	O_output: string;
}

export class CurveDrawingApparatus {
	constructor(width?: number, height?: number);
	printScreen(): string;
}

export class Attendant {
	constructor(annunciator: Annunciator, timing: Timing);
	setLibraryTemplate(template: string): void;
	setLibraryReader(reader: LibraryReader): void;
	setLibraryReaderSync(reader: LibraryReaderSync): void;
}

export class Mill {
	constructor(annunciator: Annunciator, attendant: Attendant, timing: Timing);
	getState(): unknown;
	egress: Array<{ value: bigint }>;
	operation: number;
}

export namespace Program {
	class CardReader {
		constructor(annunciator: Annunciator, attendant: Attendant, timing: Timing);
		getState(): unknown;
		getDisplayState(): unknown;
	}

	class Program {
		constructor(
			cards: string,
			attendant: Attendant,
			cardReader: CardReader,
			store: Store,
			curveDrawingApparatus: CurveDrawingApparatus,
			timing: Timing,
			engine: Engine
		);
		setSourceInfo(info: ProgramSourceInfo): void;
		submit(): number;
		submitAsync(): Promise<number>;
	}
}

export class Store {
	constructor(annunciator: Annunciator, attendant: Attendant, timing: Timing);
	get(index: number): { value: bigint };
	getState(): unknown;
	getDisplayState(): unknown;
}

export class Engine {
	constructor(
		annunciator: Annunciator,
		attendant: Attendant,
		mill: Mill,
		store: Store,
		cardReader: Program.CardReader,
		printer: Printer,
		curveDrawingApparatus: CurveDrawingApparatus
	);
	commence(): void;
	start(): void;
	halt(): void;
	isRunning(): boolean;
	processCard(): boolean;
	getCurrentCard(): unknown;
	getNextCard(): unknown;
	getState(): unknown;
	setExecutionHooks(hooks: ExecutionHooks): void;
}

export class Interface {
	constructor(options?: InterfaceOptions);

	annunciator: Annunciator;
	timing: Timing;
	printer: Printer;
	curveDrawingApparatus: CurveDrawingApparatus;
	attendant: Attendant;
	mill: Mill;
	cardReader: Program.CardReader;
	store: Store;
	engine: Engine;
	program?: Program.Program;

	clearState(): void;
	createProgram(cards: string, options?: SubmitProgramOptions): Program.Program;
	setExecutionHooks(hooks: ExecutionHooks | null): void;
	submitProgram(cards: string, options?: SubmitProgramOptions): number;
	submitProgramAsync(cards: string, options?: SubmitProgramOptions): Promise<number>;
	submitProgramFromStream(stream: StreamReadable, options?: SubmitProgramOptions): Promise<number>;
	runToCompletion(): void;
	start(): void;
	pause(): void;
	step(): StepResult;
	stepCards(count: number): StepResult[];
	runUntilPause(limit?: number): RunUntilPauseResult;
	resume(limit?: number): RunUntilPauseResult;
	getOutputs(): InterfaceOutputs;
	getCurrentCard(): CardSnapshot;
	getNextCard(): CardSnapshot;
	getDisplayState(): DisplayState;
	getDebugState(): DebugState;
	getLastDebugEvent(): DebugEvent | null;
	addBreakpoint(breakpoint: Breakpoint): NormalizedBreakpoint;
	setBreakpoints(breakpoints: Breakpoint[]): NormalizedBreakpoint[];
	getBreakpoints(): NormalizedBreakpoint[];
	clearBreakpoints(): void;
	removeBreakpoint(id: number): void;
	writeOutputsToStream(streams: {
		attendantLog?: StreamWritable;
		printer?: StreamWritable;
		curveDrawingApparatus?: StreamWritable;
	}): Promise<InterfaceOutputs>;
}

export class DebuggerSession {
	constructor(options?: InterfaceOptions & { interface?: Interface });
	submitProgram(cards: string, options?: SubmitProgramOptions): number;
	submitProgramAsync(cards: string, options?: SubmitProgramOptions): Promise<number>;
	submitProgramFromStream(stream: StreamReadable, options?: SubmitProgramOptions): Promise<number>;
	step(): StepResult;
	stepCards(count: number): StepResult[];
	runUntilPause(limit?: number): RunUntilPauseResult;
	resume(limit?: number): RunUntilPauseResult;
	start(): void;
	pause(): void;
	getState(): DebugState;
	getDisplayState(): DisplayState;
	getInterface(): Interface;
	getLastDebugEvent(): DebugEvent | null;
	getCurrentCard(): CardSnapshot;
	getNextCard(): CardSnapshot;
	addBreakpoint(breakpoint: Breakpoint): NormalizedBreakpoint;
	setBreakpoints(breakpoints: Breakpoint[]): NormalizedBreakpoint[];
	getBreakpoints(): NormalizedBreakpoint[];
	clearBreakpoints(): void;
	removeBreakpoint(id: number): void;
}

export function readTextStream(stream: StreamReadable): Promise<string>;
export function writeTextStream(stream: StreamWritable, text: string): Promise<void>;
export function createUriLibraryReader<TUri>(
	options: UriLibraryReaderOptions<TUri>
): (request: LibraryRequest) => Promise<{
	text: string;
	sourceName: string;
	sourceUri: string | TUri;
}>;

declare const _default: {
	Annunciator: typeof Annunciator;
	Timing: typeof Timing;
	Printer: typeof Printer;
	CurveDrawingApparatus: typeof CurveDrawingApparatus;
	Attendant: typeof Attendant;
	Mill: typeof Mill;
	Program: typeof Program;
	Store: typeof Store;
	Engine: typeof Engine;
	Interface: typeof Interface;
	DebuggerSession: typeof DebuggerSession;
	readTextStream: typeof readTextStream;
	writeTextStream: typeof writeTextStream;
	createUriLibraryReader: typeof createUriLibraryReader;
};

export default _default;
