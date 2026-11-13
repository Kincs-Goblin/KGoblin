# Első lépések a projektben

Új fejlesztőnek vagy új gépen. A szabályok és a skillek a repóban vannak, ezért külön telepítés nem kell;
a lényeg, hogy az agent a **repó gyökeréből** induljon.

## 1. Repó és eszközök

```bash
git clone https://github.com/Kincs-Goblin/KGoblin.git
cd KGoblin
git config user.name "<saját név>"
git config user.email "<saját email>"
gh auth login          # a PR- és CI-lépésekhez
```

## 2. Agent beállítása

Bármelyik agent-eszköz használható; a skillek eszközfüggetlenek. Hogy egy skill lépését (friss review-session,
PR-figyelés, kérdezés, memória) a te eszközödben hogyan csinálod: `docs/process/agent-adapters.md`.

| Eszköz | Mit olvas | Teendő |
|---|---|---|
| **Claude Code** | `CLAUDE.md` (→ `AGENTS.md`), `.claude/skills/` | a repó gyökeréből indítsd |
| **Antigravity** | `AGENTS.md`, `.agents/skills/`, `.agents/workflows/` | a repó gyökerét nyisd meg workspace-ként |
| **Gemini CLI** | `.gemini/settings.json` → `AGENTS.md`, `.agents/skills/` | a repó gyökeréből indítsd |

Az `.agents/`, `.claude/` és `.gemini/` mappa soha ne kerüljön `.gitignore`-ba.

A saját preferenciák (nyelv, stílus, válaszhossz) a globális agent-fájlba mennek (`~/.claude/CLAUDE.md`,
`~/.gemini/GEMINI.md`), nem a repóba.

## 3. Ellenőrzés

Írd az agentnek:

> Olvasd el az AGENTS.md-t, és sorold fel, milyen kg- skilleket látsz.

Mind a 10 `kg-*` skillnek meg kell jelennie (`kg-stack`, `kg-architecture`, `kg-git-workflow`,
`kg-ticket-to-pr`, `kg-release`, `kg-dev-practices`, `kg-knowledge`, `kg-full-stop`, `kg-babysit-pr`,
`kg-council`).

- Antigravity: `/` leütésére látszanak a workflow-k (`ticket`, `release-cut`, `release-ship`, `demo-sync`,
  `hotfix`, `stack-change`, `full-stop`, `local-test`).
- Gemini CLI: `/skills list`. Workflow-k itt nincsenek; a skilleket név szerint vagy feladattal hívod
  („vidd végig a KG-42-t”).

Ha valamelyik skill hiányzik, nézd meg, hogy a gyökérből indult-e az agent, és jelezd a csapatnak.

## 4. Mit olvass el

1. `AGENTS.md` - a közös szabályok.
2. `docs/project-plan.md` - cél, mérföldkövek, nyitott döntések.
3. `.agents/skills/kg-git-workflow/SKILL.md` - ágak és merge-szabályok.
4. `.agents/skills/kg-ticket-to-pr/SKILL.md` - hogyan megy végig egy ticket.
5. `docs/process/infrastructure.md` - CI, branch protection, Vercel és Trigger.dev env-változók.

Lokális környezeti változók: másold le az `apps/web/.env.example` fájlt `apps/web/.env.local` néven, az `apps/jobs/.env.example` fájlt `apps/jobs/.env.local` néven (a Docker-Woo-hoz pedig igény szerint a gyökér `.env.example` fájlt `.env` néven).

Az első munka a ticket-sablon szerinti Jira-ticketből indul (`docs/process/ticket-template.md`).
