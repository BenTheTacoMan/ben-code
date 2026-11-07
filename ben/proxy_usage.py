#!/usr/bin/env python3
"""Per-account usage for the local CLIProxyAPI, ordered by who fills first.

Reads the management key from ~/.agents/secrets/cliproxy.env (never printed) and the
account list from the proxy's /v0/management/auth-files endpoint. Claude accounts report a
weekly utilization and reset time; Codex accounts report a 5 hour and a weekly window.
"""
import json
import os
import re
import sys
import time
import urllib.request

BASE = os.environ.get("CLIPROXY_BASE_URL", "http://127.0.0.1:8317")
ENV_FILE = os.path.expanduser("~/.agents/secrets/cliproxy.env")


def read_key() -> str:
    with open(ENV_FILE) as handle:
        for line in handle:
            match = re.match(r"\s*(?:export\s+)?CLIPROXY_MGMT_KEY=(.*)", line)
            if match:
                return match.group(1).strip().strip("'\"")
    raise SystemExit("CLIPROXY_MGMT_KEY not found in " + ENV_FILE)


def fetch() -> list:
    request = urllib.request.Request(
        BASE + "/v0/management/auth-files",
        headers={"Authorization": "Bearer " + read_key()},
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.load(response)["files"]


def bar(fraction: float, width: int = 20) -> str:
    filled = max(0, min(width, round(fraction * width)))
    return "#" * filled + "." * (width - filled)


def until(epoch: float) -> str:
    seconds = int(epoch - time.time())
    if seconds <= 0:
        return "now"
    days, rest = divmod(seconds, 86400)
    hours, rest = divmod(rest, 3600)
    return f"{days}d {hours}h" if days else f"{hours}h {rest // 60}m"


def claude_line(file: dict) -> str:
    best = None
    for quota in file.get("model_quotas", {}).values():
        signals = quota.get("signals", {})
        utilization = signals.get("Anthropic-Ratelimit-Unified-7d-Utilization")
        reset = signals.get("Anthropic-Ratelimit-Unified-7d-Reset")
        if utilization is None or reset is None:
            continue
        if best is None or float(utilization) > best[0]:
            best = (float(utilization), float(reset), signals.get("Anthropic-Ratelimit-Unified-7d-Status", "?"))
    if best is None:
        return "no usage data yet"
    utilization, reset, status = best
    when = time.strftime("%a %b %d %H:%M", time.localtime(reset))
    return f"week [{bar(utilization)}] {utilization * 100:5.1f}%  resets {when} (in {until(reset)})  {status}"


def codex_line(file: dict) -> str:
    for quota in file.get("model_quotas", {}).values():
        signals = quota.get("signals", {})
        if "X-Codex-Secondary-Used-Percent" not in signals:
            continue
        five = float(signals.get("X-Codex-Primary-Used-Percent", 0))
        week = float(signals.get("X-Codex-Secondary-Used-Percent", 0))
        reset = float(signals.get("X-Codex-Secondary-Reset-At", 0))
        return f"5h {five:3.0f}%  week [{bar(week / 100)}] {week:5.1f}%  resets in {until(reset)}"
    return "no usage data yet"


def main() -> int:
    files = fetch()
    files.sort(key=lambda f: (f.get("type", f.get("account_type", "")), -(f.get("priority") or 0)))
    for file in files:
        provider = file.get("provider") or file.get("type") or file.get("account_type", "?")
        is_codex = any("X-Codex-Secondary-Used-Percent" in q.get("signals", {}) for q in file.get("model_quotas", {}).values())
        label = "codex " if is_codex else "claude"
        state = "disabled" if file.get("disabled") else ("cooling" if file.get("cooldowns") else "ready")
        order = file.get("priority")
        order_text = f"fill order {order}" if order else "no priority"
        print(f"{label} {file.get('email', '?'):32} {state:8} {order_text}")
        print("       " + (codex_line(file) if is_codex else claude_line(file)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
