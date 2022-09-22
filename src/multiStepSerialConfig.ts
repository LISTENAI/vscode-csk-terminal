import { QuickPickItem, QuickInputButton, Disposable, window, QuickInput, QuickInputButtons} from 'vscode';
import { SerialPort } from 'serialport';

const TITLE = '串口配置';

interface QuickPickParameters<T extends QuickPickItem> {
	title: string;
	step: number;
	totalSteps: number;
	items: T[];
	activeItem?: T;
	placeholder: string;
	buttons?: QuickInputButton[];
	shouldResume: () => Thenable<boolean>;
}

interface InputBoxParameters {
	title: string;
	step: number;
	totalSteps: number;
	value: string;
	prompt: string;
	validate: (value: string) => Promise<string | undefined>;
	buttons?: QuickInputButton[];
	shouldResume: () => Thenable<boolean>;
}

interface State {
  title: string;
  step: number;
  totalSteps: number;
  path: string;
  baudRate: string;
  dataBits: 5 | 6 | 7 | 8 | undefined;
	stopBits: 1 | 2;
	parity: 'none' | 'even' | 'mark' | 'odd' | 'space';
}

type InputStep = (input: MultiStepInput) => Thenable<InputStep | void>;

class InputFlowAction {
	static back = new InputFlowAction();
	static cancel = new InputFlowAction();
	static resume = new InputFlowAction();
}

class MultiStepInput {

	static async run<T>(start: InputStep) {
		const input = new MultiStepInput();
		return input.stepThrough(start);
	}

	private current?: QuickInput;
	private steps: InputStep[] = [];

	private async stepThrough<T>(start: InputStep) {
		let step: InputStep | void = start;
		while (step) {
			this.steps.push(step);
			if (this.current) {
				this.current.enabled = false;
				this.current.busy = true;
			}
			try {
				step = await step(this);
			} catch (err) {
				if (err === InputFlowAction.back) {
					this.steps.pop();
					step = this.steps.pop();
				} else if (err === InputFlowAction.resume) {
					step = this.steps.pop();
				} else if (err === InputFlowAction.cancel) {
					step = undefined;
				} else {
					throw err;
				}
			}
		}
		if (this.current) {
			this.current.dispose();
		}
	}

	async showQuickPick<T extends QuickPickItem, P extends QuickPickParameters<T>>({ title, step, totalSteps, items, activeItem, placeholder, buttons, shouldResume }: P) {
		const disposables: Disposable[] = [];
		try {
			return await new Promise<T | (P extends { buttons: (infer I)[] } ? I : never)>((resolve, reject) => {
				const input = window.createQuickPick<T>();
				input.title = title;
				input.ignoreFocusOut = !0;
				input.step = step;
				input.totalSteps = totalSteps;
				input.placeholder = placeholder;
				input.items = items;
				if (activeItem) {
					input.activeItems = [activeItem];
				}
				input.buttons = [
					...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
					...(buttons || [])
				];
				disposables.push(
					input.onDidTriggerButton(item => {
						if (item === QuickInputButtons.Back) {
							reject(InputFlowAction.back);
						} else {
							resolve(<any>item);
						}
					}),
					input.onDidChangeSelection(items => resolve(items[0])),
					input.onDidHide(() => {
						(async () => {
							reject(shouldResume && await shouldResume() ? InputFlowAction.resume : InputFlowAction.cancel);
						})()
							.catch(reject);
					})
				);
				if (this.current) {
					this.current.dispose();
				}
				this.current = input;
				this.current.show();
			});
		} finally {
			disposables.forEach(d => d.dispose());
		}
	}

	async showInputBox<P extends InputBoxParameters>({ title, step, totalSteps, value, prompt, validate, buttons, shouldResume }: P) {
		const disposables: Disposable[] = [];
		try {
			return await new Promise<string | (P extends { buttons: (infer I)[] } ? I : never)>((resolve, reject) => {
				const input = window.createInputBox();
				input.title = title;
				input.step = step;
				input.totalSteps = totalSteps;
				input.value = value || '';
				input.prompt = prompt;
				input.buttons = [
					...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
					...(buttons || [])
				];
				let validating = validate('');
				disposables.push(
					input.onDidTriggerButton(item => {
						if (item === QuickInputButtons.Back) {
							reject(InputFlowAction.back);
						} else {
							resolve(<any>item);
						}
					}),
					input.onDidAccept(async () => {
						const value = input.value;
						input.enabled = false;
						input.busy = true;
						if (!(await validate(value))) {
							resolve(value);
						}
						input.enabled = true;
						input.busy = false;
					}),
					input.onDidChangeValue(async text => {
						const current = validate(text);
						validating = current;
						const validationMessage = await current;
						if (current === validating) {
							input.validationMessage = validationMessage;
						}
					}),
					input.onDidHide(() => {
						(async () => {
							reject(shouldResume && await shouldResume() ? InputFlowAction.resume : InputFlowAction.cancel);
						})()
							.catch(reject);
					})
				);
				if (this.current) {
					this.current.dispose();
				}
				this.current = input;
				this.current.show();
			});
		} finally {
			disposables.forEach(d => d.dispose());
		}
	}
}

