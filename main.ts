// Swiftboard's hand-in program (Node 22, standard library only): the
// frontend is this repository's app/ folder — plain static files a browser
// opens at app/index.html — plus screenshots/ of the running app on live
// make.fun data. This program copies both to the output directory and
// writes dossier.json with the vendored make.fun library, the summary the
// judge reads (screenshots, first-load files and bytes, source).
//
// The grader runs it twice in a container with no network, a read-only
// copy of the repository and a writable /output; both runs must write the
// same bytes. Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Leave vendor/makefun-frontend.ts untouched: the scorer rebuilds the
// dossier with its own copy of that library and requires the two to match
// byte for byte.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(outDir, 'app'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The scorer's own caps: at most 3 screenshots of 256 KiB each, app/ at
// most 993 files and directories and 16 MiB, the dossier text at most
// 160 KiB. Anything past a cap fails here with the library's own words.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 3, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 16777216,
  }),
);
