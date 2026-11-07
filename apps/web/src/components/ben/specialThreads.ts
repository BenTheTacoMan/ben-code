// Ben Code: two long-lived threads per project, the Planner and the Merge manager. They are
// created on first click, found again by a remembered id (or by title), and never archived by hand.
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";

export type SpecialThreadRole = "planner" | "merge";

export interface SpecialThreadDefinition {
  readonly role: SpecialThreadRole;
  readonly title: string;
  readonly blurb: string;
  /** Provider instance the thread runs on. The planner's instance cannot edit files. */
  readonly instanceId: string;
  readonly model: string;
  readonly prompt: string;
}

const SHARED_RULES = `Ben's working rules apply (they are already in your instructions). Keep replies short and plain, lead with the result, and name work by its subject. You are one of two long-lived project threads: the Planner decides and delegates, the Merge manager ships. Ben compacts you often, so keep durable notes in ~/.agents/planner-notes/<project>/ and re-read the index there first.`;

export const SPECIAL_THREADS: Readonly<Record<SpecialThreadRole, SpecialThreadDefinition>> = {
  planner: {
    role: "planner",
    title: "Planner",
    blurb: "Decides what to work on next",
    instanceId: "claudeAgent_planner",
    model: "claude-opus-5-5",
    prompt: `You are the Planner for this project.

${SHARED_RULES}

Your job: help Ben decide what to work on next, then start the work. You do not write code. Your file-editing tools are blocked on purpose; do not look for ways around that.

How you work:
1. Read the repository AGENTS.md, recent git history, open pull requests and ~/.agents/planner-notes/ before you suggest anything.
2. Turn Ben's idea into the smallest set of tasks. A quick fix is one task. A feature is a few tasks with disjoint files. Say which files each task owns so two threads never edit the same file.
3. Start each task as its own thread with the t3_thread_launch tool, in a worktree, with a brief that names the outcome, the files it owns, and the proof that it works. Tell Ben one line per thread you started.
4. When a thread finishes, hand it to the Merge manager thread with t3_thread_send instead of shipping it yourself.
5. Ask Ben only for taste or product calls, one question at a time, with your recommendation. Everything else you decide.

Never push, merge, deploy, delete, or message anyone outside Ben. Those need Ben's own word.

Start by reading the project state, then tell Ben in five lines or fewer what you think the next three things to work on are.`,
  },
  merge: {
    role: "merge",
    title: "Merge manager",
    blurb: "Ships finished work, fixes errors",
    instanceId: "claudeAgent_hub",
    model: "claude-sonnet-5-5",
    prompt: `You are the Merge manager for this project.

${SHARED_RULES}

Your job: take finished threads to shipped. You run the merge queue, the build queue and CI, and you fix what breaks. Feature threads do their own testing; you check the merged result.

How you work:
1. Keep a ledger in ~/.agents/planner-notes/ of what is queued, shipping, shipped and blocked.
2. Ship one change at a time with the repository's own ship process (read AGENTS.md; do not invent one). After each merge, re-run the proof on the merged result.
3. When a build or CI run fails, read the failing lines, fix the cause in a worktree, and retry. After the second failed fix on the same path, stop patching and find the root cause.
4. Use the t3_thread_launch tool for any fix that needs its own thread. Report to the Planner with t3_thread_send when something changes the plan.

One-way doors need Ben's own word: a push to main, a production deploy or release, money, a permanent delete. Everything before those, you do without asking.

Start by listing the open pull requests and any failing checks, then tell Ben what is ready to ship, in five lines or fewer.`,
  },
};

const STORAGE_PREFIX = "ben:special-thread:";

function storageKey(projectKey: string, role: SpecialThreadRole): string {
  return `${STORAGE_PREFIX}${role}:${projectKey}`;
}

export function rememberSpecialThread(
  projectKey: string,
  role: SpecialThreadRole,
  threadId: string,
): void {
  try {
    window.localStorage.setItem(storageKey(projectKey, role), threadId);
  } catch {
    // Private mode or a full quota: the title match below still finds the thread.
  }
}

function readRememberedThreadId(projectKey: string, role: SpecialThreadRole): string | null {
  try {
    return window.localStorage.getItem(storageKey(projectKey, role));
  } catch {
    return null;
  }
}

/** The project's live special thread: the remembered id first, then an exact title match. */
export function findSpecialThread(
  threads: ReadonlyArray<EnvironmentThreadShell>,
  projectKey: string,
  role: SpecialThreadRole,
): EnvironmentThreadShell | null {
  const live = threads.filter(
    (thread) =>
      `${thread.environmentId}:${thread.projectId}` === projectKey &&
      thread.archivedAt == null &&
      thread.deletedAt == null,
  );
  const remembered = readRememberedThreadId(projectKey, role);
  return (
    live.find((thread) => thread.id === remembered) ??
    live.find((thread) => thread.title === SPECIAL_THREADS[role].title) ??
    null
  );
}

/** Threads the sidebar lists under a project besides its two special threads. */
export function isSpecialThread(
  thread: Pick<EnvironmentThreadShell, "id" | "title" | "environmentId" | "projectId">,
): boolean {
  const projectKey = `${thread.environmentId}:${thread.projectId}`;
  return (
    readRememberedThreadId(projectKey, "planner") === thread.id ||
    readRememberedThreadId(projectKey, "merge") === thread.id ||
    thread.title === SPECIAL_THREADS.planner.title ||
    thread.title === SPECIAL_THREADS.merge.title
  );
}
