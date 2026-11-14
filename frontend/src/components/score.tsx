import { Button, Paper } from "@mantine/core";
import React from "react";
import TooltipButton from "./TooltipButton";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { useSetAnswerLike } from "../api/hooks/answers";
import { AnswerSectionSchema } from "../api/model";

const VoteButton: React.FC<{
  vote: -1 | 1;
  userVote: -1 | 0 | 1;
  loading: boolean;
  onVote: (vote: -1 | 0 | 1) => void;
}> = ({
  vote,
  userVote,
  loading,
  onVote,
}) => {
  const isSelected = userVote === vote;

  return (
    <TooltipButton
      px={8}
      tooltip={isSelected ? "Reset vote" : vote === 1 ? "Upvote" : "Downvote"}
      size="sm"
      data-disabled={isSelected || undefined}
      style={isSelected && !loading ? { cursor: "pointer" } : undefined}
      disabled={loading}
      onClick={() => onVote(isSelected ? 0 : vote)}
    >
      {vote === 1 ? <IconChevronUp /> : <IconChevronDown />}
    </TooltipButton>
  );
};

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
  const handleVote = (vote: -1 | 0 | 1) =>
    setLike({ oid, data: { like: vote } });

  return (
    <Paper shadow="xs">
      <Button.Group>
        <VoteButton
          vote={-1}
          userVote={userVote}
          loading={loading}
          onVote={handleVote}
        />
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
        <VoteButton
          vote={1}
          userVote={userVote}
          loading={loading}
          onVote={handleVote}
        />
      </Button.Group>
    </Paper>
  );
};
export default Score;
