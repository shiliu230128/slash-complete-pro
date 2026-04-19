import {
	App,
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	TFile,
} from "obsidian";
import { Command } from "./models/command";
import SlashCompletePlugin from "../main";

const NO_COMMAND = -1;

// 全局可编辑命令数组（支持编辑/拖拽/新增）
let editableCommands: Command[] = [];
// 缓存当前编辑器容器，用于重新渲染
let suggestContainer: HTMLElement | null = null;

export class AutoComplete extends EditorSuggest<Command> {
	private slashComplete: SlashCompletePlugin;
	private commandStartIndex: number;

	constructor(app: App, slashComplete: SlashCompletePlugin) {
		super(app);
		this.slashComplete = slashComplete;
		this.commandStartIndex = NO_COMMAND;
		// 初始化可编辑命令列表
		editableCommands = [...this.slashComplete.settings.commands];
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		file: TFile | null
	): EditorSuggestTriggerInfo | null {
		const line = editor.getLine(cursor.line);

		if (
			this.commandStartIndex === NO_COMMAND &&
			line[cursor.ch - 1] !== this.slashComplete.settings.hotKey
		) {
			return null;
		}

		if (this.commandStartIndex === NO_COMMAND) {
			this.commandStartIndex = cursor.ch - 1;
		}
		const currentCommand = line.slice(this.commandStartIndex, cursor.ch);

		if (
			currentCommand.includes(` `) ||
			currentCommand[0] !== this.slashComplete.settings.hotKey
		) {
			this.commandStartIndex = NO_COMMAND;
			return null;
		}

		return {
			start: cursor,
			end: cursor,
			query: currentCommand.slice(1),
		};
	}

	// 🔥 核心修改：适配数组格式的命令列表
	getSuggestions(
		context: EditorSuggestContext
	): Command[] | Promise<Command[]> {
		return editableCommands.filter(
			(cmd) =>
				cmd.command.includes(context.query) ||
				(cmd.alias !== null && cmd.alias.includes(context.query))
		);
	}

	// 🔥 核心重写：渲染可编辑、可拖拽、带新增按钮的命令列表
	renderSuggestion(value: Command, el: HTMLElement): void {
		suggestContainer = el.parentElement?.parentElement || null;
		// 清空容器，添加自定义布局
		el.empty();
		el.addClass("slash-command-item");
		el.setAttribute("draggable", "true");

		// 1. 拖拽手柄（点击这里拖动排序）
		const dragHandle = document.createElement("span");
		dragHandle.className = "drag-handle";
		dragHandle.textContent = "⋮⋮";
		el.appendChild(dragHandle);

		// 2. 可编辑的指令名称
		const nameWrapper = document.createElement("div");
		nameWrapper.className = "command-name-wrapper";
		// 点击名称进入编辑模式
		nameWrapper.onclick = () => startEdit(value, el);
		nameWrapper.textContent = value.command;
		el.appendChild(nameWrapper);

		// 3. 别名展示（保留原有）
		if (value.alias) {
			const aliasEl = document.createElement("span");
			aliasEl.className = "command-alias";
			aliasEl.textContent = `(${value.alias})`;
			el.appendChild(aliasEl);
		}

		// 绑定原生拖拽事件
		bindDragEvents(el, value);
	}

	// 原有选择命令逻辑（完全保留）
	selectSuggestion(value: Command, evt: MouseEvent | KeyboardEvent): void {
		if (NO_COMMAND == this.commandStartIndex) {
			return;
		}

		this.context?.editor.replaceRange(
			value.value,
			{ line: this.context.start.line, ch: this.commandStartIndex },
			this.context.end
		);
		this.close();
	}

	// 重写打开方法：渲染后添加新增按钮
	open(): void {
		super.open();
		setTimeout(() => {
			if (suggestContainer && !suggestContainer.querySelector(".add-command-btn")) {
				addAddButton(suggestContainer, this);
			}
		}, 0);
	}
}

// ==================== 新增功能：编辑/拖拽/新增 工具函数 ====================
// 开始编辑指令名称
function startEdit(cmd: Command, el: HTMLElement) {
	el.empty();
	const input = document.createElement("input");
	input.className = "command-edit-input";
	input.value = cmd.command;
	input.focus();

	// 回车/失焦保存
	input.onkeydown = (e) => {
		if (e.key === "Enter") {
			saveEdit(cmd, input.value);
		}
	};
	input.onblur = () => saveEdit(cmd, input.value);

	el.appendChild(input);
}

// 保存编辑的名称
function saveEdit(cmd: Command, newName: string) {
	if (newName.trim()) {
		cmd.command = newName.trim();
	}
	// 重新渲染列表
	refreshSuggestions();
}

// 绑定拖拽排序事件
function bindDragEvents(el: HTMLElement, cmd: Command) {
	el.ondragstart = (e) => {
		if (e.dataTransfer) {
			e.dataTransfer.setData("command-id", cmd.command);
		}
		el.addClass("drag-active");
	};
	el.ondragover = (e) => e.preventDefault();
	el.ondrop = (e) => {
		e.preventDefault();
		const targetCmd = findCommandByElement(el);
		if (e.dataTransfer && targetCmd) {
			const draggedId = e.dataTransfer.getData("command-id");
			if (draggedId !== targetCmd.command) {
				dragSort(draggedId, targetCmd);
			}
		}
		el.removeClass("drag-active");
	};
}

// 拖拽排序核心逻辑
function dragSort(draggedCommand: string, targetCommand: Command) {
	const oldIndex = editableCommands.findIndex(c => c.command === draggedCommand);
	const newIndex = editableCommands.findIndex(c => c.command === targetCommand.command);
	// 交换数组位置
	const [moved] = editableCommands.splice(oldIndex, 1);
	editableCommands.splice(newIndex, 0, moved);
	refreshSuggestions();
}

// 添加新增命令按钮
function addAddButton(container: HTMLElement, instance: AutoComplete) {
	const btn = document.createElement("button");
	btn.className = "add-command-btn";
	btn.textContent = "+ 新增自定义命令";
	btn.onclick = () => addNewCommand(instance);
	container.appendChild(btn);
}

// 新增命令
function addNewCommand(instance: AutoComplete) {
	const newCmd: Command = {
		id: Date.now(),  // 使用时间戳作为唯一ID
		command: "新命令",
		alias: null,
		value: "自定义内容",
	};
	editableCommands.push(newCmd);
	refreshSuggestions();
}

// 辅助：重新渲染建议列表
function refreshSuggestions() {
	const instance = (window as any).currentSlashInstance;
	if (instance) {
		instance.updateSuggestions();
	}
}

// 辅助：通过DOM元素找到对应命令
function findCommandByElement(el: HTMLElement): Command | undefined {
	const commandText = el.textContent?.split("(")[0].trim();
	return editableCommands.find(c => c.command === commandText);
}
