import {
  Anchor,
  Badge,
  Button,
  Container,
  Group,
  Table,
  Title,
} from "@mantine/core";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  useListImportExams,
  useListPaymentCheckExams,
  useRemoveExam,
} from "../api/hooks/answers";
import type { ListImportExamsSchema } from "../api/model";
import ClaimButton from "../components/claim-button";
import IconButton from "../components/icon-button";
import LoadingOverlay from "../components/loading-overlay";
import useRemoveConfirm from "../hooks/useRemoveConfirm";
import useTitle from "../hooks/useTitle";
import { IconTrash } from "@tabler/icons-react";

const ModQueue: React.FC = () => {
  useTitle("Import Queue");
  const [includeHidden, setIncludeHidden] = useState(false);
  const {
    error: examsError,
    isFetching: examsLoading,
    data: exams,
    refetch: reloadExams,
  } = useListImportExams(
    { includeHidden },
    { query: { select: data => data.value } },
  );
  const [removeConfirm, modals] = useRemoveConfirm();
  const { mutate: runRemoveExam } = useRemoveExam({
    mutation: { onSuccess: () => void reloadExams() },
  });
  const handleRemoveClick = (exam: ListImportExamsSchema) => {
    removeConfirm(
      `Remove the exam named ${exam.displayname}? This will remove all answers and can not be undone!`,
      () => runRemoveExam({ filename: exam.filename }),
    );
  };
  const {
    error: payError,
    isFetching: payLoading,
    data: paymentExams,
  } = useListPaymentCheckExams({ query: { select: data => data.value } });

  const error = examsError ?? payError;

  return (
    <Container size="xl">
      {modals}
      {paymentExams && paymentExams.length > 0 && (
        <div>
          <Title my="sm" order={2}>
            Transcripts
          </Title>
          <div>
            <LoadingOverlay visible={payLoading} />
            <Table striped>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Name</th>
                  <th>Uploader</th>
                </tr>
              </thead>
              <tbody>
                {paymentExams.map(exam => (
                  <tr key={exam.filename}>
                    <Table.Td>{exam.categoryDisplayname}</Table.Td>
                    <Table.Td>
                      <Link to={`/exams/${exam.filename}`} target="_blank">
                        {exam.displayname}
                      </Link>
                    </Table.Td>
                    <Table.Td>
                      {exam.paymentUploader && (
                        <Link to={`/user/${exam.paymentUploader.username}`}>
                          {exam.paymentUploader.display_name}
                        </Link>
                      )}
                    </Table.Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </div>
      )}
      <Title my="sm" order={2}>
        Import Queue
      </Title>
      {error && <div>{error as unknown as string}</div>}
      <div>
        <LoadingOverlay visible={examsLoading} />
        <Table fz="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Category</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Import State</Table.Th>
              <Table.Th>Claim</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {exams?.map(exam => (
              <Table.Tr key={exam.filename}>
                <Table.Td>{exam.categoryDisplayname}</Table.Td>
                <Table.Td>
                  <Group>
                    <Anchor
                      c="blue"
                      component={Link}
                      to={`/exams/${exam.filename}`}
                      target="_blank"
                    >
                      {exam.displayname}
                    </Anchor>
                    {exam.public && <Badge color="green">public</Badge>}
                    {!exam.public && <Badge color="orange">hidden</Badge>}
                    <p>{exam.remark}</p>
                  </Group>
                </Table.Td>
                <Table.Td>
                  {exam.finishedCuts ? "All done" : "Needs Cuts"}
                </Table.Td>
                <Table.Td>
                  {!exam.finishedCuts && (
                    <ClaimButton
                      filename={exam.filename}
                      claimedByUsername={exam.importClaim?.username ?? null}
                      claimedByDisplayname={
                        exam.importClaim?.display_name ?? null
                      }
                      claimTime={exam.importClaimTime}
                      reloadExams={() => void reloadExams()}
                    />
                  )}
                </Table.Td>
                <Table.Td>
                  <IconButton
                    size="md"
                    color="red"
                    tooltip="Delete exam"
                    icon={<IconTrash />}
                    variant="outline"
                    onClick={() => handleRemoveClick(exam)}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </div>
      <Button mt="sm" mb="xl" onClick={() => setIncludeHidden(!includeHidden)}>
        {includeHidden ? "Hide" : "Show"} Complete Hidden Exams
      </Button>
    </Container>
  );
};
export default ModQueue;
