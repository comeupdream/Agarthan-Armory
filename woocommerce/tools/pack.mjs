// pack.mjs — zips the theme for Appearance → Themes → Add New → Upload.
// The zip holds one folder, agarthan-armory/, so uploading a newer zip
// updates the installed theme in place (menus, widgets and settings stay).
// Run: node woocommerce/tools/pack.mjs   →   woocommerce/theme/agarthan-armory.zip
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const THEMES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../theme');
const out = path.join(THEMES, 'agarthan-armory.zip');
fs.rmSync(out, { force: true });
execFileSync('python3', ['-c', `
import os, sys, zipfile
root, out = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for d, dirs, files in os.walk(os.path.join(root, 'agarthan-armory')):
        dirs.sort()
        for f in sorted(files):
            if f.startswith('.'):
                continue
            p = os.path.join(d, f)
            z.write(p, os.path.relpath(p, root))
`, THEMES, out]);
const version = fs.readFileSync(path.join(THEMES, 'agarthan-armory/style.css'), 'utf8').match(/^Version:\s*(.+)$/m)[1];
console.log(`✓ agarthan-armory ${version} → ${path.relative(process.cwd(), out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
