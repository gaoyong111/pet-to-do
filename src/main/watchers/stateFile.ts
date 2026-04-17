import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

/** WorkBuddy 状态文件路径 */
const STATE_FILE = join(homedir(), '.workbuddy', 'state.json');

/** 状态文件内容结构 */
export interface WorkBuddyState {
    status: 'idle' | 'working' | 'success' | 'failed';
    timestamp: number;
    message?: string;
}

/** 默认状态（文件不存在时） */
const DEFAULT_STATE: WorkBuddyState = {
    status: 'idle',
    timestamp: 0
};

/**
 * 读取 WorkBuddy 状态文件
 */
export function readWorkBuddyState(): WorkBuddyState {
    if (!existsSync(STATE_FILE)) {
        return DEFAULT_STATE;
    }

    try {
        const content = readFileSync(STATE_FILE, 'utf-8');
        return JSON.parse(content) as WorkBuddyState;
    } catch {
        return DEFAULT_STATE;
    }
}

/**
 * 获取状态文件路径（供调试用）
 */
export function getStateFilePath(): string {
    return STATE_FILE;
}
