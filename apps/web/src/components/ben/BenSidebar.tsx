// Ben Code sidebar: projects as an accordion. The open project shows its Planner, its Merge manager
// and its threads grouped by state. Every other project is a single row pushed to the bottom.
import { scopeProjectRef, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import { Link, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import {
  CheckCheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  Columns3Icon,
  CompassIcon,
  ListIcon,
  PackageCheckIcon,
  SquarePenIcon,
  XIcon,
} from "lucide-react";
import { type ReactNode } from "react";

import { isElectron } from "../../env";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useNewThreadHandler } from "../../hooks/useHandleNewThread";
import { cn } from "../../lib/utils";
import { useVisibleThreadShells } from "../../state/entities";
import { projectEnvironment } from "../../state/projects";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";
import { buildThreadRouteParams } from "../../threadRoutes";
import { ProjectFavicon } from "../ProjectFavicon";
import { SidebarChromeFooter, SidebarChromeHeader } from "../sidebar/SidebarChrome";
import { SidebarContent } from "../ui/sidebar";
import { TooltipProvider } from "../ui/tooltip";
import { BOARD_COLUMNS, classifyBoardThread, type BoardColumnId } from "./boardColumns";
import {
  findSpecialThread,
  isSpecialThread,
  SPECIAL_THREADS,
  type SpecialThreadRole,
} from "./specialThreads";
import { useBenProjects } from "./useBenProjects";
import { useOpenSpecialThread } from "./useOpenSpecialThread";

const STATUS_DOT: Record<BoardColumnId, string> = {
  "needs-you": "bg-warning",
  working: "bg-info animate-pulse",
  idle: "bg-muted-foreground",
  finished: "bg-success/60",
  pushed: "bg-guest/70",
};

const SECTION_LABEL: Record<BoardColumnId, string> = Object.fromEntries(
  BOARD_COLUMNS.map((column) => [column.id, column.label]),
) as Record<BoardColumnId, string>;

const MAX_ROWS_PER_SECTION = 12;

function projectKeyOf(project: Pick<EnvironmentProject, "environmentId" | "id">): string {
  return `${project.environmentId}:${project.id}`;
}

function SectionLabel(props: { children: ReactNode; count?: number }) {
  return (
    <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-2xs font-medium tracking-wide text-muted-foreground uppercase">
      {props.children}
      {props.count !== undefined ? <span className="opacity-60">{props.count}</span> : null}
    </div>
  );
}

function ThreadRow(props: {
  readonly thread: EnvironmentThreadShell;
  readonly column: BoardColumnId;
  readonly active: boolean;
}) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      data-ben-thread={props.thread.id}
      onClick={() =>
        void navigate({
          to: "/$environmentId/$threadId",
          params: buildThreadRouteParams(
            scopeThreadRef(props.thread.environmentId, props.thread.id),
          ),
        })
      }
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm hover:bg-accent/60",
        props.active && "bg-accent text-accent-foreground",
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[props.column])} />
      <span className="truncate">{props.thread.title}</span>
    </button>
  );
}

function SpecialRow(props: {
  readonly role: SpecialThreadRole;
  readonly project: EnvironmentProject;
  readonly threads: ReadonlyArray<EnvironmentThreadShell>;
  readonly activePath: string;
}) {
  const open = useOpenSpecialThread();
  const definition = SPECIAL_THREADS[props.role];
  const existing = findSpecialThread(props.threads, projectKeyOf(props.project), props.role);
  const column = existing ? classifyBoardThread(existing) : null;
  const Icon = props.role === "planner" ? CompassIcon : PackageCheckIcon;
  return (
    <button
      type="button"
      data-ben-special={props.role}
      onClick={() => void open(props.project, props.role)}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm hover:bg-accent/60",
        existing && props.activePath.includes(existing.id) && "bg-accent text-accent-foreground",
      )}
    >
      <Icon className="size-3.5 shrink-0 text-primary" />
      <span className="truncate font-medium">{definition.title}</span>
      {column ? (
        <span className={cn("ml-auto size-1.5 shrink-0 rounded-full", STATUS_DOT[column])} />
      ) : (
        <span className="ml-auto text-2xs text-muted-foreground">start</span>
      )}
    </button>
  );
}

