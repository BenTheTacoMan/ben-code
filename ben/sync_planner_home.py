#!/usr/bin/env python3
"""Build ~/.claude-planner: a Claude home that mirrors ~/.claude-hub but cannot edit files.

The Planner thread runs on a provider instance whose homePath is this directory. Its
settings.json is the hub settings plus deny rules for every file-changing tool and every
destructive shell command, so the restriction is enforced by Claude Code, not by a prompt.
Run again after changing ~/.claude-hub/settings.json. Contains the hub proxy token, so the
file mode is 600 and this script never prints it.
"""
import json
import os
import sys

HOME = os.path.expanduser("~")
HUB = os.path.join(HOME, ".claude-hub")
PLANNER = os.path.join(HOME, ".claude-planner")

DENY = [
    "Edit",
    "Write",
    "NotebookEdit",
    "Bash(rm:*)",
    "Bash(mv:*)",
    "Bash(cp:*)",
    "Bash(tee:*)",
    "Bash(sed -i:*)",
    "Bash(git push:*)",
    "Bash(git commit:*)",
    "Bash(git add:*)",
    "Bash(git reset:*)",
    "Bash(git checkout:*)",
    "Bash(git switch:*)",
    "Bash(git merge:*)",
    "Bash(git rebase:*)",
    "Bash(git stash:*)",
    "Bash(git clean:*)",
    "Bash(git branch -D:*)",
    "Bash(gh pr merge:*)",
    "Bash(npm:*)",
    "Bash(pip:*)",
    "Bash(pip3:*)",
    "Bash(brew:*)",
    "Bash(kill:*)",
    "Bash(pkill:*)",
    "Bash(railway:*)",
    "Bash(vercel:*)",
]

SHARED = ["CLAUDE.md", "agents", "commands", "hooks", "rules", "skills", "plugins"]


def main() -> int:
    with open(os.path.join(HUB, "settings.json")) as handle:
        settings = json.load(handle)
    permissions = settings.setdefault("permissions", {})
    deny = list(permissions.get("deny", []))
    for rule in DENY:
        if rule not in deny:
            deny.append(rule)
    permissions["deny"] = deny
    os.makedirs(PLANNER, mode=0o700, exist_ok=True)
    temporary = os.path.join(PLANNER, "settings.json.tmp")
    with open(os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "w") as handle:
        json.dump(settings, handle, indent=2)
    os.replace(temporary, os.path.join(PLANNER, "settings.json"))
    for name in SHARED:
        link = os.path.join(PLANNER, name)
        target = os.path.join(HUB, name)
        if os.path.lexists(link) or not os.path.exists(target):
            continue
        os.symlink(target, link)
    print(f"planner home ready: {PLANNER} ({len(deny)} deny rules)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
