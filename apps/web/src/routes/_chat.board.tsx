import { createFileRoute } from "@tanstack/react-router";

import { BoardPage } from "../components/ben/BoardPage";

function BoardRouteView() {
  const { project } = Route.useSearch();
  return <BoardPage projectKey={project} />;
}

export const Route = createFileRoute("/_chat/board")({
  validateSearch: (raw: Record<string, unknown>): { project?: string } =>
    typeof raw.project === "string" && raw.project ? { project: raw.project.slice(0, 200) } : {},
  component: BoardRouteView,
});
