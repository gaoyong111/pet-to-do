import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

/** 皮肤清单接口 */
export interface SkinManifest {
  name: string;
  author: string;
  version: string;
  description: string;
  group: string;
  renderer?: string;
  model?: {
    entry: string;
    scale: number;
    anchor: [number, number];
  };
  size?: {
    width: number;
    height: number;
  };
  defaultState?: string;
  supportedStates?: string[];
  supportedReactions?: string[];
  stateMotionMapping?: Record<string, {
    motion: string;
    expression?: string;
    loop?: boolean;
  }>;
  reactionMapping?: Record<string, {
    motion: string;
    expression?: string;
    bubble?: string;
  }>;
}

/** 皮肤配置接口 */
export interface SkinConfig {
  defaultState?: string;
  stateTransitions?: Record<string, string[]>;
  reactionMapping?: Record<string, {
    state: string;
    bubble: string;
    duration: number;
  }>;
  timePeriods?: Array<{
    startHour: number;
    endHour: number;
    state: string;
    greetings: string[];
  }>;
  [key: string]: any;
}

/** 状态配置接口 */
export interface StateConfig {
  name: string;
  displayName: string;
  description: string;
  animation: {
    type: string;
    parameters: Record<string, any>;
  };
  colors?: {
    body: string;
    eye: string;
    accent: string;
  };
  sounds?: {
    enter: string | null;
    exit: string | null;
  };
  emotions?: Record<string, {
    motion?: string;
    expression?: string;
  }>;
  [key: string]: any;
}

/** 皮肤分组接口 */
export interface SkinGroup {
  id: string;
  name: string;
  skins: Skin[];
}

/** 皮肤接口 */
export interface Skin {
  id: string;
  manifest: SkinManifest;
  config: SkinConfig;
  states: Record<string, StateConfig | any>;
}

/**
 * 皮肤加载器
 * 负责加载和管理桌宠皮肤
 */
class SkinLoader {
  /** 皮肤目录路径 */
  private skinsDir: string;

  /** 缓存的皮肤列表 */
  private skinsCache: Skin[] = [];

  /**
   * 创建皮肤加载器
   * @param skinsDir - 皮肤目录路径
   */
  constructor(skinsDir: string) {
    this.skinsDir = skinsDir;
  }

  /**
   * 加载所有可用皮肤
   * @returns 皮肤列表
   */
  loadSkins(): Skin[] {
    if (this.skinsCache.length > 0) {
      return this.skinsCache;
    }

    const skins: Skin[] = [];

    try {
      const skinDirs = readdirSync(this.skinsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .filter(skinId => skinId !== 'templates'); // 跳过templates文件夹

      for (const skinId of skinDirs) {
        const skin = this.loadSkin(skinId);
        if (skin) {
          skins.push(skin);
        }
      }
    } catch (error) {
      console.error('加载皮肤失败:', error);
    }

    this.skinsCache = skins;
    return skins;
  }

  /**
   * 加载单个皮肤
   * @param skinId - 皮肤 ID
   * @returns 皮肤对象，加载失败返回 null
   */
  loadSkin(skinId: string): Skin | null {
    const skinPath = join(this.skinsDir, skinId);

    // 检查皮肤目录是否存在
    if (!existsSync(skinPath)) {
      console.error(`皮肤目录不存在: ${skinPath}`);
      return null;
    }

    try {
      // 加载清单文件
      const manifestPath = join(skinPath, 'manifest.json');
      if (!existsSync(manifestPath)) {
        console.error(`皮肤清单文件不存在: ${manifestPath}`);
        return null;
      }

      const manifestContent = readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestContent);

      // 加载配置文件（可选）
      const configPath = join(skinPath, 'config.json');
      let config = {};
      if (existsSync(configPath)) {
        const configContent = readFileSync(configPath, 'utf8');
        config = JSON.parse(configContent);
      }

      // 加载状态配置（可选）
      const statesPath = join(skinPath, 'states');
      const states: Record<string, any> = {};

      if (existsSync(statesPath)) {
        const stateFiles = readdirSync(statesPath)
          .filter(file => file.endsWith('.json'));

        for (const stateFile of stateFiles) {
          const statePath = join(statesPath, stateFile);
          const stateContent = readFileSync(statePath, 'utf8');
          const state = JSON.parse(stateContent);
          states[state.name] = state;
        }
      }

      return {
        id: skinId,
        manifest,
        config,
        states
      };
    } catch (error) {
      console.error(`加载皮肤 ${skinId} 失败:`, error);
      return null;
    }
  }

  /**
   * 获取默认皮肤
   * @returns 默认皮肤，不存在返回 null
   */
  getDefaultSkin(): Skin | null {
    return this.loadSkin('cubism-Hiyori');
  }

  /**
   * 重新加载皮肤
   */
  reloadSkins(): void {
    this.skinsCache = [];
    this.loadSkins();
  }

  /**
   * 加载所有皮肤分组
   * @returns 皮肤分组列表
   */
  loadSkinGroups(): SkinGroup[] {
    const skins = this.loadSkins();
    const groupMap = new Map<string, SkinGroup>();

    for (const skin of skins) {
      const groupId = skin.manifest.group;
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, {
          id: groupId,
          name: this.getGroupName(groupId),
          skins: []
        });
      }
      groupMap.get(groupId)!.skins.push(skin);
    }

    return Array.from(groupMap.values());
  }

  /**
   * 获取分组显示名称
   * @param groupId - 分组ID
   * @returns 分组显示名称
   */
  private getGroupName(groupId: string): string {
    const groupNames: Record<string, string> = {
      'cubism': 'Cubism SDK',
      'anime': '二次元',
      'azurlane': '碧蓝航线',
      'girlsfrontline': '少女前线'
    };
    return groupNames[groupId] || groupId;
  }
}

/**
 * 创建皮肤加载器实例
 * @param skinsDir - 皮肤目录路径
 * @returns 皮肤加载器实例
 */
export function createSkinLoader(skinsDir: string): SkinLoader {
  return new SkinLoader(skinsDir);
}
