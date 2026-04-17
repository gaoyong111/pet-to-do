#!/bin/bash

# 脚本功能：导入Cubism SDK示例模型到skins目录

# 源目录和目标目录
SOURCE_DIR="/Users/gaoyong/Desktop/CubismSdkForWeb/CubismSdkForWeb-5-r.5/Samples/Resources"
TARGET_DIR="skins"

# 模型名称映射
MODEL_NAMES=(
  "Haru"
  "Hiyori"
  "Mao"
  "Mark"
  "Natori"
  "Ren"
  "Rice"
  "Wanko"
)

# 批量导入模型
count=0
for model_name in "${MODEL_NAMES[@]}"; do
  model_dir="$SOURCE_DIR/$model_name"
  if [ -d "$model_dir" ]; then
    # 创建目标目录
    skin_dir="$TARGET_DIR/cubism-$model_name"
    mkdir -p "$skin_dir/model"
    
    # 复制模型文件
    cp -r "$model_dir"/* "$skin_dir/model/"
    
    # 查找model3.json文件
    MODEL3_JSON="$(find "$skin_dir/model" -name "*.model3.json" | head -1)"
    MODEL3_JSON_NAME=".model3.json"
    if [ -n "$MODEL3_JSON" ]; then
        MODEL3_JSON_NAME="$(basename "$MODEL3_JSON")"
    fi
    
    # 生成manifest.json
    cat > "$skin_dir/manifest.json" << EOF
{
  "name": "$model_name",
  "author": "Cubism SDK",
  "version": "1.0.0",
  "description": "Cubism SDK示例模型",
  "renderer": "live2d",
  "model": {
    "entry": "model/$MODEL3_JSON_NAME",
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
    "idle": { "motion": "", "expression": "", "loop": true },
    "working": { "motion": "", "expression": "", "loop": true },
    "happy": { "motion": "", "expression": "", "loop": false },
    "sad": { "motion": "", "expression": "", "loop": false },
    "sleeping": { "motion": "", "expression": "", "loop": true }
  },
  "reactionMapping": {
    "pat": { "motion": "", "expression": "", "bubble": "嘿嘿~" },
    "poke": { "motion": "", "expression": "", "bubble": "干嘛！" },
    "angry": { "motion": "", "expression": "", "bubble": "哼！" }
  }
}
EOF
    
    echo "导入模型: $model_name 完成"
    count=$((count + 1))
  fi
done

echo "批量导入完成，共导入 $count 个模型"
