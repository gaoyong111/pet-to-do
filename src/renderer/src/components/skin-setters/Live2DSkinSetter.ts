import { SkinSetter } from './SkinSetter';
import { Live2DModel } from 'pixi-live2d-display/cubism4';

/**
 * Live2D皮肤设置器
 * 负责模型动作/表情播放 + 物理演算
 */
export class Live2DSkinSetter extends SkinSetter {
    private skinFolder: string = '';
    private model: Live2DModel | null = null;
    private manifest: any = null;
    private supportedStates: string[] = [];
    private _physicsData: any = null;

    /**
     * 初始化：加载 manifest + 预加载 physics3.json
     */
    async init(skinFolder: string): Promise<void> {
        this.skinFolder = skinFolder;

        try {
            const manifestPath = `/skins/${skinFolder}/manifest.json`;
            const response = await fetch(manifestPath);
            this.manifest = await response.json();
            this.supportedStates = this.manifest.supportedStates || ['idle', 'happy', 'sad', 'angry'];
        } catch (error) {
            console.error('[Live2D] Failed to load manifest:', error);
            this.supportedStates = ['idle'];
        }

        // 预加载 physics3.json
        await this._preloadPhysics();
    }

    /**
     * 预加载物理演算数据
     */
    private async _preloadPhysics(): Promise<void> {
        if (!this.manifest?.model?.entry) return;
        try {
            const modelJsonPath = `/skins/${this.skinFolder}/${this.manifest.model.entry}`;
            const resp = await fetch(modelJsonPath);
            const modelJson = await resp.json();
            const physicsFile = modelJson?.FileReferences?.Physics;
            if (!physicsFile) return;

            const physicsResp = await fetch(`/skins/${this.skinFolder}/model/${physicsFile}`);
            this._physicsData = await physicsResp.json();
        } catch {
            // physics 是可选的
        }
    }

    /**
     * 绑定 Live2DModel 并启用物理演算
     */
    setModel(model: Live2DModel): void {
        this.model = model;
        this._enablePhysics(model);
    }

    /**
     * 启用物理演算（头发/衣服摆动）
     */
    private _enablePhysics(model: Live2DModel): void {
        if (!this._physicsData) return;

        try {
            const internal = (model as any).internalModel;
            if (!internal) return;

            // pixi-live2d-display 的 Cubism4Model 会在 update() 内自动执行 physics.evaluate()
            // 如果模型已加载 physics，直接标记完成
            if (internal.physics) {
                console.log('[Live2D] Physics auto-enabled by pixi-live2d-display');
                return;
            }

            // 后备：手动通过 createPhysics() 创建
            if (typeof internal.createPhysics === 'function') {
                internal.createPhysics(internal.coreModel, this._physicsData);
                console.log('[Live2D] Physics manually enabled');
            }
        } catch (e) {
            console.log('[Live2D] Physics unavailable for this model');
        }
    }

    private _reactionTimer: ReturnType<typeof setTimeout> | null = null;
    private _currentState: string = 'idle';

    /**
     * 应用状态对应的动作和表情
     */
    applySettings(state: string): void {
        if (!this.model || !this.manifest) return;
        this._currentState = state;

        try {
            if (this.manifest.stateMotionMapping?.[state]) {
                const cfg = this.manifest.stateMotionMapping[state];
                if (cfg.motion) this._playMotion(cfg.motion);
                if (cfg.expression) this._playExpression(cfg.expression);
            }
        } catch (error) {
            console.error('[Live2D] Failed to apply settings:', error);
        }
    }

    /**
     * 应用交互反应（临时表情，覆盖后自动恢复）
     */
    applyReaction(reaction: string): void {
        if (!this.model || !this.manifest) return;

        try {
            const cfg = this.manifest.reactionMapping?.[reaction];
            if (!cfg) return;

            if (cfg.motion) this._playMotion(cfg.motion);
            if (cfg.expression) {
                this._playExpression(cfg.expression);
                // 2.5 秒后恢复到当前状态的表情
                if (this._reactionTimer) clearTimeout(this._reactionTimer);
                this._reactionTimer = setTimeout(() => {
                    this.applySettings(this._currentState);
                }, 2500);
            }
        } catch (error) {
            console.error('[Live2D] Failed to apply reaction:', error);
        }
    }

    /**
     * 播放动作
     * 支持格式:
     * - "GroupName" => 从该组随机播放 (如 "Idle")
     * - "GroupName:index" => 播放指定索引 (如 "Idle:0")
     * - "" => 不播放
     */
    private _playMotion(motionPath: string): void {
        if (!this.model || !motionPath) return;

        let group = motionPath;
        let index: number | undefined;

        // 解析 "Group:Index" 格式
        const colonIdx = motionPath.lastIndexOf(':');
        if (colonIdx > 0) {
            const parsedIdx = parseInt(motionPath.slice(colonIdx + 1), 10);
            if (!isNaN(parsedIdx)) {
                group = motionPath.slice(0, colonIdx);
                index = parsedIdx;
            }
        }

        this.model.motion(group, index).catch((err: Error) => {
            console.error('[Live2D] Failed to play motion:', motionPath, err);
        });
    }

    private _playExpression(expressionPath: string): void {
        if (!this.model) return;
        try {
            this.model.expression(expressionPath);
        } catch (error) {
            console.error('[Live2D] Failed to play expression:', error);
        }
    }

    cleanup(): void {
        this._physicsData = null;
        this.model = null;
        this.manifest = null;
        this.supportedStates = [];
    }

    getSupportedStates(): string[] {
        return this.supportedStates;
    }
}
