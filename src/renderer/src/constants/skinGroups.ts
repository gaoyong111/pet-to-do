export interface SkinGroup {
  id: string;
  name: string;
  skins: Array<{ id: string; name: string }>;
}

export const SKIN_GROUPS: SkinGroup[] = [
  {
    id: 'cubism',
    name: 'Cubism SDK',
    skins: [
      { id: 'cubism-Hiyori', name: 'Hiyori' },
    ],
  },
  {
    id: 'girlsfrontline',
    name: '少女前线',
    skins: [
      { id: 'girlsfrontline-command1', name: 'Command1' },
      { id: 'girlsfrontline-golden1', name: 'Golden1' },
      { id: 'girlsfrontline-shield1', name: 'Shield1' },
      { id: 'girlsfrontline-target1', name: 'Target1' },
    ],
  },
];
