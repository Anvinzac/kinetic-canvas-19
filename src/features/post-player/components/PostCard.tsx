/**
 * Full-screen kinetic status player orchestrator for a single feed post.
 *
 * Exports: PostCard, PostCardProps
 * Depends on: usePostPlayback, post-player layer components
 */

import { AnimatePresence } from "framer-motion";
import type { ReactElement } from "react";
import { usePostPlayback } from "../hooks/usePostPlayback";
import type { PostCardProps } from "../types";
import { CollectionPicker } from "./CollectionPicker";
import { CommentStoryPlayer } from "./CommentStoryPlayer";
import { FlyingCommentChip } from "./FlyingCommentChip";
import { PostCanvasBackdrop } from "./PostCanvasBackdrop";
import { PostChrome } from "./PostChrome";
import { PostCommentChips } from "./PostCommentChips";
import { PostCornerDock } from "./PostCornerDock";
import { PostInfoBlock } from "./PostInfoBlock";
import { PostKineticLayer } from "./PostKineticLayer";
import { PostMediaLayer } from "./PostMediaLayer";

export type { PostCardProps } from "../types";

/**
 * @responsibility Full-screen kinetic status player for a single post.
 * @inputs Post row, author/profile maps, like/comment state and handlers
 * @outputs Interactive feed/profile card with paginated kinetic text
 */
