import { useEffect, useState, type RefObject } from "react";
import { useLocation } from "react-router-dom";
import { loadReadingPage, saveReadingPage } from "../utils/reading-page";

// The exam owner is keyed by filename, so this snapshot lasts one visit.
export default function useReadingPage(
  examFilename: string,
  pagesInViewport: Set<number>,
  displayedPages: Set<number> | undefined,
  examContainerRef: RefObject<HTMLElement | null>,
) {
  const [bookmarkedPage] = useState(() => loadReadingPage(examFilename));
  const { hash, search } = useLocation();
  const searchParams = new URLSearchParams(search);
  const hasNavigationTarget =
    Boolean(hash) || searchParams.has("answer") || searchParams.has("comment");
  const [resumePromptDismissed, setResumePromptDismissed] =
    useState(hasNavigationTarget);
  const showResumePrompt =
    !resumePromptDismissed &&
    !hasNavigationTarget &&
    bookmarkedPage !== undefined &&
    Boolean(displayedPages?.has(bookmarkedPage)) &&
    bookmarkedPage !== Math.min(...(displayedPages ?? []));
  const firstPageInViewport = Math.min(...pagesInViewport);

  useEffect(() => {
    // Keep the old bookmark until the reader chooses Resume or Dismiss.
    if (!showResumePrompt && Number.isFinite(firstPageInViewport))
      saveReadingPage(examFilename, firstPageInViewport);
  }, [examFilename, firstPageInViewport, showResumePrompt]);

  return {
    visible: showResumePrompt,
    onDismiss: () => setResumePromptDismissed(true),
    onResume: () => {
      const bookmarkedPageAnchor = examContainerRef.current?.querySelector(
        `#page-${bookmarkedPage}`,
      );
      if (!bookmarkedPageAnchor) return;
      bookmarkedPageAnchor.scrollIntoView({ behavior: "instant" });
      setResumePromptDismissed(true);
    },
  };
}
