// Bountyline's hand-in program (Node 22, standard library only). The
// frontend is this repository's app/ folder — plain static files a
// browser opens at app/index.html, reading make.fun's public API — plus
// screenshots/ of the running app on live data. This program copies
// both into the output directory and writes dossier.json with the
// vendored make.fun library: the summary the judge reads (screenshots,
// first-load files and bytes, source).
//
// The grader runs it twice in a container with no network, a read-only
// copy of the repository and a writable /output; both runs must write
// the same bytes, so the output directory is cleared first. Outside the
// grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Leave vendor/makefun-frontend.ts untouched: the scorer rebuilds the
// dossier with its own copy of that library and requires the two to
// match byte for byte.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repo = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Copy one top-level tree of the repository into the output directory. */
function copyTree(name: string): void {
  const from = join(repo, name);
  if (existsSync(from)) cpSync(from, join(out, name), { recursive: true });
}

// A clean output directory every run, so the two grader runs — and any
// local re-run — write exactly the same bytes.
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
copyTree('app');
copyTree('screenshots');

// The scorer's own caps: at most 3 screenshots of 256 KiB each, app/ at
// most 993 files and directories and 16 MiB, the dossier text at most
// 160 KiB. Anything past a cap fails here with the library's own words.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 3, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 16777216,
  }),
);
