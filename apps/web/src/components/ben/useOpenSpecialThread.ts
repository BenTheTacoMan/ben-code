// Ben Code: open a project's Planner or Merge manager thread, creating and starting it on first use.
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { ProviderInstanceId, type ModelSelection } from "@t3tools/contracts";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import { useNavigate } from "@tanstack/react-router";

import { newMessageId, newThreadId } from "../../lib/utils";
import { readThreadShells } from "../../state/entities";
import { threadEnvironment } from "../../state/threads";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";
import { buildThreadRouteParams } from "../../threadRoutes";
import { stackedThreadToast, toastManager } from "../ui/toast";
import {
  findSpecialThread,
  rememberSpecialThread,
  SPECIAL_THREADS,
  type SpecialThreadRole,
} from "./specialThreads";

export function useOpenSpecialThread() {
  const navigate = useNavigate();
  const createThread = useOrchestrationCommand(threadEnvironment.create, { reportFailure: false });
  const startThreadTurn = useOrchestrationCommand(threadEnvironment.startTurn, {
    reportFailure: false,
  });

  return async (project: EnvironmentProject, role: SpecialThreadRole) => {
    const definition = SPECIAL_THREADS[role];
    const projectKey = `${project.environmentId}:${project.id}`;
    const existing = findSpecialThread(readThreadShells(), projectKey, role);
    if (existing) {
      rememberSpecialThread(projectKey, role, existing.id);
      await navigate({
        to: "/$environmentId/$threadId",
        params: buildThreadRouteParams(scopeThreadRef(existing.environmentId, existing.id)),
      });
      return;
    }

    const threadId = newThreadId();
    const createdAt = new Date().toISOString();
    const modelSelection: ModelSelection = {
      instanceId: ProviderInstanceId.make(definition.instanceId),
      model: definition.model,
    };
    const created = await createThread({
      environmentId: project.environmentId,
      input: {
        threadId,
        projectId: project.id,
        title: definition.title,
        modelSelection,
        runtimeMode: "auto",
        interactionMode: "default",
        branch: null,
        worktreePath: null,
        createdAt,
      },
    });
    const started =
      created._tag === "Failure"
        ? created
        : await startThreadTurn({
            environmentId: project.environmentId,
            input: {
              threadId,
              message: {
                messageId: newMessageId(),
                role: "user",
                text: definition.prompt,
                attachments: [],
              },
              modelSelection,
              titleSeed: definition.title,
              runtimeMode: "auto",
              interactionMode: "default",
              createdAt,
            },
          });
    if (started._tag === "Failure") {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: `Could not start the ${definition.title}`,
          description: "Check that the provider instance exists in Settings → Providers.",
        }),
      );
      return;
    }
    rememberSpecialThread(projectKey, role, threadId);
    await navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(scopeThreadRef(project.environmentId, threadId)),
    });
  };
}
