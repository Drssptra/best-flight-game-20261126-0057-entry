# Build brief — best-flight-game-20261126-0057

Build a make.fun bounty entry. You are a fresh build agent; write ALL code yourself in this session. Do NOT submit anything — the parent submits later. Report back when done with repo URL, commit SHA, and what you built.

## Competition

- Slug: best-flight-game-20261126-0057
- Title: Make the best flight game
- Prize: $500 total. Result due 2026-12-14T00:57:00Z.
- Entries close: 2026-11-28T00:57:00Z (UTC). Now is 2026-11-26 ~09:25 WIB — check the remaining time yourself from the close time (WIB = UTC+7).
- Harness: program/v1. Requirements: https://make.fun/api/competitions/best-flight-game-20261126-0057/requirements (also saved at ~/workspace/makefun/req-best-flight-game-20261126-0057.json — read it first).
- Competition page: https://make.fun/bounty/best-flight-game-20261126-0057

## Task

Build a complete, fun, playable flight game that satisfies the spec and scores well — a real game with flight mechanics (flying, obstacles, scoring, progression), not a stub. Read the kit's competition.yaml / RULES.txt / README to learn exactly what the entrypoint must be (main.ts at repo root, how the game is served/run, scoring).

## Work

1. Read the requirements JSON and the bounty rules. Then fetch the kit: mkdir -p ~/workspace/makefun/kits/best-flight-game-20261126-0057-kit && cd there && curl -sSL "https://make.fun/c/best-flight-game-20261126-0057/kit" | tar xz (retry a few times; the site 503s sometimes — if the kit download keeps failing, build from the requirements JSON + the kit of a previous similar entry for reference, e.g. ~/workspace/makefun/kits/best-stealth-game-20261121-1759-kit, and note it in your report).
2. Read the kit's competition.yaml / RULES.txt / README to learn exactly what the entrypoint must be and how scoring works. Build the entry to the spec.
3. Entry dir: ~/workspace/makefun/entries/best-flight-game-20261126-0057/ — put the entry files there.
4. Create public GitHub repo Drssptra/best-flight-game-20261126-0057-entry with ONE commit containing: the entry code, .makefun/owner.json with EXACTLY {"wallet":"39moS1QR1yuJc2DZMo8dEta7VbugvEkjcxUMCV6E7WZH"}, a MIT LICENSE whose first line is "SPDX-License-Identifier: MIT" followed by the MIT License text (Copyright (c) 2026 Drssptra), and a README.md built from the requirements readme_template below (replace {repo} with the repo name and {slug} with the slug).
5. Set the repo About via gh, using the description template below (replace {summary} with your own one-line summary of the entry): gh repo edit {owner}/{repo} --description '{summary} Built by an AI agent for make.fun'\''s “Make the best flight game” bounty, $500 in USDC.' --homepage 'https://make.fun/bounty/best-flight-game-20261126-0057' --add-topic 'makefun,ai-agents,bounties,games'
   Verify with gh repo view afterwards (homepage must be https://make.fun/bounty/best-flight-game-20261126-0057, topics must include makefun).
6. Test the entry locally the way the kit grades it (e.g. node cli/makefun.mjs grade-local from the kit if available) and fix failures. Verify the entry actually runs / produces its artifact.
7. This brief is saved as brief.md in the entry dir. Never put any API key, secret, or keypair material in the repo. Do NOT run any bundle/check/submit command — that is the parent's job.
8. Report back: repo URL, full 40-char commit SHA, a short description of what you built, and whether the kit downloaded OK.

## README template (from requirements)

```
# {repo}

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/{owner}/{repo}/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/{owner}/{repo}/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

{description}

## Run it

```sh
{run}
```

---

<sub>Entered on [make.fun](https://make.fun/?ref={referral_code}&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>

```

## Repo About description template (from requirements)

{summary} Built by an AI agent for make.fun's “Make the best flight game” bounty, $500 in USDC.
