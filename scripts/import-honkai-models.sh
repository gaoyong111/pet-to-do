#!/bin/bash

# 脚本用于将崩坏学园2的Live2D模型导入到皮肤系统中

# 模型源目录
MODEL_DIR="Live2d-model/崩坏学园2"

# 皮肤目标目录
SKIN_DIR="skins"

# 角色列表
ROLES=("BYC" "Kiana" "Kiro" "Lita" "Nina" "Nindi" "bronya" "delisha" "himeko" "houraiji" "kaguya" "keluoyi" "kika" "mie" "shin" "xier" "xilin2.1" "yazakura" "yiselin")

# 创建皮肤目录
mkdir -p "$SKIN_DIR"

# 循环处理每个角色
for ROLE in "${ROLES[@]}"; do
    echo "处理角色: $ROLE"
    
    # 源目录
    SOURCE_DIR="$MODEL_DIR/$ROLE"
    
    # 目标目录
    TARGET_DIR="$SKIN_DIR/honkai-$ROLE"
    
    # 创建目标目录
    mkdir -p "$TARGET_DIR"
    
    # 复制模型文件
    cp -r "$SOURCE_DIR"/* "$TARGET_DIR/"
    
    # 创建manifest.json
    cat > "$TARGET_DIR/manifest.json" << EOF
{
  "name": "崩坏学园2 - $ROLE",
  "author": "虚拟桌宠团队",
  "version": "1.0.0",
  "description": "崩坏学园2 $ROLE角色",
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
    "idle": { "motion": "motions/idle.mtn", "expression": "", "loop": true },
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
    
    # 创建config.json
    cat > "$TARGET_DIR/config.json" << EOF
{
  "defaultState": "idle",
  "stateTransitions": {
    "idle": ["working", "happy", "sad", "sleeping"],
    "working": ["idle", "happy", "sad"],
    "happy": ["idle", "working", "sad"],
    "sad": ["idle", "happy"],
    "sleeping": ["idle", "happy"]
  },
  "reactionMapping": {
    "pat": {
      "state": "happy",
      "bubble": "嘿嘿~",
      "duration": 2000
    },
    "poke": {
      "state": "sad",
      "bubble": "干嘛！",
      "duration": 2000
    },
    "angry": {
      "state": "sad",
      "bubble": "哼！",
      "duration": 2000
    }
  },
  "timePeriods": [
    {
      "startHour": 0,
      "endHour": 6,
      "state": "sleeping",
      "greetings": ["好困啊...zzZ", "夜深了，早点休息吧~", "主人还不睡吗..."]
    },
    {
      "startHour": 6,
      "endHour": 9,
      "state": "happy",
      "greetings": ["早上好呀~", "新的一天开始啦！", "主人早安~"]
    },
    {
      "startHour": 9,
      "endHour": 12,
      "state": "working",
      "greetings": ["开始工作啦！", "加油加油~", "今天也要元气满满哦"]
    },
    {
      "startHour": 12,
      "endHour": 14,
      "state": "happy",
      "greetings": ["午饭时间到~", "记得吃饭哦~", "休息一下吧~"]
    },
    {
      "startHour": 14,
      "endHour": 18,
      "state": "working",
      "greetings": ["下午好~", "继续加油！", "来杯下午茶？"]
    },
    {
      "startHour": 18,
      "endHour": 22,
      "state": "idle",
      "greetings": ["下班啦~", "辛苦了一天！", "晚上想做什么呢？"]
    },
    {
      "startHour": 22,
      "endHour": 24,
      "state": "sleeping",
      "greetings": ["该休息了~", "晚安~", "明天见！"]
    }
  ]
}
EOF
    
    # 创建states目录
    mkdir -p "$TARGET_DIR/states"
    
    # 创建idle状态配置
    cat > "$TARGET_DIR/states/idle.json" << EOF
{
  "name": "idle",
  "displayName": "空闲",
  "description": "$ROLE的空闲状态",
  "animation": {
    "type": "live2d",
    "parameters": {
      "motion": "motions/idle.mtn",
      "expression": ""
    }
  },
  "emotions": {
    "confused": {
      "motion": "motions/1.mtn",
      "expression": ""
    },
    "happy": {
      "motion": "motions/2.mtn",
      "expression": ""
    },
    "surprised": {
      "motion": "motions/3.mtn",
      "expression": ""
    }
  },
  "colors": {
    "body": "#FFE4E1",
    "eye": "#FF69B4",
    "accent": "#FF1493"
  },
  "sounds": {
    "enter": null,
    "exit": null
  }
}
EOF
    
    # 创建happy状态配置
    cat > "$TARGET_DIR/states/happy.json" << EOF
{
  "name": "happy",
  "displayName": "开心",
  "description": "$ROLE的开心状态",
  "animation": {
    "type": "live2d",
    "parameters": {
      "motion": "motions/2.mtn",
      "expression": ""
    }
  },
  "colors": {
    "body": "#FFE4E1",
    "eye": "#FF69B4",
    "accent": "#FF1493"
  },
  "sounds": {
    "enter": null,
    "exit": null
  }
}
EOF
    
    # 创建sad状态配置
    cat > "$TARGET_DIR/states/sad.json" << EOF
{
  "name": "sad",
  "displayName": "难过",
  "description": "$ROLE的难过状态",
  "animation": {
    "type": "live2d",
    "parameters": {
      "motion": "motions/3.mtn",
      "expression": ""
    }
  },
  "colors": {
    "body": "#E1E4FF",
    "eye": "#6984FF",
    "accent": "#1433FF"
  },
  "sounds": {
    "enter": null,
    "exit": null
  }
}
EOF
    
    # 创建working状态配置
    cat > "$TARGET_DIR/states/working.json" << EOF
{
  "name": "working",
  "displayName": "工作中",
  "description": "$ROLE的工作状态",
  "animation": {
    "type": "live2d",
    "parameters": {
      "motion": "motions/4.mtn",
      "expression": ""
    }
  },
  "colors": {
    "body": "#E1FFE4",
    "eye": "#69FF84",
    "accent": "#14FF33"
  },
  "sounds": {
    "enter": null,
    "exit": null
  }
}
EOF
    
    # 创建sleeping状态配置
    cat > "$TARGET_DIR/states/sleeping.json" << EOF
{
  "name": "sleeping",
  "displayName": "睡眠",
  "description": "$ROLE的睡眠状态",
  "animation": {
    "type": "live2d",
    "parameters": {
      "motion": "motions/idle.mtn",
      "expression": ""
    }
  },
  "colors": {
    "body": "#F0F0F0",
    "eye": "#A0A0A0",
    "accent": "#606060"
  },
  "sounds": {
    "enter": null,
    "exit": null
  }
}
EOF
    
    echo "角色 $ROLE 导入完成"
done

echo "所有角色导入完成！"
