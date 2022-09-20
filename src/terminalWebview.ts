import { ExtensionContext, commands, window, WebviewView, Webview, Uri, WebviewViewResolveContext, CancellationToken, SnippetString, WebviewViewProvider } from 'vscode';
import multiSerailConfig from './multiStepSerialConfig';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

export default class TerminalWebview implements WebviewViewProvider {

	public static readonly id = 'csk-terminal-view';

	private _port?: SerialPort;
	private _view?: WebviewView;
  private readonly _extensionUri: Uri;

	constructor(protected context: ExtensionContext) {
    this._extensionUri = context.extensionUri;
    context.subscriptions.push(window.registerWebviewViewProvider(TerminalWebview.id, this));
  }

	public resolveWebviewView(
		webviewView: WebviewView,
		context: WebviewViewResolveContext,
		_token: CancellationToken,
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,
      enableCommandUris: true,
			localResourceRoots: [
				this._extensionUri
			]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(message => {
			switch (message.type) {
				case 'stdin':
					this._serialWrite(message.value);
					break;
			}
		});
	}

	public async connect() {
		const config = await multiSerailConfig(this.context.globalState.get('recentPortSettings'));
		console.log(config);
		const port = new SerialPort({
			path: config.path,
			baudRate: parseInt(config.baudRate),
			dataBits: config.dataBits,
			parity: config.parity,
			stopBits: config.stopBits,
		});
		this._port = port;
		// const parser = this._port.pipe(new ReadlineParser());
		this.context.globalState.update('recentPortSettings', config);
		this._postMessage({
			type: 'connected',
			value: true
		});
		let self = this;
		port.on('readable', function () {
			self._postMessage({
				type: 'stdout',
				value: port.read().toString()
			});
		});
		commands.executeCommand('setContext', 'listenai.csk-terminal:running', !0);
	}

	public async disconnect() {
		this._port?.close(() => {
			commands.executeCommand('setContext', 'listenai.csk-terminal:running', !1);
			this._port = undefined;
		});
	}

	// public async showPorts() {
	// 	const ports = await SerialPort.list();
	// 	console.log(ports);
	// }

	// public addColor() {
	
	// }

	// public clearColors() {
	// 	if (this._view) {
	// 		this._view.webview.postMessage({ type: 'clearColors' });
	// 	}
	// }

	private _getHtmlForWebview(webview: Webview) {
		// Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
		const mainUri = webview.asWebviewUri(Uri.joinPath(this._extensionUri, 'media', 'main.js'));
		const termUri = webview.asWebviewUri(Uri.joinPath(this._extensionUri, 'media', 'term.js'));

		// Do the same for the stylesheet.
		const styleResetUri = webview.asWebviewUri(Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
		const styleVSCodeUri = webview.asWebviewUri(Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
		const styleMainUri = webview.asWebviewUri(Uri.joinPath(this._extensionUri, 'media', 'main.css'));

		// Use a nonce to only allow a specific script to be run.
		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!--
					Use a content security policy to only allow loading styles from our extension directory,
					and only allow scripts that have a specific nonce.
					(See the 'webview-sample' extension sample for img-src content security policy examples)
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src vscode-resource: 'unsafe-inline' http: https: data:; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">
				<title>Cat Colors</title>
			</head>
			<body>

				<div id="terminal"></div>
				

				<!--
					<div id="welcome-message" class="hidden">
							<p>Welcome to the <strong>CSK Terminal</strong>.</p>

							<p>To get started, do one of the following:</p>

							<ul class="connect-options">
									<li>点下上面的几个icon就知道了</li>
							</ul>
					</div>
					<ul class="color-list">
					</ul>
					<button class="add-color-button">Add Color</button>
				-->
				<script nonce="${nonce}" src="${termUri}"></script>
				<script nonce="${nonce}" src="${mainUri}"></script>
			</body>
			</html>`;
	}

	private _postMessage(data: object) {
		if (this._view) {
			this._view.show?.(true);
			this._view.webview.postMessage(data);
		}
	}

	private _serialWrite(buffer: Uint8Array) {
		if (this._port?.isOpen) {
			this._port.write(buffer);
		}
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}