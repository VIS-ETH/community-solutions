import { Match } from "quick-score";
import React from "react";

import { css } from "emotion";

const highlighted = css`
  background-color: var(--yellow);
`;

export function highlight(string: string, matches: Match) {
  const substrings = [];
  let previousEnd = 0;

  for (const [start, end] of matches) {
    const prefix = string.substring(previousEnd, start);
    const match = (
      <span className={highlighted}>{string.substring(start, end)}</span>
    );

    substrings.push(prefix, match);
    previousEnd = end;
  }

  substrings.push(string.substring(previousEnd));

  return <span>{React.Children.toArray(substrings)}</span>;
}
