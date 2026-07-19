import { createFileRoute } from "@tanstack/react-router";
import { EditProfilePage } from "@/features/profile";

export const Route = createFileRoute("/_authenticated/edit-profile")({
  component: EditProfilePage,
});
