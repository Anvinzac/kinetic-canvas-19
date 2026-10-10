import { createFileRoute } from "@tanstack/react-router";
import { VocabularyFeedPage } from "@/features/vocabulary/components/VocabularyFeedPage";
import { getSiteLocale } from "@/features/vocabulary/api/site-locale.functions";
import { sitePageHead } from "@/features/vocabulary/lib/target-language";

export const Route = createFileRoute("/feed/")({
  ssr: "data-only",
  loader: async () => ({ locale: await getSiteLocale() }),
  head: ({ loaderData }) => sitePageHead(loaderData?.locale),
  component: VocabularyFeedPage,
});
