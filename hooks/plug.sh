#!/bin/bash
# PreToolUse hook: block every tool call once Tamabotchi has pulled the plug.
FLAG="${TAMABOTCHI_FLAG:-${CLAUDE_PROJECT_DIR:-.}/.plug-pulled}"

if [ -f "$FLAG" ]; then
  echo "Tamabotchi pulled the plug: $(cat "$FLAG")" >&2
  exit 2
fi

exit 0
