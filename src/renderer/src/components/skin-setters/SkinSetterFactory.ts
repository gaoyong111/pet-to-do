import { SkinSetter } from './SkinSetter';
import { Live2DSkinSetter } from './Live2DSkinSetter';

/**
 * 皮肤设置器工厂
 * 根据皮肤类型创建相应的皮肤设置器
 */
export class SkinSetterFactory {
    /**
     * 创建皮肤设置器
     * @param skinType 皮肤类型
     * @returns 皮肤设置器实例
     */
    static createSkinSetter(skinType: string): SkinSetter {
        switch (skinType) {
            case 'live2d':
                return new Live2DSkinSetter();
            default:
                // 默认使用Live2D皮肤设置器
                return new Live2DSkinSetter();
        }
    }
}
