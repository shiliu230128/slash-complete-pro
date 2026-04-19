import { Command } from "./command";

export interface SlashCompleteSettings {
	hotKey: string;
	// 🔥 修复：改为数组类型以支持拖拽排序和新增
	commands: Command[];
}
