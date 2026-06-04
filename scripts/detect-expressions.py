#!/usr/bin/env python3
"""
detect-expressions.py - Live2D 皮肤表情自动探测脚本
用法: python3 scripts/detect-expressions.py <皮肤目录>

输出: 该皮肤表情的探测结果 + 建议的 manifest.json 映射片段
"""

import json
import sys
from pathlib import Path


# ── 参数特征权重表 ──────────────────────────────────────────
# 根据 Natori / Ren 的实际 exp3.json 归纳

SMILE_INDICATORS = {
    "ParamEyeLSmile": 1.0,
    "ParamEyeRSmile": 1.0,
    "ParamMouthSmile": 1.0,
    "ParamCheek": 0.5,
}

SAD_INDICATORS = {
    "ParamMouthForm": -1.0,
    "ParamBrowLForm": -1.0,
    "ParamBrowRForm": -1.0,
    "ParamEyeLForm": -1.0,
    "ParamEyeRForm": -1.0,
}

ANGRY_INDICATORS = {
    "ParamBrowLY": -0.5,
    "ParamBrowRY": -0.5,
    "ParamMouthForm": -2.0,
    "ParamEyeSize": 0.3,
}

SURPRISED_INDICATORS = {
    "ParamBrowLY": 0.2,
    "ParamBrowRY": 0.2,
    "ParamMouthForm": -3.0,
    "ParamEyeLOpen": 0.3,
    "ParamEyeROpen": 0.3,
}

SLEEPY_INDICATORS = {
    "ParamEyeLOpen": -1.0,
    "ParamEyeROpen": -1.0,
    "ParamMouthOpenY": -0.5,
}

BLUSHING_INDICATORS = {
    "ParamCheek": 1.0,
}


# ── 读取 JSON ────────────────────────────────────────────────

def load_json(path: str) -> dict:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"  ⚠️  无法读取 {path}: {e}", file=sys.stderr)
        return {}


# ── 表情参数分析 ─────────────────────────────────────────────

def analyze_expression(exp_json: dict) -> dict:
    params = {p["Id"]: p["Value"] for p in exp_json.get("Parameters", [])}

    scores = {
        "happy": 0.0,
        "sad": 0.0,
        "angry": 0.0,
        "surprised": 0.0,
        "sleepy": 0.0,
        "blushing": 0.0,
        "neutral": 0.0,
    }

    # neutral 检测：Parameters 数组为空（真正的"不做任何改变"）
    if len(params) == 0:
        scores["neutral"] = 0.95

    # happy（微笑）—— 参数取值为正
    smile_score = 0.0
    for pid, weight in SMILE_INDICATORS.items():
        v = params.get(pid)
        if v is not None and v > 0.2:
            smile_score += abs(v * weight)
    if smile_score > 0.3:
        scores["happy"] = min(smile_score / 2.0, 1.0)

    # sad（悲伤）—— 参数取值为负（嘴下弯、眉下弯）
    sad_score = 0.0
    for pid, weight in SAD_INDICATORS.items():
        v = params.get(pid)
        if v is not None and v < -0.1:
            sad_score += abs(v * weight)
    if sad_score > 0.3:
        scores["sad"] = min(sad_score / 2.0, 1.0)

    # angry（生气）—— 眉毛下压 + 嘴巴下方
    angry_score = 0.0
    for pid, weight in ANGRY_INDICATORS.items():
        v = params.get(pid)
        if v is not None:
            if "BrowL" in pid and v < -0.3:
                angry_score += abs(v)
            if "Mouth" in pid and v < -1.5:
                angry_score += abs(v)
    if angry_score > 0.3:
        scores["angry"] = min(angry_score / 2.0, 1.0)

    # surprised（惊讶）—— 眉毛上扬 + 眼睛睁大
    surprise_score = 0.0
    for pid, weight in SURPRISED_INDICATORS.items():
        v = params.get(pid)
        if v is not None and v > 0.1:
            surprise_score += abs(v * weight)
    if surprise_score > 0.3:
        scores["surprised"] = min(surprise_score / 3.0, 1.0)

    # sleepy（睡觉/困）—— 眼睛闭合
    eye_l = params.get("ParamEyeLOpen", 1)
    eye_r = params.get("ParamEyeROpen", 1)
    if eye_l < 0.25 and eye_r < 0.25:
        scores["sleepy"] = 0.85
        if params.get("ParamMouthOpenY", 0) < -0.2:
            scores["sleepy"] = 1.0

    # blushing（脸红）
    cheek = params.get("ParamCheek", 0)
    if cheek > 0.3:
        scores["blushing"] = min(cheek, 1.0)

    return scores


