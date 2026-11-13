# ADR-0006: Agent-független skillek és workflow-k

- Állapot: elfogadott
- Dátum: 2026-11-12
- Döntéshozók: SMark2256, ricsmond12
- Ticket: KG-5
- Kiegészíti: ADR-0003

## Kontextus

- Az ADR-0003 a közös szabályforrást (`AGENTS.md`) és a közös skilleket (`.agents/skills/`) rögzítette, de a
  skillek szövege konkrét eszközökre és modellekre épült: a review „Claude ↔ Gemini” párral és `claude -p`
  paranccsal, a council fix tagokkal (Claude Opus, Gemini, Claude Sonnet), a PR-várakozás és a kérdezés T3-,
  Claude Code- és Antigravity-specifikus eszközökkel, a memória Claude- és Antigravity-útvonalakkal.
- Emiatt egy fejlesztő azt érezhette, hogy egy adott eszközt (pl. Gemini CLI) használnia kell, és egy új
  eszköz bevezetése minden skill átírását jelentette volna.

## Döntés

- A skillek (`.agents/skills/`) és a workflow-k (`.agents/workflows/`) **eszköz- és modellfüggetlenek**:
  azt írják le, *mit* kell csinálni (pl. „friss, a fejlesztést nem látó agent-session review-zzon; más modell
  ajánlott, nem feltétel”, „várj a CI-ra watcherrel”).
- Minden eszközfüggő részlet (belépési pont, friss session indítása, PR-figyelés, kérdezés, memória helye,
  ideiglenes agent-ág) **egyetlen helyen** van: `docs/process/agent-adapters.md`. Új eszköznél csak ezt a
  fájlt bővítjük.
- A belépési pontok (`CLAUDE.md`, `.claude/skills/` mutatók, `.gemini/settings.json`, `.agents/workflows/`)
  maradnak; saját tartalmuk nincs, csak a közös forrásra mutatnak.
- Bármelyik agent-eszköz használható; a csapat nem ír elő eszközt vagy modellt.

## Következmények

- Új skill vagy skillmódosítás review-jában szempont: nincs benne eszköz- vagy modellnév. Kivétel:
  `docs/process/agent-adapters.md`, a belépési pontok, és a tiltólisták (pl. a `kg-git-workflow` ág- és
  commitnév-tiltása, ahol az eszköznév épp a tiltott minta).
- A független review és a council eredménysorában a ténylegesen használt modell neve szerepel, de a skill
  nem írja elő, melyik legyen.
- Frissítve: `kg-ticket-to-pr`, `kg-council`, `kg-babysit-pr`, `kg-full-stop`, `kg-knowledge`,
  `kg-git-workflow`, `kg-stack` (AI agentek sor), `AGENTS.md`, `docs/process/onboarding.md`.

## Mérlegelt alternatívák

| Alternatíva | Miért nem |
| ----------- | --------- |
| Eszközönként külön skill-változat | Több forrás, elcsúsznak - pont ezt kerülte az ADR-0003 |
| Eszköznevek maradnak, „például” jelöléssel | Továbbra is egy eszközt sugall, és új eszköznél minden skillt érinti |
| Egy eszköz kötelezővé tétele | A két fejlesztő különböző eszközt használhat; nem szükséges |
