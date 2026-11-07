import { createFileRoute } from "@tanstack/react-router";

import { FinishedPage } from "../components/ben/FinishedPage";

export const Route = createFileRoute("/_chat/finished")({
  component: FinishedPage,
});
