// src/workers/monaco.worker.js
import * as monaco from 'monaco-editor';

self.MonacoEnvironment = {
		getWorkerUrl: function (moduleId, label) {
			// Use the correct path relative to your public directory
			if (label === 'typescript' || label === 'javascript') {
				return './monaco-editor/ts.worker.js';
			}
			return './monaco-editor/editor.worker.js';
		},
};

// Register languages and providers
monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
	noSemanticValidation: false,
	noSyntaxValidation: false
});

monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
	target: monaco.languages.typescript.ScriptTarget.ES2020,
	allowNonTsExtensions: true,
	moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
	module: monaco.languages.typescript.ModuleKind.CommonJS,
	noEmit: true,
	esModuleInterop: true,
	jsx: monaco.languages.typescript.JsxEmit.React,
	reactNamespace: 'React',
	allowJs: true,
	typeRoots: ['node_modules/@types']
});

// Add typings for common libraries
const libSource = `
interface Array<T> {}
interface Boolean {}
interface CallableFunction {}
interface Function {}
interface IArguments {}
interface Number {}
interface Object {}
interface RegExp {}
interface String {}
`;

monaco.languages.typescript.javascriptDefaults.addExtraLib(
	libSource,
	'ts:filename/global.d.ts'
);

// Add React typings
const reactTypings = `
declare namespace React {
  function createElement(type: any, props?: any, ...children: any[]): any;
  function useState<T>(initialState: T): [T, (newState: T) => void];
  function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  function useRef<T>(initialValue: T): { current: T };
}

declare module 'react' {
  export = React;
}
`;

monaco.languages.typescript.javascriptDefaults.addExtraLib(
	reactTypings,
	'ts:filename/react.d.ts'
);

// Handle messages from the main thread
self.addEventListener('message', (e) => {
	const { type, payload } = e.data;

	switch (type) {
		case 'init':
			// Initialize any specific worker configs
			self.postMessage({ type: 'initialized' });
			break;

		case 'validate':
			// Validate code and return diagnostics
			const { uri, languageId, code } = payload;
			// Perform validation and send back results
			const model = monaco.editor.createModel(code, languageId, monaco.Uri.parse(uri));
			const markers = monaco.editor.getModelMarkers({ resource: model.uri });
			model.dispose();

			self.postMessage({
				type: 'validation-result',
				payload: { uri, markers }
			});
			break;

		case 'format':
			// Format code
			const { text, options } = payload;

			// Format the code using monaco's formatter
			try {
				const formattedText = monaco.editor.formatString(text, options);
				self.postMessage({
					type: 'format-result',
					payload: { success: true, text: formattedText.text }
				});
			} catch (error) {
				self.postMessage({
					type: 'format-result',
					payload: { success: false, error: error.message }
				});
			}
			break;

		default:
			console.warn('Unknown message type:', type);
	}
});

// Signal that the worker is ready
self.postMessage({ type: 'ready' });