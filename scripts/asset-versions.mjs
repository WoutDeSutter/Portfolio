import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * A short content hash for every file in the given folders of public/. The site adds it to the URL
 * (`models/items/tagrun.glb?v=18c59296`, see src/utils/assetUrl.ts), so when a file changes,
 * browsers download the new version instead of showing a cached old one. Unchanged files keep
 * their URL and stay cached.
 */
export function assetVersions(folders) {
  const versions = {};
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else {
        const key = relative('public', path).split(sep).join('/');
        versions[key] = createHash('sha1').update(readFileSync(path)).digest('hex').slice(0, 8);
      }
    }
  };
  for (const folder of folders) walk(join('public', folder));
  return versions;
}
