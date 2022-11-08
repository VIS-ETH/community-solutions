import { Alert, Spinner } from "@vseth/components";
import React, { useEffect, useRef, useState } from "react";
import Masonry from "react-masonry-component";
import { masonryStyle } from "../pages/userinfo-page";
import { useUserComments } from "../api/hooks";
import { SingleComment } from "../interfaces";
import SingleCommentComponent from "./comment-single";

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

interface UserCommentsProps {
  username: string;
}

const UserComments: React.FC<UserCommentsProps> = ({ username }) => {
  const PAGE_SIZE = 30; // loads a limited amount of new elements at a time when scrolling down
  const SCROLL_THRESHOLD = 4000; // bigger number means new elements will be loaded earlier when scrolling down
  const [loading, data, loadingMore, loadMore] = useUserComments(username, PAGE_SIZE);

  // loads more elements when scrolling down
  const handleScroll = () => {
    if (document.body.clientHeight <= window.scrollY + SCROLL_THRESHOLD) {
      loadMore();
    }
  };
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
  }, []);

  return (
    <>
      {(!data || data.total === 0) && !loading && (
        <Alert color="secondary">No comments</Alert>
      )}
      <div className={masonryStyle}>
        <Masonry
          options={{ fitWidth: true, transitionDuration: 0 }}
          enableResizableChildren={true}
        >
          {data &&
            data.list.map((comment) => (
              <div className="px-2 contribution-component" key={comment.oid}>
                <SingleCommentComponent comment={comment} />
              </div>
            ))}
        </Masonry>
      </div>
      {(loading || loadingMore) && <Spinner style={{ display: "flex", margin: "auto" }} />
      }
    </>
  );
};
export default UserComments;
