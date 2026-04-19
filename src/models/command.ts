// 修复：CommandOption 字段与实际使用匹配
export interface CommandOption {
  id: number; // 唯一ID（用于拖拽/排序）
  command: string;  // 指令名称
  alias: string | null;  // 别名
  value: string;  // 插入的内容
  isEditing?: boolean;  // 编辑状态（可选）
}

// Command 直接使用 CommandOption，无需扩展
export type Command = CommandOption;