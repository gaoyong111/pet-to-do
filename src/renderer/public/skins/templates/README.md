# 皮肤模板使用说明

## 皮肤系统改进

本次改进使皮肤系统更加灵活和可扩展，支持不同主题的个性化配置。主要改进包括：

1. **皮肤加载器改进**：
   - 配置文件现在是可选的，皮肤可以只包含manifest.json
   - 支持不同格式的皮肤配置
   - 更加容错，即使缺少某些配置也能正常加载

2. **Live2DPet组件改进**：
   - 更加灵活的动作播放逻辑，支持直接使用动作路径或动作索引
   - 更好的错误处理，即使配置不完整也能尝试使用默认动作
   - 支持不同格式的状态配置

3. **配置模板**：
   - 提供了不同类型的皮肤配置模板，方便用户根据需求选择

## 模板类型

### 1. 简单Live2D皮肤模板 (simple-live2d-template)

适用于基础主题，配置简单，包含基本的状态和动作映射。

**特点**：
- 只需要manifest.json文件
- 包含基本的状态动作映射
- 适用于简单的Live2D模型

**使用方法**：
1. 复制`simple-live2d-template`文件夹
2. 重命名为你的皮肤名称
3. 修改manifest.json中的配置
4. 添加你的模型文件和动作文件

### 2. 复杂Live2D皮肤模板 (complex-live2d-template)

适用于高级主题，配置完整，包含详细的状态和反应映射。

**特点**：
- 包含完整的配置选项
- 支持更多的状态和反应
- 适用于复杂的Live2D模型

**使用方法**：
1. 复制`complex-live2d-template`文件夹
2. 重命名为你的皮肤名称
3. 修改manifest.json中的配置
4. 添加你的模型文件、动作文件和表情文件
5. 可选：添加states目录和状态配置文件

## 配置说明

### manifest.json 基本配置

```json
{
  "name": "皮肤名称",
  "author": "作者",
  "version": "1.0.0",
  "description": "皮肤描述",
  "group": "分组名称",
  "renderer": "live2d",
  "model": {
    "entry": "模型入口文件路径",
    "scale": 模型缩放比例,
    "anchor": [锚点X, 锚点Y]
  }
}
```

### 状态动作映射

```json
"stateMotionMapping": {
  "idle": { "motion": "idle动作路径", "expression": "表情路径", "loop": 是否循环 },
  "tap": { "motion": "tap动作路径", "expression": "表情路径", "loop": 是否循环 }
  // 更多状态...
}
```

### 反应映射

```json
"reactionMapping": {
  "pat": { "motion": "pat动作路径", "expression": "表情路径", "bubble": "气泡文本" },
  "poke": { "motion": "poke动作路径", "expression": "表情路径", "bubble": "气泡文本" }
  // 更多反应...
}
```

## 注意事项

1. 模型文件应该放在皮肤目录的根目录或model子目录中
2. 动作文件应该放在motions子目录中
3. 表情文件应该放在expressions子目录中
4. 纹理文件应该放在textures子目录中
5. 状态配置文件应该放在states子目录中

## 示例

### 简单皮肤示例

```json
{
  "name": "我的简单皮肤",
  "author": "我",
  "version": "1.0.0",
  "description": "一个简单的Live2D皮肤",
  "group": "anime",
  "renderer": "live2d",
  "model": {
    "entry": "model.json",
    "scale": 0.15,
    "anchor": [0.5, 0.5]
  },
  "stateMotionMapping": {
    "idle": { "motion": "motions/idle.motion3.json", "loop": true },
    "tap": { "motion": "motions/tap.motion3.json", "loop": false }
  }
}
```

### 复杂皮肤示例

```json
{
  "name": "我的复杂皮肤",
  "author": "我",
  "version": "1.0.0",
  "description": "一个复杂的Live2D皮肤",
  "group": "anime",
  "renderer": "live2d",
  "model": {
    "entry": "model.json",
    "scale": 0.15,
    "anchor": [0.5, 0.5]
  },
  "size": {
    "width": 400,
    "height": 500
  },
  "defaultState": "idle",
  "supportedStates": ["idle", "working", "happy", "sad", "sleeping"],
  "supportedReactions": ["pat", "poke", "angry"],
  "stateMotionMapping": {
    "idle": { "motion": "motions/idle.motion3.json", "loop": true },
    "working": { "motion": "motions/working.motion3.json", "loop": true },
    "happy": { "motion": "motions/happy.motion3.json", "loop": false },
    "sad": { "motion": "motions/sad.motion3.json", "loop": false },
    "sleeping": { "motion": "motions/sleeping.motion3.json", "loop": true }
  },
  "reactionMapping": {
    "pat": { "motion": "motions/pat.motion3.json", "bubble": "嘿嘿~" },
    "poke": { "motion": "motions/poke.motion3.json", "bubble": "干嘛！" },
    "angry": { "motion": "motions/angry.motion3.json", "bubble": "哼！" }
  }
}
```
