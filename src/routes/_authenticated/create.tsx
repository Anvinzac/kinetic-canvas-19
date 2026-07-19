import { createFileRoute } from "@tanstack/react-router";
import { CreateStudioPage } from "@/features/create-studio";

export const Route = createFileRoute("/_authenticated/create")({
  component: CreateStudioPage,
});
