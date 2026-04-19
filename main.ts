import { MarkdownView, Plugin } from "obsidian";
import { SlashCompleteSettingsTab } from "./src/settings";
import { Command } from "./src/models/command";
import { AutoComplete } from "./src/autocomplete";
import { SlashCompleteSettings } from "./src/models/slash_complete_settings";
import { DEFAULT_SETTINGS } from "./src/constants";

export default class SlashCompletePlugin extends Plugin {
	settings: SlashCompleteSettings;

	async onload() {
		await this.loadSettings();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SlashCompleteSettingsTab(this.app, this));

		this.registerEditorSuggest(new AutoComplete(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = await this.mergeSettings();
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async mergeSettings(): Promise<SlashCompleteSettings> {
		const stored = await this.loadData();
		if (!stored) {
			return DEFAULT_SETTINGS;
		}

		// 🔥 修复：commands 现在是数组，需要数组合并
		if (stored.commands && Array.isArray(stored.commands)) {
			const defaultCommands: Command[] = DEFAULT_SETTINGS.commands;
			const storedCommands: Command[] = stored.commands;
			
			// 创建一个 Map 用于去重，基于 command 名称
			const commandMap = new Map<string, Command>();
			
			// 先添加默认命令
			defaultCommands.forEach((cmd: Command) => commandMap.set(cmd.command, cmd));
			// 再添加用户存储的命令（用户自定义的会覆盖默认的）
			storedCommands.forEach((cmd: Command) => commandMap.set(cmd.command, cmd));
			
			// 转回数组
			stored.commands = Array.from(commandMap.values());
		}
		
		return stored;
	}
}
