import { app } from 'electron';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface CharacterPhrasesFile {
    locale: string;
    greeting?: Record<string, string[]>;
    dialogue?: Record<string, unknown>;
}

export interface CharacterBundle {
    systemPrompt: string | null;
    phrases: CharacterPhrasesFile | null;
    sourceDir: string | null;
}

const MODELFILE_NAME = 'natori.modelfile';
const PHRASES_NAME = 'natori.phrases.json';

/** 解析 Ollama Modelfile 中的 SYSTEM """...""" 块 */
export function parseModelfileSystem(content: string): string | null {
    const match = content.match(/SYSTEM\s+"""([\s\S]*?)"""/);
    return match?.[1]?.trim() || null;
}

function readTextFile(path: string): string | null {
    try {
        if (!existsSync(path)) return null;
        return readFileSync(path, 'utf-8');
    } catch {
        return null;
    }
}

function resolveLocalDirs(): string[] {
    const dirs: string[] = [];
    if (!app.isPackaged) {
        dirs.push(join(process.cwd(), '.local'));
    }
    dirs.push(join(app.getPath('userData'), '.local'));
    return dirs;
}

export function loadCharacterBundle(): CharacterBundle {
    let systemPrompt: string | null = null;
    let phrases: CharacterPhrasesFile | null = null;
    let sourceDir: string | null = null;

    for (const dir of resolveLocalDirs()) {
        const modelfilePath = join(dir, MODELFILE_NAME);
        const phrasesPath = join(dir, PHRASES_NAME);

        const modelfile = readTextFile(modelfilePath);
        const phrasesText = readTextFile(phrasesPath);

        if (modelfile) {
            systemPrompt = parseModelfileSystem(modelfile);
            sourceDir = dir;
        }

        if (phrasesText) {
            try {
                phrases = JSON.parse(phrasesText) as CharacterPhrasesFile;
                sourceDir = sourceDir || dir;
            } catch (err) {
                console.warn('[character] 解析短语文件失败:', err);
            }
        }

        if (systemPrompt || phrases) break;
    }

    return { systemPrompt, phrases, sourceDir };
}
