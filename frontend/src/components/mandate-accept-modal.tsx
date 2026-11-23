import { Alert, Button, Group, Modal } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { differenceInCalendarDays, lightFormat, parseISO } from "date-fns";
import React from "react";
import GlobalConsts from "../globalconsts";

const SHORT_MANDATE_DAYS = 30;

interface MandateAcceptModalProps {
  opened: boolean;
  onClose: () => void;
  onAccept: () => void;
  loading?: boolean;
  categoryDisplayname?: string;
  dueDate?: string;
}

const MandateAcceptModal: React.FC<MandateAcceptModalProps> = ({
  opened,
  onClose,
  onAccept,
  loading,
  categoryDisplayname,
  dueDate,
}) => {
  const daysLeft =
    dueDate === undefined
      ? undefined
      : differenceInCalendarDays(parseISO(dueDate), new Date());
  const formattedDueDate =
    dueDate === undefined
      ? undefined
      : lightFormat(parseISO(dueDate), GlobalConsts.dateFNSFormatStringDate);
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        categoryDisplayname
          ? `Mandate Acceptance: ${categoryDisplayname}`
          : "Mandate Acceptance"
      }
    >
      {daysLeft !== undefined && daysLeft < SHORT_MANDATE_DAYS && (
        <Alert
          color="yellow"
          icon={<IconAlertTriangle />}
          title="This mandate is due very soon"
          mb="md"
        >
          If you accept now, you have to upload your transcript by the end of{" "}
          <strong>{formattedDueDate}</strong>, in only {daysLeft}{" "}
          {daysLeft === 1 ? "day" : "days"}. If your oral exam is after that,
          you most likely do not want to accept the mandate yet.
        </Alert>
      )}
      We require you to accept the terms of oral exam contributions before
      proceeding. By accepting, you agree to actively contribute to Community
      Solutions and adhere to the guidelines provided. Please read the terms
      carefully before accepting.
      <br />A transcript of your oral exam <strong>MUST</strong> be uploaded to
      Community Solutions. If you do not upload a transcript, your{" "}
      <strong>access</strong> to all exams <strong>will be blocked</strong>.
      <br />
      You will have time to upload the transcript until the end of the exam
      sessions
      {formattedDueDate && (
        <>
          , i.e. until the end of <strong>{formattedDueDate}</strong>
        </>
      )}
      .
      <br />
      You <strong>CANNOT CANCEL</strong> this on your own, and will need to
      explain and show your situation to an administrator or board member.
      <br />
      For any questions or concerns, please contact an administrator or your
      friendly board members.
      <Group justify="right" mt="md">
        <Button mt="md" onClick={onClose}>
          Dismiss
        </Button>
        <Button
          mt="md"
          variant="light"
          color="red"
          loading={loading}
          onClick={onAccept}
        >
          Accept
        </Button>
      </Group>
    </Modal>
  );
};

export default MandateAcceptModal;
