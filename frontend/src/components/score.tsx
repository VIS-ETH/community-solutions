import { Button, Paper } from "@mantine/core";
import React from "react";
import TooltipButton from "./TooltipButton";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { useSetAnswerLike } from "../api/hooks/answers";
import { AnswerSectionSchema } from "../api/model";

interface Props {
  oid: number;
  upvotes: number;
  userVote: -1 | 0 | 1;
  onSectionChanged: (newSection: AnswerSectionSchema) => void;
}
const Score: React.FC<Props> = ({
  oid,
  upvotes,
  userVote,
  onSectionChanged,
}) => {
  const { isPending: loading, mutate: setLike } = useSetAnswerLike({
    mutation: {
      onSuccess: ({ value }) => onSectionChanged(value),
    },
  });
  return (
    <Paper shadow="xs">
      <Button.Group>
        <TooltipButton
          px={8}
          tooltip="Downvote"
          size="sm"
          disabled={userVote === -1}
          onClick={() => setLike({ oid, data: { like: -1 } })}
        >
          <IconChevronDown />
        </TooltipButton>
        <TooltipButton
          tooltip="Reset vote"
          size="sm"
          px="sm"
          miw={40}
          loading={loading}
          onClick={() => setLike({ oid, data: { like: 0 } })}
        >
          {upvotes}
        </TooltipButton>
        <TooltipButton
          px={8}
          tooltip="Upvote"
          size="sm"
          disabled={userVote === 1}
          onClick={() => setLike({ oid, data: { like: 1 } })}
        >
          <IconChevronUp />
        </TooltipButton>
      </Button.Group>
    </Paper>
  );
};
export default Score;
