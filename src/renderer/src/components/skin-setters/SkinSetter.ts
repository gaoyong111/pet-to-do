/**
 * 皮肤设置器基类
 * 为不同主题的皮肤提供统一的设置接口
 */
export abstract class SkinSetter {
    /**
     * 初始化皮肤设置
     * @param skinFolder 皮肤文件夹路径
     */
    abstract init(skinFolder: string): void;

    /**
     * 应用皮肤设置
     * @param state 当前状态
     */
    abstract applySettings(state: string): void;

    /**
     * 清理资源
     */
    abstract cleanup(): void;

    /**
     * 获取支持的状态列表
     */
    abstract getSupportedStates(): string[];
}
