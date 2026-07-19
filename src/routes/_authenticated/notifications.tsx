import { createFileRoute } from "@tanstack/react-router";
import { NotificationsPage } from "@/features/discovery";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});
