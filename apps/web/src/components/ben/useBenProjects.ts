// Ben Code: the projects the sidebar and board list: not archived, and not the "No project" scratch space.
import { isScratchProject } from "@t3tools/client-runtime/state/projects";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";

import { useProjects, useServerConfigs } from "../../state/entities";

export function useBenProjects(): ReadonlyArray<EnvironmentProject> {
  const projects = useProjects();
  const serverConfigs = useServerConfigs();
  return projects.filter(
    (project) =>
      project.archivedAt == null &&
      !isScratchProject(project, serverConfigs.get(project.environmentId)?.scratchWorkspaceRoot),
  );
}
