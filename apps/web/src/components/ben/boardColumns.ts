// Ben Code: kanban board columns derived from live thread state. Nothing is stored, so a card
// moves by itself when its thread changes. Kept in its own file so upstream merges stay clean.
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { threadRuntimeIsActive } from "@t3tools/client-runtime/state/models";
import { isThreadWorking } from "@t3tools/client-runtime/state/thread-inbox";

export const BOARD_COLUMNS = [
  { id: "needs-you", label: "Needs you" },
  { id: "working", label: "Working" },
  { id: "idle", label: "Idle" },
  { id: "finished", label: "Finished" },
  { id: "pushed", label: "Pushed" },
] as const;

export type BoardColumnId = (typeof BOARD_COLUMNS)[number]["id"];

export type BoardThreadInput = Pick<
  EnvironmentThreadShell,
  | "archivedAt"
  | "deletedAt"
  | "settledOverride"
  | "pullRequests"
  | "hasPendingApprovals"
  | "hasPendingUserInput"
  | "pendingSubagentRequest"
  | "pendingGuestMessageCount"
  | "hasActionableProposedPlan"
  | "interactionMode"
  | "latestRun"
  | "runtime"
>;

/** Returns null for threads the board never shows (archived or deleted). */
export function classifyBoardThread(thread: BoardThreadInput): BoardColumnId | null {
  if (thread.archivedAt != null || thread.deletedAt != null) return null;
  if (thread.pullRequests.some((link) => link.snapshot?.state === "merged")) return "pushed";
  if (thread.settledOverride === "settled") return "finished";
  const waitingOnPlan = thread.interactionMode === "plan" && thread.hasActionableProposedPlan;
  if (
    thread.hasPendingApprovals ||
    thread.hasPendingUserInput ||
    thread.pendingSubagentRequest != null ||
    (thread.pendingGuestMessageCount ?? 0) > 0 ||
    (waitingOnPlan && !threadRuntimeIsActive(thread.runtime))
  ) {
    return "needs-you";
  }
  if (threadRuntimeIsActive(thread.runtime) && isThreadWorking(thread)) return "working";
  return "idle";
}

/** The drop verb that moves a card into a column, or null when the board cannot do it. */
export function boardDropVerb(
  from: BoardColumnId,
  to: BoardColumnId,
): "settle" | "unsettle" | null {
  if (from === to) return null;
  if (to === "finished" && (from === "idle" || from === "needs-you")) return "settle";
  if (to === "idle" && (from === "finished" || from === "pushed")) return "unsettle";
  return null;
}
