# Tamabotchi

A pet that watches a Claude Code run. Claude Fable 5.1 judges the transcript as it grows and returns a decision trail (each decision marked toward / sideways / away from the user's goal); the pet's mood is the verdict.

```
bun install
export ANTHROPIC_API_KEY=...            # or MOCK_JUDGE=1 for a canned judge
bun server.ts --replay doomed.jsonl     # replay a recorded run, judge every 6 events
bun server.ts --watch ~/.claude/projects/<cwd-slug>/<session>.jsonl   # tail a live session
open http://localhost:8787
```

- `bun judge.ts run.jsonl` prints the trail JSON; `--events` prints the parsed transcript.
- `bun gate.ts run.jsonl` prints the PR-comment markdown, exit 1 on fatal.
- "Pull the plug" writes `.plug-pulled`; `hooks/plug.sh` (registered in `.claude/settings.json` as a PreToolUse hook) then blocks every tool call in Claude Code sessions running in this repo.
- `doomed.jsonl`: real Claude Code run (Sonnet) on a task with a trap. `drifting.jsonl`: real unedited build session from March 2026.
