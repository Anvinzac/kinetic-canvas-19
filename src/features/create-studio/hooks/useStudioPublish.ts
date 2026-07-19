/**
 * Demo/live publish for create-studio posts via shared runDataMode.
 *
 * Exports: useStudioPublish
 * Depends on: shared/api-client, social createPost, discovery/social keys
 */

import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import type { Dispatch, SetStateAction } from "react";
import { serializeCanvas, type CanvasSpec } from "@/features/canvas";
import { discoveryKeys } from "@/features/discovery";
import { createPost, socialKeys } from "@/features/social";
import { addMockPost, getMockFeed } from "@/lib/mock-data";
import { runDataMode } from "@/shared/api-client";

export type StudioPublishApi = {
  canPost: boolean;
  publish: () => Promise<void>;
};

type UseStudioPublishArgs = {
  publishText: string;
  articleInvalid: boolean;
  publishSpec: CanvasSpec;
  publishBackground: string;
  mediaUrls: string[];
  postType: "link" | "video" | "image" | "text";
  posting: boolean;
  setPosting: Dispatch<SetStateAction<boolean>>;
};

/**
 * Publish the composed post in demo (mock feed) or live (createPost) mode.
 * @param args - Serialized publish payload and posting flag
 * @returns canPost gate and publish action
 */
export function useStudioPublish({
  publishText,
  articleInvalid,
  publishSpec,
  publishBackground,
  mediaUrls,
  postType,
  posting,
  setPosting,
}: UseStudioPublishArgs): StudioPublishApi {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const submit = useServerFn(createPost);
  const canPost = publishText.length > 0 && !posting && !articleInvalid;

  async function publish(): Promise<void> {
    if (!publishText) {
      toast.error("type something first");
      return;
    }
    if (articleInvalid) {
      toast.error("that article link looks off");
      return;
    }
    setPosting(true);
    try {
      await runDataMode({
        demo: async () => {
          addMockPost({
            post_type: postType,
            canvas_html: serializeCanvas(publishSpec),
            media_urls: mediaUrls,
            bg_gradient: publishBackground,
          });
          qc.setQueryData(socialKeys.feed("demo"), getMockFeed());
          qc.invalidateQueries({ queryKey: discoveryKeys.discoverRoot });
          qc.invalidateQueries({ queryKey: discoveryKeys.profileRoot });
          toast.success("added to demo feed");
        },
        live: async () => {
          await submit({
            data: {
              post_type: postType,
              canvas_html: serializeCanvas(publishSpec),
              media_urls: mediaUrls,
              bg_gradient: publishBackground,
            },
          });
          toast.success("posted");
        },
      });
      navigate({ to: "/feed" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPosting(false);
    }
  }

  return { canPost, publish };
}
