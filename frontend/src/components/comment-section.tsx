import { Button, Group, Stack, Text } from "@mantine/core";
import classes from "./comment-section.module.css";
import React, { useState } from "react";
import { Answer, AnswerSection } from "../interfaces";
import CommentComponent from "./comment";
import { IconMessageCirclePlus } from "@tabler/icons-react";
import clsx from "clsx";

interface Props {
  hasDraft: boolean;
  answer: Answer;
  onSectionChanged: (newSection: AnswerSection) => void;
  onChainReply: () => void;
  onDraftDelete: () => void;
}
const CommentSectionComponent: React.FC<Props> = ({
  hasDraft,
  answer,
  onSectionChanged,
  onChainReply,
  onDraftDelete,
}) => {
  const [expanded, setExpanded] = useState(false);
  const theresMore = answer.comments.length > 3 && !expanded;
  return (
    <>
      <Stack
        gap="0"
        className={clsx(
          classes.commentTree,
          theresMore ? classes.continuingTree : [],
        )}
      >
        {(expanded ? answer.comments : answer.comments.slice(0, 3)).map(
          comment => (
            <CommentComponent
              answer={answer}
              onSectionChanged={onSectionChanged}
              comment={comment}
              key={comment.oid}
            />
          ),
        )}
        {hasDraft && (
          <CommentComponent
            answer={answer}
            onSectionChanged={onSectionChanged}
            comment={undefined}
            onDelete={onDraftDelete}
          />
        )}
      </Stack>
      <Group justify="space-between">
        {theresMore && (
          <Button
            variant="transparent"
            color="dark"
            onClick={() => setExpanded(true)}
            className={classes.showMore}
          >
            {answer.comments.length === 4 ? (
              "Show 1 more comment..."
            ) : (
              <>Show {answer.comments.length - 3} more comments...</>
            )}
          </Button>
        )}
        {answer.comments.length > 0 && !hasDraft && (
          <Button
            variant="transparent"
            leftSection={<IconMessageCirclePlus />}
            color="dark"
            onClick={onChainReply}
            className={classes.chainReply}
          >
            Add Comment
          </Button>
        )}
      </Group>
    </>
  );
};
export default CommentSectionComponent;
