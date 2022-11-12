import { Alert, Spinner } from "@vseth/components";
import React, { useEffect, useState } from "react";
import Masonry from "react-masonry-component";
import { masonryStyle } from "../pages/userinfo-page";
import { useUserAnswers } from "../api/hooks";
import AnswerComponent from "./answer";
// `transform: translateX(0)` fixes an issue on webkit browsers
// where relative positioned elements aren't displayed in containers
// with multiple columns. This is a quick-fix as pointed out on the
// webkit bug reporting platform.
// Example: https://codepen.io/lukasmoeller/pen/JjGyJXY (rel is hidden)
// Issue: https://gitlab.ethz.ch/vis/cat/community-solutions/-/issues/147
// Webkit Bug: https://bugs.webkit.org/show_bug.cgi?id=209681
// It seems like there is a fix live in Safari Technology Preview
// This fix should be left in here until the fix is published for
// Safari iOS + macOS

interface UserAnswersProps {
  username: string;
}


const UserAnswers: React.FC<UserAnswersProps> = ({ username }) => {
  const PAGE_SIZE = 20; // loads a limited amount of new elements at a time when scrolling down
  const SCROLL_THRESHOLD = 3000; // bigger number means new elements will be loaded earlier when scrolling down
  const LOAD_SCALE = 3; // the factor of PAGE_SIZE elements that should be requested when scrolling down
  const [loaded, setLoaded] = useState(0); // to limit how much is loaded
  const [page, setPage] = useState(0);
  const [loading, data, loadingMore, loadMore, reload, noMore] = useUserAnswers(username, LOAD_SCALE * PAGE_SIZE);

  // loads more elements when scrolling down
  const handleScroll = () => {
    if (document.body.clientHeight <= window.scrollY + SCROLL_THRESHOLD) {
      setPage(p => p + 1);
    }
  };
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
  }, []);

  // loads all answers in chunks
  useEffect(() => {
    if (loaded < (page + 1) * LOAD_SCALE && !loadingMore && !noMore) {
      loadMore();
      setLoaded(v => v + 1);
    }
  }, [loadingMore, noMore, data, page])

  return (
    <>
      {(!data || data.total === 0) && !loading && <Alert color="secondary">No answers</Alert>}
      <div className={masonryStyle}>
        <Masonry
          options={{ fitWidth: true, transitionDuration: 0 }}
          enableResizableChildren={true}
        >
          {data &&
            data.list.slice(0, (page + 1) * PAGE_SIZE).map((answer) => (
              <div className="px-2 contribution-component" key={answer.oid}>
                <AnswerComponent
                  hasId={false}
                  answer={answer}
                  isLegacyAnswer={answer.isLegacyAnswer}
                  onSectionChanged={loadMore}
                />
              </div>
            ))}
        </Masonry>
      </div>
      {(loadingMore || loading) && <Spinner style={{ display: "flex", margin: "auto" }} />}
    </>
  );
};
export default UserAnswers;
