import { SkinSetter } from './SkinSetter';
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display/cubism4';

/**
 * Live2D皮肤设置器
 * 专门用于处理Live2D模型的皮肤设置
 */
export class Live2DSkinSetter extends SkinSetter {
    private skinFolder: string = '';
    private model: Live2DModel | null = null;
    private manifest: any = null;
    private supportedStates: string[] = [];

    /**
     * 初始化皮肤设置
     * @param skinFolder 皮肤文件夹路径
     */
    async init(skinFolder: string): Promise<void> {
        this.skinFolder = skinFolder;
        
        // 加载manifest配置
        try {
            const manifestPath = `/skins/${skinFolder}/manifest.json`;
            const response = await fetch(manifestPath);
            this.manifest = await response.json();
            
            // 获取支持的状态列表
            this.supportedStates = this.manifest.supportedStates || ['idle', 'happy', 'sad', 'angry'];
        } catch (error) {
            console.error('加载manifest失败:', error);
            this.supportedStates = ['idle'];
        }
    }

    /**
     * 设置Live2D模型实例
     * @param model Live2D模型实例
     */
    setModel(model: Live2DModel): void {
        this.model = model;
    }

    /**
     * 应用皮肤设置
     * @param state 当前状态
     */
    applySettings(state: string): void {
        if (!this.model || !this.manifest) return;

        try {
            // 从manifest中获取状态对应的动作和表情
            if (this.manifest.stateMotionMapping && this.manifest.stateMotionMapping[state]) {
                const stateConfig = this.manifest.stateMotionMapping[state];
                
                // 播放动作
                if (stateConfig.motion) {
                    this.playMotion(stateConfig.motion);
                }
                
                // 播放表情
                if (stateConfig.expression) {
                    this.playExpression(stateConfig.expression);
                }
            }
        } catch (error) {
            console.error('应用皮肤设置失败:', error);
        }
    }

    /**
     * 播放动作
     * @param motionPath 动作路径
     */
    private playMotion(motionPath: string): void {
        if (!this.model) return;

        try {
            // 尝试直接使用动作路径
            this.model.motion(motionPath);
        } catch (e) {
            console.log('直接使用动作路径失败，尝试使用动作索引');
            
            // 根据动作文件名确定索引
            let motionIndex = 0;
            if (motionPath.includes('Wait_01')) {
                motionIndex = 14; // 00_Wait_01.motion3.json
            } else if (motionPath.includes('Appeal_01')) {
                motionIndex = 24; // 00_Appeal_01.motion3.json
            } else if (motionPath.includes('Happy_01')) {
                motionIndex = 13; // 00_Happy_01.motion3.json
            } else if (motionPath.includes('Sad_01')) {
                motionIndex = 36; // 00_Sad_01.motion3.json
            } else if (motionPath.includes('Anger_01')) {
                motionIndex = 0; // 00_Anger_01.motion3.json
            } else if (motionPath.includes('idle')) {
                motionIndex = 1; // 通用idle动作
            } else if (motionPath.includes('touch') || motionPath.includes('tap')) {
                motionIndex = 0; // 通用tap动作
            } else {
                motionIndex = 2; // 其他动作
            }
            
            // 尝试使用空动作组和索引播放
            try {
                this.model.motion('', motionIndex);
            } catch (error) {
                console.error('播放动作失败:', error);
            }
        }
    }

    /**
     * 播放表情
     * @param expressionPath 表情路径
     */
    private playExpression(expressionPath: string): void {
        if (!this.model) return;

        try {
            this.model.expression(expressionPath);
        } catch (error) {
            console.error('播放表情失败:', error);
        }
    }

    /**
     * 清理资源
     */
    cleanup(): void {
        this.model = null;
        this.manifest = null;
        this.supportedStates = [];
    }

    /**
     * 获取支持的状态列表
     */
    getSupportedStates(): string[] {
        return this.supportedStates;
    }
}
