import { Stack, Text } from "@mantine/core";
import { css } from "@emotion/css";
import React, { useState } from "react";
import { Answer, AnswerSection } from "../interfaces";
import CommentComponent from "./comment";

const showMoreStyle = css`
  text-decoration: underline;
  cursor: pointer;
`;
const listGroupStyle = css`
  margin-top: 1em;
`;

interface Props {
  hasDraft: boolean;
  answer: Answer;
  onSectionChanged: (newSection: AnswerSection) => void;
  onDraftDelete: () => void;
  solution_file?: string;
  targetWidth?: number
}
const CommentSectionComponent: React.FC<Props> = ({
  hasDraft,
  answer,
  onSectionChanged,
  onDraftDelete,
  solution_file,
  targetWidth,
}) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <Stack spacing="0" className={listGroupStyle}>
        {(expanded ? answer.comments : answer.comments.slice(0, 3)).map(
          comment => (
            <CommentComponent
              answer={answer}
              onSectionChanged={onSectionChanged}
              comment={comment}
              key={comment.oid}
              solution_file={solution_file}
              targetWidth={targetWidth}
            />
          ),
        )}
        {hasDraft && (
          <CommentComponent
            answer={answer}
            onSectionChanged={onSectionChanged}
            comment={undefined}
            onDelete={onDraftDelete}
            solution_file={solution_file}
            targetWidth={targetWidth}
          />
        )}
      </Stack>
      {answer.comments.length > 3 && !expanded && (
        <Text
          pt="xs"
          onClick={() => setExpanded(true)}
          className={showMoreStyle}
        >
          {answer.comments.length === 4 ? (
            "Show 1 more comment..."
          ) : (
            <>Show {answer.comments.length - 3} more comments...</>
          )}
        </Text>
      )}
    </>
  );
};
export default CommentSectionComponent;
