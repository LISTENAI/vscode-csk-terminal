// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import TerminalWebview from './terminalWebview';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "csk-terminal" is now acfftive!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	// let disposable = vscode.commands.registerCommand('csk-terminal.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
	// 	vscode.window.showInformationMessage('Hello World from csk-terminal!');
	// });
	const terminal = new TerminalWebview(context);
	// context.subscriptions.push(disposable);
	context.subscriptions.push(vscode.commands.registerCommand('csk-terminal.stopTerminal', () => {
		vscode.window.showInformationMessage('csk-terminal.stopTerminal!');
		terminal.disconnect();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('csk-terminal.clear', () => {
		vscode.window.showInformationMessage('csk-terminal.clear!');
	}));
	context.subscriptions.push(vscode.commands.registerCommand('csk-terminal.startTerminal', () => {
		vscode.window.showInformationMessage('csk-terminal.startTerminal!');
		terminal.connect();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('csk-terminal.save', () => {
		vscode.window.showInformationMessage('csk-terminal.save!');
	}));

	

}

// this method is called when your extension is deactivated
export function deactivate() {}