export default function BenSidebar(_props: { routeReveal?: unknown }) {
  const projects = useBenProjects();
  const threads = useVisibleThreadShells();
  const location = useLocation();
  const router = useRouter();
  const onBoard = location.pathname === "/board";
  const handleNewThread = useNewThreadHandler();
  const [selectedKey, setSelectedKey] = useLocalStorage("ben:selected-project", "", Schema.String);
  const onFinished = location.pathname === "/finished";
  const updateProject = useOrchestrationCommand(projectEnvironment.update, {
    label: "project archive",
  });
  const archiveProject = (project: EnvironmentProject) =>
    updateProject({
      environmentId: project.environmentId,
      input: { projectId: project.id, archived: true },
    });

  const navigate = useNavigate();
  // Clicking a project selects it and opens that project's own board.
  const openProjectBoard = (project: EnvironmentProject) => {
    setSelectedKey(projectKeyOf(project));
    void navigate({ to: "/board", search: { project: projectKeyOf(project) } });
  };

  const selected = projects.find((project) => projectKeyOf(project) === selectedKey) ?? projects[0];
  const others = projects.filter((project) => project !== selected);

  const sections = new Map<BoardColumnId, EnvironmentThreadShell[]>(
    BOARD_COLUMNS.map((column) => [column.id, []]),
  );
  const countsByProject = new Map<string, { needs: number; working: number }>();
  let finishedCount = 0;
  for (const thread of threads) {
    const column = classifyBoardThread(thread);
    if (column === null) continue;
    const key = `${thread.environmentId}:${thread.projectId}`;
    const counts = countsByProject.get(key) ?? { needs: 0, working: 0 };
    if (column === "needs-you") counts.needs += 1;
    if (column === "working") counts.working += 1;
    countsByProject.set(key, counts);
    if (isSpecialThread(thread) || !projects.some((project) => projectKeyOf(project) === key)) {
      continue;
    }
    if (column === "finished" || column === "pushed") finishedCount += 1;
    else if (selected && key === projectKeyOf(selected)) sections.get(column)!.push(thread);
  }
  for (const list of sections.values()) {
    list.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  }

  return (
    <TooltipProvider>
      <SidebarChromeHeader isElectron={isElectron} />
      <SidebarContent className="min-h-full">
        <div className="flex min-h-full flex-col gap-1 px-2 pb-2">
          <div className="flex items-center gap-1 px-1 pt-1">
            {onBoard ? (
              <button
                type="button"
                data-ben-board-link
                onClick={() => router.history.back()}
                className="flex flex-1 items-center gap-2 rounded-md bg-accent px-2.5 py-1.5 text-left text-sm"
              >
                <ListIcon className="size-4" />
                Back to threads
              </button>
            ) : (
              <Link
                to="/board"
                search={selected ? { project: projectKeyOf(selected) } : {}}
                data-ben-board-link
                className="flex flex-1 items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-accent/60"
              >
                <Columns3Icon className="size-4" />
                Board
              </Link>
            )}
          </div>

          {selected ? (
            <div data-ben-open-project={projectKeyOf(selected)} className="flex flex-col">
              <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                <button
                  type="button"
                  data-ben-open-board
                  onClick={() => openProjectBoard(selected)}
                  className="flex min-w-0 items-center gap-2 rounded text-left hover:text-foreground"
                >
                  <ChevronDownIcon className="size-3.5 text-muted-foreground" />
                  <ProjectFavicon project={selected} className="size-4" />
                  <span className="truncate text-sm font-semibold">{selected.title}</span>
                </button>
                <button
                  type="button"
                  aria-label={`New thread in ${selected.title}`}
                  className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  onClick={() =>
                    void handleNewThread(scopeProjectRef(selected.environmentId, selected.id))
                  }
                >
                  <SquarePenIcon className="size-3.5" />
                </button>
              </div>
              <SpecialRow
                role="planner"
                project={selected}
                threads={threads}
                activePath={location.pathname}
              />
              <SpecialRow
                role="merge"
                project={selected}
                threads={threads}
                activePath={location.pathname}
              />
              {(["needs-you", "working", "idle"] as const).map((id) => {
                const list = sections.get(id) ?? [];
                if (list.length === 0) return null;
                return (
                  <div key={id}>
                    <SectionLabel count={list.length}>{SECTION_LABEL[id]}</SectionLabel>
                    {list.slice(0, MAX_ROWS_PER_SECTION).map((thread) => (
                      <ThreadRow
                        key={thread.id}
                        thread={thread}
                        column={id}
                        active={location.pathname.includes(thread.id)}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="mt-auto flex flex-col border-t border-border/60 pt-2">
            {others.map((project) => {
              const counts = countsByProject.get(projectKeyOf(project));
              return (
                <button
                  key={projectKeyOf(project)}
                  type="button"
                  data-ben-project={projectKeyOf(project)}
                  onClick={() => openProjectBoard(project)}
                  className="group flex items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                >
                  <ChevronRightIcon className="size-3.5" />
                  <ProjectFavicon project={project} className="size-4" />
                  <span className="truncate">{project.title}</span>
                  {counts && counts.needs > 0 ? (
                    <span className="ml-auto rounded-full bg-warning/20 px-1.5 text-2xs text-warning">
                      {counts.needs}
                    </span>
                  ) : counts && counts.working > 0 ? (
                    <span className="ml-auto size-1.5 animate-pulse rounded-full bg-info" />
                  ) : null}
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`Remove ${project.title} from Ben Code`}
                    onClick={(event) => {
                      event.stopPropagation();
                      void archiveProject(project);
                    }}
                    className="ml-auto hidden rounded p-0.5 hover:bg-accent group-hover:block"
                  >
                    <XIcon className="size-3" />
                  </span>
                </button>
              );
            })}
            <Link
              to="/finished"
              data-ben-finished-link
              className={cn(
                "mt-1 flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                onFinished && "bg-accent text-accent-foreground",
              )}
            >
              <CheckCheckIcon className="size-3.5" />
              Finished
              <span className="ml-auto text-2xs opacity-60">{finishedCount}</span>
            </Link>
          </div>
        </div>
      </SidebarContent>
      <SidebarChromeFooter />
    </TooltipProvider>
  );
}