export default async function multiSerailConfig(configs: Array<State>) {
  const state = {} as Partial<State>;
	console.log(configs);
	await MultiStepInput.run(input => pickPrePort(input, state, configs));
  return state as State;
}

async function pickPrePort(input: MultiStepInput, state: Partial<State>, configs: Array<State>) {
	if (!configs?.length) {
		return (input: MultiStepInput) => pickPath(input, state);
	}
  const resourceGroups: QuickPickItem[] = configs.map(port => ({
		label: port.path,
		description: `baudRate: ${port.baudRate}, dataBits: ${port.dataBits}, parity: ${port.parity}, stopBits: ${port.stopBits}`,
		port: port
	}));
	resourceGroups.unshift({label: '[other]'});
  const pick = await input.showQuickPick({
    title: TITLE,
    step: 1,
    totalSteps: 1,
    placeholder: '选择串口配置',
    items: resourceGroups,
    buttons: [],
    shouldResume: shouldResume
  });

	const port = (<any>pick)?.port || undefined;
	if (port) {
		state.path = port.path;
		state.baudRate = port.baudRate;
		state.dataBits = port.dataBits;
		state.stopBits = port.stopBits;
		state.parity = port.parity;
	} else {
		return (input: MultiStepInput) => pickPath(input, state);
	}
}

async function pickPath(input: MultiStepInput, state: Partial<State>) {
  const resourceGroups: QuickPickItem[] = (await SerialPort.list()).map(port => ({label: port.path}));
  const pick = await input.showQuickPick({
    title: TITLE,
    step: 1,
    totalSteps: 5,
    placeholder: '选择一个串口',
    items: resourceGroups,
    buttons: [],
    shouldResume: shouldResume
  });
  
  state.path = pick?.label;
  return (input: MultiStepInput) => pickBaudRate(input, state);
}

async function pickBaudRate(input: MultiStepInput, state: Partial<State>) {
  const resourceGroups: QuickPickItem[] = ['[other]', '115200', '57600', '38400', '19200', '9600', '4800'].map(item => ({label: item}));
  const pick = await input.showQuickPick({
    title: TITLE,
    step: 2,
    totalSteps: 5,
    placeholder: '选择波特率',
    items: resourceGroups,
    buttons: [],
    shouldResume: shouldResume
  });

	state.baudRate = pick?.label;

	if (pick.label === '[other]') {
		const pick = await input.showInputBox({
			title: TITLE,
			step: 2,
			totalSteps: 5,
			prompt: '输入波特率',
			value: '',
			validate: async (name: string) => {
				return undefined;
			},
			shouldResume: shouldResume
		});
		state.baudRate = pick;
	}

  return (input: MultiStepInput) => pickDataBits(input, state);
}

async function pickDataBits(input: MultiStepInput, state: Partial<State>) {
	const resourceGroups: QuickPickItem[] = ['8', '7', '6', '5'].map(item => ({label: item}));
  const pick = await input.showQuickPick({
    title: TITLE,
    step: 3,
    totalSteps: 5,
    placeholder: '选择数据位',
    items: resourceGroups,
    buttons: [],
    shouldResume: shouldResume
  });
	state.dataBits = <5 | 6 | 7 | 8 | undefined>(pick?.label ? parseInt(pick?.label) : 8);
  return (input: MultiStepInput) => pickParity(input, state);
}



async function pickParity(input: MultiStepInput, state: Partial<State>) {
	const resourceGroups: QuickPickItem[] = ['none', 'even', 'mark', 'odd', 'space'].map(item => ({label: item}));
  const pick = await input.showQuickPick({
    title: TITLE,
    step: 4,
    totalSteps: 5,
    placeholder: '选择校验',
    items: resourceGroups,
    buttons: [],
    shouldResume: shouldResume
  });
	state.parity = <'none' | 'even' | 'mark' | 'odd' | 'space'>(pick?.label ?? 'none');
	return (input: MultiStepInput) => pickStopBits(input, state);
}

async function pickStopBits(input: MultiStepInput, state: Partial<State>) {
	const resourceGroups: QuickPickItem[] = ['1', '2'].map(item => ({label: item}));
  const pick = await input.showQuickPick({
    title: TITLE,
    step: 5,
    totalSteps: 5,
    placeholder: '选择停止位',
    items: resourceGroups,
    buttons: [],
    shouldResume: shouldResume
  });
	state.stopBits = <1 | 2>(pick?.label ? parseInt(pick?.label) : 8);
}

function shouldResume() {
  // Could show a notification with the option to resume.
  return new Promise<boolean>((resolve, reject) => {
    // noop
  });
}