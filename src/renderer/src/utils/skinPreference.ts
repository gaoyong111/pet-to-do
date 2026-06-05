import { SKIN_GROUPS } from '../constants/skinGroups';

const SKIN_GROUP_KEY = 'pet-skin-group';
const SKIN_ID_KEY = 'pet-skin-id';
const DEFAULT_GROUP = 'cubism';
const DEFAULT_SKIN = 'cubism-Hiyori';

export interface SkinPreference {
  groupId: string;
  skinId: string;
}

export function findGroupForSkin(skinId: string): string | null {
  return SKIN_GROUPS.find(g => g.skins.some(s => s.id === skinId))?.id ?? null;
}

/** 读取并校验 localStorage 中的皮肤偏好 */
export function loadSkinPreference(): SkinPreference {
  const savedSkinId = localStorage.getItem(SKIN_ID_KEY);
  const savedGroupId = localStorage.getItem(SKIN_GROUP_KEY);

  let skinId = savedSkinId || DEFAULT_SKIN;
  let groupId = savedGroupId || findGroupForSkin(skinId) || DEFAULT_GROUP;

  const group = SKIN_GROUPS.find(g => g.id === groupId);
  if (!group || !group.skins.some(s => s.id === skinId)) {
    const skinGroup = SKIN_GROUPS.find(g => g.skins.some(s => s.id === skinId));
    if (skinGroup) {
      groupId = skinGroup.id;
    } else {
      groupId = DEFAULT_GROUP;
      skinId = SKIN_GROUPS.find(g => g.id === DEFAULT_GROUP)?.skins[0]?.id || DEFAULT_SKIN;
    }
  }

  return { groupId, skinId };
}

export function saveSkinPreference(groupId: string, skinId: string): void {
  localStorage.setItem(SKIN_GROUP_KEY, groupId);
  localStorage.setItem(SKIN_ID_KEY, skinId);
}