export function PostCard(props: PostCardProps): ReactElement {
  const p = usePostPlayback(props);
  const { commentFlow: cf, commentStory: cs, textFit: tf } = p;

  return (
    <section
      data-status-snap-item="true"
      className="relative flex h-[100dvh] w-full snap-start snap-always items-center justify-center overflow-hidden bg-background"
    >
      <article
        ref={(el) => {
          p.canvasRef.current = el;
          p.setCanvasEl(el);
        }}
        className="relative h-full w-full overflow-hidden bg-[url('/canvas-fallback.svg')] bg-cover bg-center sm:aspect-[9/16] sm:h-[min(90dvh,764px)] sm:w-auto sm:shadow-[0_24px_90px_rgba(0,0,0,0.45)] sm:ring-1 sm:ring-white/10"
        onClick={p.handleCanvasTap}
      >
        <PostCanvasBackdrop
          postId={p.post.id}
          backgroundShiftPage={p.backgroundShiftPage}
          sceneTheme={p.sceneTheme}
          patternTheme={p.patternTheme}
          slidingCanvasBackground={p.slidingCanvasBackground}
          staticCanvasBackground={p.staticCanvasBackground}
          hasTransitionBackground={p.hasTransitionBackground}
        />
        <PostMediaLayer
          postId={p.post.id}
          postType={p.post.post_type}
          media={p.media}
          slide={p.slide}
          photoUrl={p.photoUrl}
          hasPhotoBackdrop={p.hasPhotoBackdrop}
          isPaused={p.isPaused}
          staticCanvasBackground={p.staticCanvasBackground}
          videoRef={p.videoRef}
        />
        <PostKineticLayer
          author={p.author}
          spec={p.spec}
          displaySpec={p.displaySpec}
          textPages={p.textPages}
          textPage={p.textPage}
          playKey={p.playKey}
          currentText={p.currentText}
          isVisible={p.isVisible}
          isPaused={p.isPaused}
          pageRevealed={p.pageRevealed}
          canvasWidth={p.canvasWidth}
          useSharedSize={tf.useSharedSize}
          needsSharedFit={tf.needsSharedFit}
          uniformPageSize={p.uniformPageSize}
          staticCanvasBackground={p.staticCanvasBackground}
          hasPhotoBackdrop={p.hasPhotoBackdrop}
          isExporting={p.isExporting}
          reportPageFit={tf.reportPageFit}
          selectTextPage={p.selectTextPage}
        />
        <PostChrome
          author={p.author}
          postType={p.post.post_type}
          isExporting={p.isExporting}
          actionMenuOpen={p.actionMenuOpen}
          setActionMenuOpen={p.setActionMenuOpen}
          isPaused={p.isPaused}
          storyOpen={cs.storyOpen}
          showCollectionPicker={p.showCollectionPicker}
          onExport={p.handleExportVideo}
          resetCurrentPage={p.resetCurrentPage}
          replayFromBeginning={p.replayFromBeginning}
        />
        <PostCornerDock
          isExporting={p.isExporting}
          liked={p.liked}
          likes={p.likes}
          commentsCount={p.comments.length}
          author={p.author}
          postUrl={p.postUrl}
          onToggleChips={p.toggleChips}
          onLikePointerDown={p.handleLikePointerDown}
          onLikePointerUp={p.handleLikePointerUp}
          onLikePointerCancel={p.handleLikePointerCancel}
        />
        <AnimatePresence>
          {!p.isExporting && p.showCollectionPicker && (
            <CollectionPicker
              selectedFolders={p.selectedFolders}
              selectedTags={p.selectedTags}
              onToggleFolder={p.handleToggleFolder}
              onToggleTag={p.handleToggleTag}
              onSave={p.handleCollectionSave}
              onClose={p.handleCollectionClose}
            />
          )}
        </AnimatePresence>
        <FlyingCommentChip
          isExporting={p.isExporting}
          showingFlyingComment={p.showingFlyingComment}
          activeComment={cf.activeComment}
          activeCommentLabel={cf.activeCommentLabel}
          activeCommentAuthor={p.activeCommentAuthor}
          commentStartX={p.commentStartX}
          commentEndX={p.commentEndX}
          commentMaxWidth={p.commentMaxWidth}
          commentOverlapEnterX={p.commentOverlapEnterX}
          commentOverlapExitX={p.commentOverlapExitX}
          setCommentOverlapsInfo={cf.setCommentOverlapsInfo}
        />
        <PostInfoBlock
          isExporting={p.isExporting}
          commentOverlapsInfo={cf.commentOverlapsInfo}
          articlePreview={p.articlePreview}
          postHashtags={p.postHashtags}
          viewCount={p.viewCount}
          createdAt={p.post.created_at}
        />
        <AnimatePresence>
          {!p.isExporting && cs.storyOpen && cs.activeStory && (
            <CommentStoryPlayer
              story={cs.activeStory}
              author={p.profilesById.get(cs.activeStory.user_id)}
              storyCount={cs.commentStories.length}
              storyIndex={cs.storyIndex}
              storyPage={cs.storyPage}
              storyPageCount={cs.storyPages.length}
              pageText={cs.storyPageText}
              playKey={cs.storyPlayKey}
              fastMode={cs.storyFastMode}
              onClose={p.closeCommentStories}
              onToggleFast={() => cs.setStoryFastMode((fast) => !fast)}
              onDragEnd={cs.handleStoryDrag}
            />
          )}
        </AnimatePresence>
        <PostCommentChips
          isExporting={p.isExporting}
          showChips={cf.showChips}
          showQuickCommentChips={cf.showQuickCommentChips}
          customComment={cf.customComment}
          normalizedCustomComment={cf.normalizedCustomComment}
          customCommentHasText={cf.customCommentHasText}
          customCommentIsKinetic={cf.customCommentIsKinetic}
          commentTrayStoryPlaying={cs.commentTrayStoryPlaying}
          activeStory={cs.activeStory}
          commentStories={cs.commentStories}
          storyIndex={cs.storyIndex}
          storyPage={cs.storyPage}
          storyPages={cs.storyPages}
          storyPageText={cs.storyPageText}
          storyPlayKey={cs.storyPlayKey}
          storyFastMode={cs.storyFastMode}
          draftCommentPage={cf.draftCommentPage}
          draftCommentPages={cf.draftCommentPages}
          draftCommentPageText={cf.draftCommentPageText}
          draftCommentPlayKey={cf.draftCommentPlayKey}
          draftCommentBackground={cf.draftCommentBackground}
          profilesById={p.profilesById}
          setShowQuickCommentChips={cf.setShowQuickCommentChips}
          setStoryFastMode={cs.setStoryFastMode}
          updateCustomComment={cf.updateCustomComment}
          submitComment={cf.submitComment}
        />
      </article>
    </section>
  );
}
