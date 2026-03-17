import React from "react";
import { Button, Paper } from "@mantine/core";
import { IconChevronUp, IconRobot, IconX } from "@tabler/icons-react";
import TooltipButton from "./TooltipButton";

interface MarkedAsAiBadgeProps {
  count: number;
  isMarkedAsAi: boolean;
  loading: boolean;
  size?: string;
  onToggle: () => void;
}

const MarkedAsAiBadge: React.FC<MarkedAsAiBadgeProps> = ({
  count,
  isMarkedAsAi,
  loading,
  size,
  onToggle,
}) => {
  if (count === 0) return null;

  return (
    <Paper shadow="xs" mr="md">
      <Button.Group>
        <TooltipButton
          tooltip="Marked as AI-generated"
          color="blue"
          px={12}
          variant="filled"
          size={size}
        >
          <IconRobot />
        </TooltipButton>
        <TooltipButton
          color="blue"
          miw={30}
          tooltip={`${count} user${count === 1 ? "" : "s"} consider${count === 1 ? "s" : ""} this answer AI-generated.`}
          size={size}
        >
          {count}
        </TooltipButton>
        <TooltipButton
          px={8}
          tooltip={isMarkedAsAi ? "Remove AI-generated mark" : "Mark as AI-generated"}
          size={size ?? "sm"}
          loading={loading}
          style={{ borderLeftWidth: 0 }}
          onClick={onToggle}
        >
          {isMarkedAsAi ? <IconX /> : <IconChevronUp />}
        </TooltipButton>
      </Button.Group>
    </Paper>
  );
};

export default MarkedAsAiBadge;
