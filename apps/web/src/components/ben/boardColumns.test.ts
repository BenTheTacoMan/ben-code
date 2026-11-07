import { describe, expect, it } from "vite-plus/test";

import { boardDropVerb, classifyBoardThread, type BoardThreadInput } from "./boardColumns";

function thread(overrides: Partial<BoardThreadInput> = {}): BoardThreadInput {
  return {
    archivedAt: null,
    deletedAt: null,
    settledOverride: null,
    pullRequests: [],
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    pendingSubagentRequest: null,
    pendingGuestMessageCount: 0,
    hasActionableProposedPlan: false,
    interactionMode: "default",
    latestRun: null,
    runtime: null,
    ...overrides,
  } as BoardThreadInput;
}

describe("classifyBoardThread", () => {
  it("hides archived and deleted threads", () => {
    expect(classifyBoardThread(thread({ archivedAt: "2026-11-07T00:00:00Z" }))).toBeNull();
    expect(classifyBoardThread(thread({ deletedAt: "2026-11-07T00:00:00Z" }))).toBeNull();
  });

  it("puts a thread with no activity in Idle", () => {
    expect(classifyBoardThread(thread())).toBe("idle");
  });

  it("puts settled threads in Finished", () => {
    expect(classifyBoardThread(thread({ settledOverride: "settled" }))).toBe("finished");
  });

  it("puts a thread with a merged pull request in Pushed, even when settled", () => {
    const merged = [
      { snapshot: { state: "merged" } },
    ] as unknown as BoardThreadInput["pullRequests"];
    expect(classifyBoardThread(thread({ pullRequests: merged, settledOverride: "settled" }))).toBe(
      "pushed",
    );
  });

  it("does not treat an open pull request as pushed", () => {
    const open = [{ snapshot: { state: "open" } }] as unknown as BoardThreadInput["pullRequests"];
    expect(classifyBoardThread(thread({ pullRequests: open }))).toBe("idle");
  });

  it("puts pending approvals and questions in Needs you", () => {
    expect(classifyBoardThread(thread({ hasPendingApprovals: true }))).toBe("needs-you");
    expect(classifyBoardThread(thread({ hasPendingUserInput: true }))).toBe("needs-you");
  });

  it("puts an unanswered plan in Needs you", () => {
    expect(
      classifyBoardThread(thread({ interactionMode: "plan", hasActionableProposedPlan: true })),
    ).toBe("needs-you");
  });
});

describe("boardDropVerb", () => {
  it("settles by dropping on Finished", () => {
    expect(boardDropVerb("idle", "finished")).toBe("settle");
    expect(boardDropVerb("needs-you", "finished")).toBe("settle");
  });

  it("reopens by dropping on Idle", () => {
    expect(boardDropVerb("finished", "idle")).toBe("unsettle");
    expect(boardDropVerb("pushed", "idle")).toBe("unsettle");
  });

  it("refuses columns the agent owns", () => {
    expect(boardDropVerb("idle", "working")).toBeNull();
    expect(boardDropVerb("idle", "pushed")).toBeNull();
    expect(boardDropVerb("idle", "idle")).toBeNull();
  });
});
