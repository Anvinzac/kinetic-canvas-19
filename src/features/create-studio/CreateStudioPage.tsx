/**
 * Create-studio page shell: wire composer hooks and switch editor panels.
 *
 * Exports: CreateStudioPage
 * Depends on: create-studio hooks + header/preview/panels
 */

import { useRef, type ReactElement } from "react";
import { BackgroundPanel } from "./components/BackgroundPanel";
import { ColorPanel } from "./components/ColorPanel";
import { FontPanel } from "./components/FontPanel";
import { LayoutPanel } from "./components/LayoutPanel";
import { MotionPanel } from "./components/MotionPanel";
import { StudioHeader } from "./components/StudioHeader";
import { StudioPreviewPane } from "./components/StudioPreviewPane";
import { WritePanel } from "./components/WritePanel";
import { useStudioAccents } from "./hooks/useStudioAccents";
import { useStudioComposerState } from "./hooks/useStudioComposerState";
import { useStudioPublish } from "./hooks/useStudioPublish";
import { useStudioTextPages } from "./hooks/useStudioTextPages";
import { useStudioUpload } from "./hooks/useStudioUpload";

/**
 * Compose the authenticated create-studio experience.
 * @returns Full create-studio page
 */
export function CreateStudioPage(): ReactElement {
  const studio = useStudioComposerState();
  const accentResetRef = useRef<() => void>(() => {});
  const text = useStudioTextPages({
    spec: studio.spec,
    setSpec: studio.setSpec,
    setPreviewAnimating: studio.setPreviewAnimating,
    onAccentReset: () => accentResetRef.current(),
    setActivePage: studio.setActivePage,
  });
  const accents = useStudioAccents({
    currentTextPage: text.currentTextPage,
    stickers: studio.spec.stickers,
    setSpec: studio.setSpec,
    setPreviewAnimating: studio.setPreviewAnimating,
  });
  accentResetRef.current = () => accents.setAccentRecommendation(null);

  const { canPost, publish } = useStudioPublish({
    publishText: text.publishText,
    articleInvalid: studio.articleInvalid,
    publishSpec: studio.publishSpec(text.publishText),
    publishBackground: studio.publishBackground,
    mediaUrls: studio.mediaUrls,
    postType: studio.postType,
    posting: studio.posting,
    setPosting: studio.setPosting,
  });
  const { handleUpload } = useStudioUpload({
    setUploadedPhoto: studio.setUploadedPhoto,
    setBackgroundMode: studio.setBackgroundMode,
  });

  return (
    <div className="min-h-[100dvh] overflow-y-auto bg-background pb-8 text-foreground">
      <StudioHeader
        title={studio.pageTitle.title}
        subtitle={studio.pageTitle.subtitle}
        canPost={canPost}
        posting={studio.posting}
        isWritePage={studio.activePage === "write"}
        onBack={studio.goBack}
        onPublish={publish}
      />

      <main className="mx-auto max-w-md px-4 py-4">
        <StudioPreviewPane
          previewRowHeight={studio.previewRowHeight}
          previewPaneHeight={studio.previewPaneHeight}
          onFrameChange={(frame) => studio.setComposerCanvasHeight(frame.height)}
          onReplay={studio.replayPreview}
          previewScene={studio.previewScene}
          previewPattern={studio.previewPattern}
          previewSlidingBackground={studio.previewSlidingBackground}
          previewBackground={studio.previewBackground}
          playKey={studio.playKey}
          backgroundMode={studio.backgroundMode}
          activePhoto={studio.activePhoto}
          activeVideo={studio.activeVideo}
          currentTextPage={text.currentTextPage}
          previewSpec={studio.previewSpec(text.currentTextPage)}
          previewAnimating={studio.previewAnimating}
          selectedTransitionGradients={studio.selectedTransitionGradients}
          safeBg={studio.safeBg}
          spec={studio.spec}
          composerPagesLength={text.composerPages.length}
          activeTextPage={text.activeTextPage}
          articlePreview={studio.articlePreview}
          bg={studio.bg}
          selectedGradientPath={studio.selectedGradientPath}
          selectedSceneId={studio.selectedSceneId}
          selectedPatternId={studio.selectedPatternId}
          selectedPhoto={studio.selectedPhoto}
          selectedVideo={studio.selectedVideo}
          onApplyTemplate={(template) => studio.applyTemplate(template, text.currentTextPage)}
        />

        <section className="pt-2">
          {studio.activePage === "write" && (
            <WritePanel
              backgroundSummary={studio.backgroundSummary}
              fontSummary={studio.fontSummary}
              colorSummary={studio.colorSummary}
              layoutSummary={studio.layoutSummary}
              motionSummary={studio.motionSummary}
              setActivePage={studio.setActivePage}
              composerPages={text.composerPages}
              activeTextPage={text.activeTextPage}
              backgroundMode={studio.backgroundMode}
              selectTextPage={text.selectTextPage}
              openPageBackdropEditor={text.openPageBackdropEditor}
              removeTextPage={text.removeTextPage}
              insertTextPageAfter={text.insertTextPageAfter}
              updateTextPage={text.updateTextPage}
              setActiveTextPage={text.setActiveTextPage}
              setPreviewAnimating={studio.setPreviewAnimating}
              textareaRefs={text.textareaRefs}
              spec={studio.spec}
              accentRecommendation={accents.accentRecommendation}
              accentLoading={accents.accentLoading}
              acceptEmojiAccent={accents.acceptEmojiAccent}
              rejectAccent={accents.rejectAccent}
              removeAccent={accents.removeAccent}
              articleOpen={studio.articleOpen}
              setArticleOpen={studio.setArticleOpen}
              articleUrl={studio.articleUrl}
              setArticleUrl={studio.setArticleUrl}
              articleInvalid={studio.articleInvalid}
              articlePreview={studio.articlePreview}
            />
          )}
          {studio.activePage === "background" && (
            <BackgroundPanel
              backgroundMode={studio.backgroundMode}
              setBackgroundMode={studio.setBackgroundMode}
              bg={studio.bg}
              setBg={studio.setBg}
              selectedGradientPath={studio.selectedGradientPath}
              setSelectedGradientPath={studio.setSelectedGradientPath}
              selectedSceneId={studio.selectedSceneId}
              setSelectedSceneId={studio.setSelectedSceneId}
              selectedPatternId={studio.selectedPatternId}
              setSelectedPatternId={studio.setSelectedPatternId}
              selectedPhoto={studio.selectedPhoto}
              setSelectedPhoto={studio.setSelectedPhoto}
              selectedVideo={studio.selectedVideo}
              setSelectedVideo={studio.setSelectedVideo}
              uploadedPhoto={studio.uploadedPhoto}
              onReplay={studio.replayPreview}
              onUpload={handleUpload}
              setActivePage={studio.setActivePage}
            />
          )}
          {studio.activePage === "font" && (
            <FontPanel
              spec={studio.spec}
              patch={studio.patch}
              onReplay={studio.replayPreview}
              setActivePage={studio.setActivePage}
            />
          )}
          {studio.activePage === "color" && (
            <ColorPanel
              spec={studio.spec}
              patch={studio.patch}
              setActivePage={studio.setActivePage}
            />
          )}
          {studio.activePage === "layout" && (
            <LayoutPanel
              spec={studio.spec}
              updatePlacement={studio.updatePlacement}
              setActivePage={studio.setActivePage}
            />
          )}
          {studio.activePage === "motion" && (
            <MotionPanel
              spec={studio.spec}
              patch={studio.patch}
              onReplay={studio.replayPreview}
              setActivePage={studio.setActivePage}
            />
          )}
        </section>
      </main>
    </div>
  );
}
