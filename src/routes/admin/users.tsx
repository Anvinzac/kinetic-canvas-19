import { createFileRoute } from "@tanstack/react-router";
import { UsersPage } from "@/features/admin";

export const Route = createFileRoute("/admin/users")({
  component: UsersPage,
});
