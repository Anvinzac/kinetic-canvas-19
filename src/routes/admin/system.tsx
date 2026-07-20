import { createFileRoute } from "@tanstack/react-router";
import { SystemPage } from "@/features/admin";

export const Route = createFileRoute("/admin/system")({
  component: SystemPage,
});
