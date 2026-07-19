import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/features/session";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});
