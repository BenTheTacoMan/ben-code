// Ben Code: every finished or pushed thread in one place, grouped by project. The sidebar only links here.
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { useNavigate } from "@tanstack/react-router";
import { RotateCcwIcon } from "lucide-react";

import { isElectron } from "../../env";
import { useNowMinute } from "../../hooks/useNowMinute";
import { useThreadActions } from "../../hooks/useThreadActions";
import { cn } from "../../lib/utils";
import { useVisibleThreadShells } from "../../state/entities";
import { buildThreadRouteParams } from "../../threadRoutes";
import { ProjectFavicon } from "../ProjectFavicon";
import { PullRequestGlyph } from "../pullRequest/pullRequestIcons";
import { SidebarInset } from "../ui/sidebar";
import { WorkspacePageHeader } from "../WorkspacePageHeader";
import { classifyBoardThread } from "./boardColumns";
import { isSpecialThread } from "./specialThreads";
import { useBenProjects } from "./useBenProjects";

function relativeTime(iso: string, nowIso: string): string {
  const seconds = Math.round((Date.parse(nowIso) - Date.parse(iso)) / 1000);
  if (Number.isNaN(seconds)) return "";
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}

export function FinishedPage() {
  const navigate = useNavigate();
  const projects = useBenProjects();
  const threads = useVisibleThreadShells();
  const nowIso = useNowMinute();
  const { unsettleThread } = useThreadActions();

  const projectKeys = new Set(projects.map((project) => `${project.environmentId}:${project.id}`));
  const finished = threads
    .filter((thread) => {
      const column = classifyBoardThread(thread);
      return (
        (column === "finished" || column === "pushed") &&
        !isSpecialThread(thread) &&
        projectKeys.has(`${thread.environmentId}:${thread.projectId}`)
      );
    })
    .toSorted((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));

  const groups = projects
    .map((project) => ({
      project,
      threads: finished.filter(
        (thread) =>
          thread.environmentId === project.environmentId && thread.projectId === project.id,
      ),
    }))
    .filter((group) => group.threads.length > 0);

  const open = (thread: EnvironmentThreadShell) =>
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(scopeThreadRef(thread.environmentId, thread.id)),
    });

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none">
      {isElectron ? <WorkspacePageHeader electron /> : null}
      <div className="flex items-baseline gap-3 px-4 pt-3 pb-2">
        <h1 className="text-sm font-semibold">Finished</h1>
        <span className="text-xs text-muted-foreground">{finished.length} threads</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {groups.length === 0 ? (
          <p className="pt-6 text-sm text-muted-foreground">Nothing finished yet.</p>
        ) : null}
        {groups.map(({ project, threads: list }) => (
          <section
            key={`${project.environmentId}:${project.id}`}
            data-finished-project={project.id}
          >
            <h2 className="flex items-center gap-2 pt-4 pb-1 text-xs font-medium text-muted-foreground">
              <ProjectFavicon project={project} className="size-4" />
              {project.title}
              <span className="opacity-60">{list.length}</span>
            </h2>
            <ul className="flex flex-col">
              {list.map((thread) => {
                const pr = thread.pullRequests[0];
                const pushed = classifyBoardThread(thread) === "pushed";
                return (
                  <li
                    key={thread.id}
                    data-finished-thread={thread.id}
                    className="group flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-accent/60"
                  >
                    <button
                      type="button"
                      onClick={() => open(thread)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          pushed ? "bg-guest/70" : "bg-success/60",
                        )}
                      />
                      <span className="truncate">{thread.title}</span>
                      {pr ? (
                        <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
                          <PullRequestGlyph.pullRequest className="size-3" />#{pr.number}
                        </span>
                      ) : null}
                    </button>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {relativeTime(thread.updatedAt, nowIso)}
                    </span>
                    {pushed ? null : (
                      <button
                        type="button"
                        aria-label="Reopen"
                        onClick={() =>
                          void unsettleThread(scopeThreadRef(thread.environmentId, thread.id))
                        }
                        className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
                      >
                        <RotateCcwIcon className="size-3.5" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </SidebarInset>
  );
}
