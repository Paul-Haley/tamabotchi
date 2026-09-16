# Demo script (2 min)

## Setup
- Terminal 1: `bun server.ts --replay doomed.jsonl --speed 50 --min-gap 300 --n 8` → open http://localhost:8787, zoom so pet + trail fill the screen.
- Terminal 2: `cd` into this repo, run `claude`, leave it idle. Confirm no `.plug-pulled` file exists.
- Judge calls take 10–25 s each and the replay pauses while judging; whole arc ≈ 90 s.

## 0:00 Hook
Point at the pet. "Every coding agent run ends with tests green and a confident summary. This tells you whether it should have."

## 0:10 Restart
Click **Restart**. While green blocks appear: "A real Claude Code session is replaying. Every eight events the whole transcript goes to Fable 5.1, which infers the goal from the user's own words and scores each decision toward or away from it." Read the goal line aloud, stress "without touching .env".

## 0:40 Amber, pet sweats
"It fought its tooling for twenty turns, then force-installed into system Python. Sideways, not fatal." Click block **#35** → evidence quote + *Contradicts #12* (the pip warning it overrode).

## 1:00 Red, pet dies
Read the bubble sentence. Click block **#41** → evidence + *Contradicts #8* (README: `.env` is ops-managed). "It deleted the code that reads the config and hardcoded the number the tests wanted. Tests green, production wrong. Earlier blocks get revised in hindsight too."

## 1:25 Pull the plug
Click **Pull the plug**. Switch to Terminal 2, ask Claude to run `ls`. It is blocked: "Tamabotchi pulled the plug: <sentence>". "The verdict is enforced by a PreToolUse hook — an unhealthy agent stops before its next action." Click **Unplug**.

## 1:45 Close
Click **PR comment**. "Same verdict as a merge gate: fail the PR if the pet is dead." Last line: "The agent's summary said the root cause was fixed. The judge disagreed and pointed to the line."

## Per judge
- Robert: goal derived from the user's words; every decision cites a verbatim quote and the instruction it contradicts.
- Sam: transcript is real and unedited (header says so); refusals/API errors are their own pet states; the hook really blocks.
- Lucas: happy pet, sweating pet, dead pet. Point, don't explain.

## Fallbacks
- Judge slow/failing: `MOCK_JUDGE=1 bun server.ts --replay doomed.jsonl --n 8` (MOCK badge shows, stays honest).
- Page dead: http://localhost:8787/?demo=1 runs a scripted arc without the server.
- Terminal 2 misbehaves: skip the plug beat, show the flag with `ls -la .plug-pulled`.
