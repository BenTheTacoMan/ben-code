// Ben Code: the projects the sidebar and board list: every project that is not archived,
// including the "No project" scratch space.
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";

import { useProjects } from "../../state/entities";

export function useBenProjects(): ReadonlyArray<EnvironmentProject> {
  return useProjects().filter((project) => project.archivedAt == null);
}
