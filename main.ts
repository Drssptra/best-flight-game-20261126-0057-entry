// Cloudgate — Sky Ring Run, a make.fun program/v1 entry (Node 22, standard
// library only). The game itself is the plain static files in game/ beside
// this file: a desktop browser loads game/index.html and its ES modules with
// no library and no network request. This program hands the game in: it
// copies game/ and screenshots/ into the output directory and writes
// /output/dossier.json, the summary the judge reads, using the vendored
// make.fun library.
//
// Play it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the rest refuse an entry the scorer would refuse — more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files in all, or a path under game/ over 1000 bytes. game/ counts
// beside /output's own 1000-entry cap, its screenshots/ and dossier.json.
const SCORER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

/** Copy a directory from beside this file into the output, when it is there. */
function copyIntoOutput(name) {
  const source = join(here, name);
  if (!existsSync(source)) return;
  cpSync(source, join(out, name), { recursive: true });
}

function handIn() {
  mkdirSync(out, { recursive: true });
  copyIntoOutput('game');
  mkdirSync(join(out, 'screenshots'), { recursive: true });
  copyIntoOutput('screenshots');
  writeFileSync(join(out, 'dossier.json'), buildDossier(out, SCORER_CAPS));
}

handIn();
