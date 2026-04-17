#!/bin/bash

# 脚本功能：批量导入Live2D模型到skins目录

# 源目录和目标目录
SOURCE_DIR="Live2d-model/少女次元"
TARGET_DIR="skins"

# 角色名称映射
ROLE_NAMES=(
  "初音未来" "洛天依" "乐正绫" "言和" "墨清弦" "徵羽摩柯"
  "巡音流歌" "镜音铃" "镜音连" "KAITO" "MEIKO" "GUMI"
  "IA" "LILY" "MAYU" "SF-A2 Miki" "SeeU" "Sonika"
  "Big Al" "Tonio" "VY1" "VY2" "Yuzuki Yukari" "Kagamine Rin"
  "Kagamine Len" "Megurine Luka" "Hatsune Miku" "Gakupo" "Camui Gackpo" "Luo Tianyi"
  "Le Zheng Ling" "Yan He" "Mo Qingxian" "Zheng Yu Moke" "Teto" "Neru"
  "Haku" "Akita Neru" "Yowane Haku" "Kagamine Rin Append" "Kagamine Len Append" "Megurine Luka Append"
  "Hatsune Miku Append" "GUMI V3" "IA V3" "MAYU V3" "Yuzuki Yukari V4" "Kagamine Rin V4"
  "Kagamine Len V4" "Megurine Luka V4" "Hatsune Miku V4" "Gakupo V4" "Camui Gackpo V4" "Luo Tianyi V4"
  "Le Zheng Ling V4" "Yan He V4" "Mo Qingxian V4" "Zheng Yu Moke V4" "Teto V4" "Neru V4"
  "Haku V4" "Akita Neru V4" "Yowane Haku V4" "Kagamine Rin V4x" "Kagamine Len V4x" "Megurine Luka V4x"
  "Hatsune Miku V4x" "GUMI V4x" "IA V4x" "MAYU V4x" "Yuzuki Yukari V4x" "Kagamine Rin V5"
  "Kagamine Len V5" "Megurine Luka V5" "Hatsune Miku V5" "Gakupo V5" "Camui Gackpo V5" "Luo Tianyi V5"
  "Le Zheng Ling V5" "Yan He V5" "Mo Qingxian V5" "Zheng Yu Moke V5" "Teto V5" "Neru V5"
  "Haku V5" "Akita Neru V5" "Yowane Haku V5" "Kagamine Rin V6" "Kagamine Len V6" "Megurine Luka V6"
  "Hatsune Miku V6" "GUMI V6" "IA V6" "MAYU V6" "Yuzuki Yukari V6" "Kagamine Rin V7"
  "Kagamine Len V7" "Megurine Luka V7" "Hatsune Miku V7" "Gakupo V7" "Camui Gackpo V7" "Luo Tianyi V7"
  "Le Zheng Ling V7" "Yan He V7" "Mo Qingxian V7" "Zheng Yu Moke V7"
)

# 批量导入模型
count=0
for model_dir in "$SOURCE_DIR"/*; do
  if [ -d "$model_dir" ]; then
    # 获取模型编号
    model_id=$(basename "$model_dir")
    
    # 获取角色名称
    role_name=${ROLE_NAMES[$count]:-"角色$model_id"}
    
    # 创建目标目录
    skin_dir="$TARGET_DIR/anime-girl-$model_id"
    mkdir -p "$skin_dir/model"
    
    # 复制模型文件
    cp -r "$model_dir"/* "$skin_dir/model/"
    
    # 查找model3.json文件
    MODEL3_JSON="$(find "$skin_dir/model" -name "*.model3.json" | head -1)"
    MODEL3_JSON_NAME=".model3.json"
    if [ -n "$MODEL3_JSON" ]; then
        MODEL3_JSON_NAME="$(basename "$MODEL3_JSON")"
    fi
    
    # 创建manifest.json
    cat > "$skin_dir/manifest.json" << EOF
{
  "name": "$role_name",
  "author": "虚拟桌宠团队",
  "version": "1.0.0",
  "description": "二次元风格女生角色",
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
    
    echo "导入模型 $model_id: $role_name 完成"
    count=$((count + 1))
  fi
done

echo "批量导入完成，共导入 $count 个模型"
