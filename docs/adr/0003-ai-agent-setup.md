# ADR-0003: AI-agent setup - AGENTS.md, közös skillek Claude Code-nak és Antigravitynek

- Állapot: elfogadott
- Dátum: 2026-11-12
- Döntéshozók: SMark2256, ricsmond12
- Kiegészítve: ADR-0006 (agent-független skillek)

## Kontextus

- Két AI agentet használunk: Claude Code-ot és Antigravityt. Mindkettő olvassa az `AGENTS.md`-t; a Claude
  a `CLAUDE.md`-t és a `.claude/skills/`-t, az Antigravity az `.agents/skills/`-t és az `.agents/workflows/`-t.
- A szabályok és a skillek ne duplikálódjanak, és ne csússzanak el egymástól.
- Minták: a BILDR HUB agent-kit (céges szabályok, `pr`, `release`, `full-stop`, `babysit-pr`, `council`) és a
  bildr-platform (`bildr-architecture`, FSD-szintek, ADR-sablon, ticket-sablon, DoR/DoD). Ezekből csak
  kiolvastunk; semmi nincs bekötve, symlinkelve vagy függőségként felvéve.

## Döntés

- **`AGENTS.md`** az egyetlen közös szabályforrás (≤ 150 sor, projektspecifikus). A **`CLAUDE.md`** csak
  `@AGENTS.md`.
- **Skillek forrása:** `.agents/skills/<név>/SKILL.md` (+ `references/`). A `.claude/skills/<név>/SKILL.md`
  ugyanazzal a frontmatterrel csak mutató. Symlink nincs, mert Windowson a git-symlink megbízhatatlan.
- **Antigravity-workflow-k:** `.agents/workflows/*.md`, vékonyak, a skillekre mutatnak (`/ticket`,
  `/release-cut`, `/release-ship`, `/demo-sync`, `/hotfix`, `/stack-change`, `/full-stop`).
- **Skill-készlet:** `kg-stack`, `kg-architecture`, `kg-git-workflow`, `kg-ticket-to-pr`, `kg-release`,
  `kg-dev-practices`, `kg-knowledge`, `kg-full-stop`, `kg-babysit-pr`, `kg-council`. A `kg-` előtag megelőzi az
  ütközést a globálisan telepített skillekkel.
- **Stack-változás** csak a `kg-stack` folyamatával (opciós kérdés → ADR → döntésnapló → AGENTS.md).
- **AI-attribúció** nincs commitban, PR-ben és branchnévben. (2026-11-13 óta az ADR-0007 szerint az AI-val
  készült commit `Co-Authored-By` footert kap; a PR-ben és az ágnévben továbbra sincs.)

## Következmények

- Új skillnél két fájl kell (forrás + mutató); a mutató frontmatterének egyeznie kell a forráséval. Később
  ezt egy CI-ellenőrzés is nézheti.
- A skillek a repóval együtt verziózódnak, és review-n mennek át, mint a kód.
- Ha valamelyik eszköz natívan elkezdi olvasni a másik mappáját, a mutatók törölhetők (új ADR).

## Mérlegelt alternatívák

| Alternatíva | Miért nem |
| ----------- | --------- |
| Külön `CLAUDE.md` és `GEMINI.md` tartalommal | Két forrás, elcsúsznak |
| Symlink `.claude/skills` → `.agents/skills` | Windowson fejlesztői mód és `core.symlinks` kell, könnyen törik |
| Szinkronszkript a két mappa között | Plusz eszköz és lépés; a mutató egyszerűbb |
| Az agent-kit vagy a bildr-platform skilljeinek bekötése | BILDR-specifikusak (Jira-site, bdrop, csomagok); kifejezetten nem akartunk külső összekötést |