def classify_expression(name: str, scores: dict) -> tuple:
    name_lower = name.lower()

    # 第一优先：文件名/Name 含有语义提示
    semantic_hints = {
        "smile": "happy",
        "happy": "happy",
        "joy": "happy",
        "sad": "sad",
        "cry": "sad",
        "tear": "sad",
        "angry": "angry",
        "anger": "angry",
        "mad": "angry",
        "surprise": "surprised",
        "shock": "surprised",
        "wow": "surprised",
        "sleep": "sleepy",
        "close": "sleepy",
        "blush": "blushing",
        "red": "blushing",
        "normal": "neutral",
        "default": "neutral",
        "idle": "neutral",
    }
    for hint, label in semantic_hints.items():
        if hint in name_lower:
            param_boost = scores.get(label, 0.0)
            return label, min(0.6 + param_boost * 0.4, 1.0)

    # 第二优先：纯参数分析
    best_label = "neutral"
    best_score = scores["neutral"]
    for label, score in scores.items():
        if label == "neutral":
            continue
        if score > best_score:
            best_score = score
            best_label = label

    if best_score < 0.3:
        return "neutral", max(scores["neutral"], 0.5)

    return best_label, best_score


# ── model3.json 读取与表情定义提取 ────────────────────────

def find_model3_json(skin_dir: Path) -> Path | None:
    candidates = list(skin_dir.rglob("*.model3.json"))
    if not candidates:
        return None
    if len(candidates) == 1:
        return candidates[0]
    # 多个候选：优先选含有表情定义的
    for p in candidates:
        d = load_json(str(p))
        exprs = (d.get("Expressions")
                  or d.get("FileReferences", {}).get("Expressions", []))
        if exprs:
            return p
    candidates.sort(key=lambda p: len(p.parts))
    return candidates[0]


def get_expression_defs(model3_path: Path) -> list:
    model3 = load_json(str(model3_path))
    if not model3:
        return []

    # Cubism 4.x: 顶层 Expressions
    exprs = model3.get("Expressions")
    if exprs is not None:
        return exprs

    # Cubism 3.x: FileReferences.Expressions
    exprs = model3.get("FileReferences", {}).get("Expressions")
    if exprs is not None:
        return exprs

    return []


def resolve_exp_file(model3_dir: Path, file_rel: str) -> Path:
    p1 = model3_dir / file_rel
    if p1.exists():
        return p1
    p2 = model3_dir / Path(file_rel).name
    if p2.exists():
        return p2
    found = list(model3_dir.parent.rglob(Path(file_rel).name))
    if found:
        return found[0]
    return p1


# ── 主探测逻辑 ────────────────────────────────────────────────

def detect_skin(skin_dir: Path) -> dict:
    model3_path = find_model3_json(skin_dir)
    if not model3_path:
        return {"error": f"在 {skin_dir} 中未找到 *.model3.json"}

    exprs_def = get_expression_defs(model3_path)
    if not exprs_def:
        return {"no_expressions": True, "model": model3_path.stem}

    model3_dir = model3_path.parent
    results = []

    print(f"\n📂 皮肤目录: {skin_dir}")
    print(f"📄 model3.json: {model3_path.relative_to(skin_dir)}")
    print(f"🎭 发现 {len(exprs_def)} 个表情定义\n")

    for expr in exprs_def:
        name = expr.get("Name", "unknown")
        file_rel = expr.get("File", "")
        exp_path = resolve_exp_file(model3_dir, file_rel)

        if not exp_path.exists():
            print(f"  ⚠️  {name}: 文件不存在 {file_rel}")
            results.append({"name": name, "file": file_rel, "error": "文件不存在"})
            continue

        exp_json = load_json(str(exp_path))
        if not exp_json:
            continue

        scores = analyze_expression(exp_json)
        label, confidence = classify_expression(name, scores)

        params = {p["Id"]: p["Value"] for p in exp_json.get("Parameters", [])}
        non_zero = [(k, v) for k, v in params.items() if abs(v) > 0.05]

        conf_str = f"{confidence:.0%}"
        icon = "✅" if confidence > 0.5 else "❓"
        print(f"  {icon} {name:<20} → {label:<12} 置信度: {conf_str}")
        if non_zero and confidence < 0.7:
            param_str = ", ".join(f"{k}={v}" for k, v in non_zero[:5])
            if len(non_zero) > 5:
                param_str += f" ... +{len(non_zero)-5}更多"
            print(f"      参数: {param_str}")

        results.append({
            "name": name,
            "file": file_rel,
            "label": label,
            "confidence": confidence,
            "scores": scores,
        })

    return {"results": results, "model": model3_path.stem, "skin_dir": str(skin_dir)}


