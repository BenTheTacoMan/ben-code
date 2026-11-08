// Ben Code: kanban board across threads. Columns come from live thread state (boardColumns.ts).
// Drag a card to Finished to settle it, or to Idle to reopen it. The agent owns the other columns.
import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { useNavigate } from "@tanstack/react-router";
import { GitBranchIcon } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";

import { isElectron } from "../../env";
import { useNowMinute } from "../../hooks/useNowMinute";
import { useThreadActions } from "../../hooks/useThreadActions";
import { cn } from "../../lib/utils";
import { useVisibleThreadShells } from "../../state/entities";
import { buildThreadRouteParams } from "../../threadRoutes";
import { PullRequestGlyph } from "../pullRequest/pullRequestIcons";
import { useBenProjects } from "./useBenProjects";
import { ProjectFavicon } from "../ProjectFavicon";
import { SidebarInset } from "../ui/sidebar";
import { WorkspacePageHeader } from "../WorkspacePageHeader";
import {
  BOARD_COLUMNS,
  boardDropVerb,
  classifyBoardThread,
  type BoardColumnId,
} from "./boardColumns";

const COLUMN_ACCENT: Record<BoardColumnId, string> = {
  "needs-you": "bg-warning",
  working: "bg-info",
  idle: "bg-muted-foreground",
  finished: "bg-success",
  pushed: "bg-guest",
};

function relativeTime(iso: string, nowIso: string): string {
  const seconds = Math.round((Date.parse(nowIso) - Date.parse(iso)) / 1000);
  if (Number.isNaN(seconds)) return "";
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}

function threadKey(thread: Pick<EnvironmentThreadShell, "environmentId" | "id">): string {
  return scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
}

export function BoardPage(props: { readonly projectKey: string | undefined }) {
  const navigate = useNavigate();
  const projects = useBenProjects();
  const threads = useVisibleThreadShells();
  const nowIso = useNowMinute();
  const { settleThread, unsettleThread } = useThreadActions();
  const [overColumn, setOverColumn] = useState<BoardColumnId | null>(null);
  const dragKeyRef = useRef<string | null>(null);

  const projectByKey = new Map(
    projects.map((project) => [`${project.environmentId}:${project.id}`, project]),
  );

  const columns = new Map<BoardColumnId, EnvironmentThreadShell[]>(
    BOARD_COLUMNS.map((column) => [column.id, []]),
  );
  const columnByKey = new Map<string, BoardColumnId>();
  const threadByKey = new Map<string, EnvironmentThreadShell>();
  for (const thread of threads) {
    if (props.projectKey && `${thread.environmentId}:${thread.projectId}` !== props.projectKey) {
      continue;
    }
    const column = classifyBoardThread(thread);
    if (column === null) continue;
    columns.get(column)!.push(thread);
    columnByKey.set(threadKey(thread), column);
    threadByKey.set(threadKey(thread), thread);
  }
  for (const list of columns.values()) {
    list.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  }

  const onDrop = (event: DragEvent, target: BoardColumnId) => {
    event.preventDefault();
    const key = event.dataTransfer.getData("text/plain") || dragKeyRef.current;
    dragKeyRef.current = null;
    setOverColumn(null);
    if (key === null) return;
    const thread = threadByKey.get(key);
    const from = columnByKey.get(key);
    if (!thread || !from) return;
    const verb = boardDropVerb(from, target);
    const ref = scopeThreadRef(thread.environmentId, thread.id);
    if (verb === "settle") void settleThread(ref);
    else if (verb === "unsettle") void unsettleThread(ref);
  };

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none">
      {isElectron ? <WorkspacePageHeader electron /> : null}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <h1 className="text-sm font-semibold">Board</h1>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <button
            type="button"
            className={cn(
              "rounded-full px-2.5 py-1",
              !props.projectKey
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
            onClick={() => void navigate({ to: "/board", search: {} })}
          >
            All projects
          </button>
          {projects.map((project) => {
            const key = `${project.environmentId}:${project.id}`;
            return (
              <button
                key={key}
                type="button"
                className={cn(
                  "rounded-full px-2.5 py-1",
                  props.projectKey === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
                onClick={() => void navigate({ to: "/board", search: { project: key } })}
              >
                {project.title}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-4 pb-4">
        {BOARD_COLUMNS.map((column) => {
          const list = columns.get(column.id) ?? [];
          return (
            <section
              key={column.id}
              data-board-column={column.id}
              className={cn(
                "flex min-h-0 w-64 shrink-0 flex-col rounded-lg bg-muted/40 p-2 transition-colors",
                overColumn === column.id && "bg-muted",
              )}
              onDragOver={(event) => {
                event.preventDefault();
                setOverColumn(column.id);
              }}
              onDragLeave={() =>
                setOverColumn((current) => (current === column.id ? null : current))
              }
              onDrop={(event) => onDrop(event, column.id)}
            >
              <header className="flex items-center gap-2 px-1 pb-2 text-xs font-medium">
                <span className={cn("size-2 rounded-full", COLUMN_ACCENT[column.id])} />
                {column.label}
                <span className="text-muted-foreground">{list.length}</span>
              </header>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                {list.map((thread) => {
                  const project = projectByKey.get(`${thread.environmentId}:${thread.projectId}`);
                  const pr = thread.pullRequests[0];
                  return (
                    <article
                      key={threadKey(thread)}
                      draggable
                      data-board-card={thread.id}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", threadKey(thread));
                        dragKeyRef.current = threadKey(thread);
                      }}
                      onDragEnd={() => {
                        dragKeyRef.current = null;
                        setOverColumn(null);
                      }}
                      onClick={() =>
                        void navigate({
                          to: "/$environmentId/$threadId",
                          params: buildThreadRouteParams(
                            scopeThreadRef(thread.environmentId, thread.id),
                          ),
                        })
                      }
                      className="min-w-0 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border bg-card p-2.5 text-xs shadow-xs hover:border-primary/40"
                    >
                      <div className="line-clamp-2 break-words font-medium">{thread.title}</div>
                      <div className="mt-1.5 flex items-center gap-1.5 text-muted-foreground">
                        {project && !props.projectKey ? (
                          <span className="flex min-w-0 items-center gap-1">
                            <ProjectFavicon project={project} className="size-3" />
                            <span className="truncate">{project.title}</span>
                          </span>
                        ) : null}
                        {thread.branch ? (
                          <span className="flex min-w-0 items-center gap-0.5">
                            <GitBranchIcon className="size-3 shrink-0" />
                            <span className="truncate">{thread.branch}</span>
                          </span>
                        ) : null}
                        {pr ? (
                          <span className="flex items-center gap-0.5">
                            <PullRequestGlyph.pullRequest className="size-3" />#{pr.number}
                          </span>
                        ) : null}
                        <span className="ml-auto shrink-0">
                          {relativeTime(thread.updatedAt, nowIso)}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </SidebarInset>
  );
}
