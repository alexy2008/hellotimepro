import * as fs from 'fs';
import * as path from 'path';

export interface Avatar {
  id: string;
  name: string;
  primaryColor: string;
  svgUrl: string;
}

let _avatars: Avatar[] = [];
let _loaded = false;

function loadAvatars(): Avatar[] {
  if (_loaded) return _avatars;
  _loaded = true;
  const catalogPath = path.resolve(
    process.env.REPO_ROOT || path.join(__dirname, '../../../../'),
    'spec/avatars/catalog.json',
  );
  try {
    const raw = fs.readFileSync(catalogPath, 'utf-8');
    const data = JSON.parse(raw);
    _avatars = (data.avatars ?? []).map((a: any) => ({
      id: a.id,
      name: a.name,
      primaryColor: a.primaryColor,
      svgUrl: a.svgUrl,
    }));
  } catch {
    _avatars = [];
  }
  return _avatars;
}

export const ALLOWED_AVATAR_IDS: Set<string> = new Set(
  ['neo', 'specter', 'glyph', 'pulse', 'circuit', 'nova', 'oracle', 'drift', 'echo', 'void'],
);

export { loadAvatars };
