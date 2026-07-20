import { createFileRoute } from "@tanstack/react-router";
import { ErrorsPage } from "@/features/admin";

export const Route = createFileRoute("/admin/errors")({
  component: ErrorsPage,
});
