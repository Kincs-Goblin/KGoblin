# Agent-adapterek

A skillek (`.agents/skills/`) és a workflow-k (`.agents/workflows/`) **eszközfüggetlenek**: azt írják le,
*mit* kell csinálni (pl. „friss, a fejlesztést nem látó agent-session review-zzon”, „várj a CI-ra”). Hogy
ezt egy adott eszközben *hogyan* teszed, az csak ebben a fájlban van. Új eszköznél ezt a táblázatot
bővítsd, a skilleket ne (ADR-0006).

Bármelyik eszközt használhatod; a közös forrás mindig az `AGENTS.md` és az `.agents/skills/`.

## Belépési pontok

| Eszköz | Szabályok | Skillek | Workflow-k |
|---|---|---|---|
| Claude Code (CLI, IDE, T3 Code) | `CLAUDE.md` → `AGENTS.md` | `.claude/skills/` mutatók → `.agents/skills/` | nincs; a skillt név vagy feladat alapján hívod |
| Antigravity | `AGENTS.md` | `.agents/skills/` | `.agents/workflows/` (`/ticket`, `/local-test` …) |
| Gemini CLI | `.gemini/settings.json` → `AGENTS.md` | `.agents/skills/` | nincs |
| Más agent | `AGENTS.md` (a gyökérből indítva) | `.agents/skills/` olvasása | nincs |

## Képességek eszközönként

| Képesség (a skillekben így szerepel) | Claude Code | Antigravity | Általános tartalék |
|---|---|---|---|
| **Friss review-session** (read-only, csak a diffet látja) | új session vagy tiszta kontextusú subagent; T3 Code-ban `delegate_task`; nem interaktívan `claude -p "<prompt>" --allowedTools "Bash(git diff:*),Bash(git log:*),Bash(git show:*),Bash(git grep:*),Bash(git fetch:*),Bash(git merge-base:*),Bash(gh pr view:*),Bash(gh pr diff:*),Bash(gh pr list:*),Read,Grep,Glob"` (a ticket AC-it és kommentjeit tedd a promptba, ha a session nem éri el a Jirát) | új agent-session read-only módban | új terminál/session ugyanazzal a prompttal |
| **Eltérő modell** (ajánlott, nem feltétel) | másik Claude-modell (pl. Sonnet, ha Opus implementált) vagy a T3-ban elérhető más provider | másik modell a modellválasztóban | ha nincs, ugyanaz a modell friss sessionben, és a PR-ban jelezve |
| **Várakozás CI-ra / review-ra** | T3 Code: `watch_pull_request` (átadás előtt `unwatch_pull_request`); CLI: `gh pr checks <pr> --watch --fail-fast` a háttérben/Monitorral | terminálban `gh pr checks <pr> --watch --fail-fast` | `gh pr checks <pr> --watch --fail-fast`, utána `gh pr view <pr> --comments` |
| **Kérdés a felhasználónak** (várakozó állapottal) | `AskUserQuestion` | az eszköz kérdező funkciója | a záró üzenet a kérdéssel kezdődik |
| **Többmodelles zsűri** (`kg-council`) | T3 Code: `orchestrator_capabilities`, majd tagonként `delegate_task`; CLI: tagonként külön session | tagonként külön session/modell | tagonként külön session; ami nem érhető el, „nem futott” |
| **Ticket-worktree** (ticketenként kötelező) | T3 Code: worktree-módú thread (`t3/<id>` ág, átnevezés a `kg-git-workflow` szerint); CLI: `git worktree add` | `git worktree add`, majd a session a worktree mappájában indul | `git worktree add --no-track ../KGoblin-KG-<n> -b KG-<n> origin/demo` (hotfix: `origin/main`) |
| **Jira-ticket olvasása** (csak olvasás; írás kifejezett kérésre) | Atlassian MCP (`claude.ai Atlassian`; előbb OAuth-engedélyezés a claude.ai connector-beállításokban): `getJiraIssue` (a kommenteknek csak a számát adja), `listJiraIssueComments` (a kommentek), `searchJiraIssuesUsingJql` (`cloudId`: `kincsgoblin.atlassian.net`); nagy válasz fájlba kerül (egy sor JSON), strukturáltan olvasd ki | az eszköz Jira-integrációja, ha van | a felhasználó beilleszti a leírást, a létrehozás dátumát és a kommenteket |
| **GitHub PR olvasása** | `gh pr view <n> --json …`, `gh pr diff <n>`, `gh pr list` (minden eszközben azonos); T3 Code-ban a linkelés/figyelés a PR-eszközökkel | `gh` a terminálban | `gh`; ha nincs, a PR-oldal és a `git diff origin/<base>...origin/<ág>` |
| **Személyes agent-memória** | `~/.claude/projects/<a fő checkout mappája, ':' '\' '/' '.' → '-'>/memory/` (pl. `E--Projects-KGoblin`); a repó worktree-jei ezt az egy poolt használják közösen | knowledge items + `~/.gemini/GEMINI.md` | nincs; ami fontos, a repóba megy (`kg-knowledge`) |

A memóriák egymás között nem látszanak: ami a csapatnak vagy egy másik eszköznek is kell, az a repóba megy.
