import { useUser } from "../auth";
import { claimExpiryRelative, hasValidClaim } from "../utils/exam-utils";
import { Button, ButtonProps } from "@mantine/core";
import React from "react";
import TooltipButton from "./TooltipButton";
import { useClaimExam } from "../api/hooks/answers";

interface Props extends ButtonProps {
  filename: string;
  claimedByUsername: string | null;
  claimedByDisplayname: string | null;
  claimTime: string | null;
  reloadExams: () => void;
}
const ClaimButton: React.FC<Props> = ({
  filename,
  claimedByUsername,
  claimedByDisplayname,
  claimTime,
  reloadExams,
  ...buttonProps
}) => {
  const { username } = useUser()!;
  const { isPending: loading, mutate: setClaim } = useClaimExam({
    mutation: { onSuccess: reloadExams },
  });
  return hasValidClaim(claimedByUsername, claimTime) ? (
    claimedByUsername === username ? (
      <Button
        size="sm"
        color="gray"
        variant="outline"
        onClick={e => {
          e.stopPropagation();
          setClaim({ filename, data: { claim: false } });
        }}
        disabled={loading}
        {...buttonProps}
      >
        Release Claim
      </Button>
    ) : (
      <TooltipButton
        size="sm"
        color="white"
        tooltip={`Expires ${claimExpiryRelative(claimTime)}`}
        disabled
        {...buttonProps}
      >
        Claimed by {claimedByDisplayname}
      </TooltipButton>
    )
  ) : (
    <Button
      size="sm"
      variant="filled"
      onClick={e => {
        e.stopPropagation();
        setClaim({ filename, data: { claim: true } });
      }}
      disabled={loading}
      {...buttonProps}
    >
      Claim Exam
    </Button>
  );
};
export default ClaimButton;