# ── manifest.json 片段生成 ───────────────────────────────────

def print_manifest_fragment(results: list, model_name: str):
    print(f"\n{'='*60}")
    print(f"📋 建议的 manifest.json 映射片段（皮肤: {model_name}）")
    print(f"{'='*60}\n")

    # 构建 label → name 的最佳映射（取置信度最高的）
    label_to_name = {}
    for r in results:
        label = r.get("label")
        name = r.get("name")
        conf = r.get("confidence", 0)
        if not label or not name:
            continue
        if label not in label_to_name or conf > label_to_name[label][1]:
            label_to_name[label] = (name, conf)

    def get_name(label: str, min_conf: float = 0.4) -> str:
        entry = label_to_name.get(label)
        if entry and entry[1] >= min_conf:
            return entry[0]
        return ""

    # stateMotionMapping
    print('  "stateMotionMapping": {')
    state_configs = [
        ("idle", "idle", True),
        ("happy", "tap", False),
        ("sad", "tap", False),
        ("sleeping", "sleep", True),
        ("angry", "tap", False),
    ]
    lines = []
    for state, motion_hint, loop in state_configs:
        expr_name = get_name(state)
        motion = "Idle" if state == "idle" else ("Sleep" if state == "sleeping" else "Tap")
        lines.append(f'    "{state}": {{ "motion": "{motion}", "expression": "{expr_name}", "loop": {str(loop).lower()} }}')
    print(",\n".join(lines))
    print('  },')

    # reactionMapping
    print('\n  "reactionMapping": {')
    reaction_configs = [
        ("pat", "happy"),
        ("poke", "surprised"),
    ]
    lines = []
    for reaction, label in reaction_configs:
        expr_name = get_name(label)
        motion = "Tap"
        lines.append(f'    "{reaction}": {{ "motion": "{motion}", "expression": "{expr_name}", "bubble": "" }}')
    print(",\n".join(lines))
    print('  },')

    print(f"\n{'='*60}")
    print("⚠️  以上为自动生成结果，请手动校验后复制到 manifest.json")
    print("    未匹配到的表情请手动填写 expression 字段。")
    print(f"{'='*60}")


# ── 入口 ─────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print("用法: python3 detect-expressions.py <皮肤目录>")
        print("示例: python3 detect-expressions.py src/renderer/public/skins/cubism-Natori")
        sys.exit(1)

    skin_dir = Path(sys.argv[1]).resolve()
    if not skin_dir.is_dir():
        print(f"错误: {skin_dir} 不是有效目录")
        sys.exit(1)

    result = detect_skin(skin_dir)

    if "error" in result:
        print(f"❌ {result['error']}")
        sys.exit(1)

    if result.get("no_expressions"):
        print(f"ℹ️  该皮肤 ({result['model']}) 没有定义表情（Expressions: []）")
        print("   无需填写 expression 字段，程序会自动跳过。")
        sys.exit(0)

    results = result.get("results", [])
    if not results:
        print("❌ 没有成功分析任何表情文件")
        sys.exit(1)

    low_conf = [r for r in results
                if r.get("confidence", 0) < 0.5 and "label" in r]
    if low_conf:
        print(f"\n⚠️  以下 {len(low_conf)} 个表情置信度较低，建议手动确认:")
        for r in low_conf:
            print(f"    {r['name']} → {r['label']} ({r['confidence']:.0%})")

    print_manifest_fragment(results, result.get("model", ""))


if __name__ == "__main__":
    main()
