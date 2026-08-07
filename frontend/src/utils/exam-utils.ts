import { differenceInHours, formatRelative, parseISO } from "date-fns";

export const hasValidClaim = (
  claimedBy: string | null | undefined,
  claimTime: string | null | undefined,
) => {
  if (claimedBy && claimTime) {
    if (differenceInHours(new Date(), parseISO(claimTime)) < 4) {
      return true;
    }
  }
  return false;
};

export const claimExpiryRelative = (import_claim_time: string | null) => {
  if (import_claim_time) {
    return formatRelative(parseISO(import_claim_time), new Date());
  }
};

export const getAnswerSectionId = (sectionId: number, cutName: string) => {
  const nameParts = cutName.split(" > ");
  return `${sectionId}-${nameParts.join("-")}`;
};
