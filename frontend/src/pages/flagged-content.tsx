import { useLocalStorageState } from "ahooks";
import {
  Anchor,
  Container,
  Divider,
  Flex,
  LoadingOverlay,
  SegmentedControl,
  Table,
  Title,
  Text,
} from "@mantine/core";
import { Link } from "react-router-dom";
import { useListFlagged } from "../api/hooks/answers";
import type { ListFlaggedSchema } from "../api/model";
import { useMemo } from "react";
import useTitle from "../hooks/useTitle";

interface FlaggedTableUserProps {
  author: string;
  flaggedContent: ListFlaggedSchema[];
  count: number;
}

const FlaggedTableUser: React.FC<FlaggedTableUserProps> = ({
  author,
  flaggedContent,
  count,
}) => {
  return (
    <Container mt="sm" key={author}>
      <Flex justify="space-between">
        <Anchor
          size="xl"
          c="blue"
          component={Link}
          to={`/user/${author}`}
          target="_blank"
        >
          {author}
        </Anchor>
        <Text size="xl" fw="bold">
          Total Flag Count: {count}
        </Text>
      </Flex>
      <Divider />
      <Table fz="md" style={{ tableLayout: "fixed", width: "100%" }}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ width: "70%" }}>Link</Table.Th>
            <Table.Th style={{ width: "20%" }}>Type</Table.Th>
            <Table.Th style={{ width: "10%" }}>Count</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {flaggedContent.map(fs => (
            <Table.Tr key={fs.link}>
              <Table.Td>
                <Anchor
                  c="blue"
                  component={Link}
                  to={fs.link}
                  target="_blank"
                  style={{ wordBreak: "break-all" }}
                >
                  {fs.link}
                </Anchor>
              </Table.Td>
              <Table.Td>{fs.flagType ? "Comment" : "Answer"}</Table.Td>
              <Table.Td>{fs.flaggedCount}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Container>
  );
};

interface FlaggedTableProps {
  flaggedList: ListFlaggedSchema[];
  typed: boolean; // True if the table includes types false if not
}

const FlaggedTable: React.FC<FlaggedTableProps> = ({ flaggedList, typed }) => {
  return (
    <Table fz="md" style={{ tableLayout: "fixed", width: "100%" }}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th style={{ width: typed ? "50%" : "60%" }}>Link</Table.Th>
          <Table.Th style={{ width: typed ? "25%" : "30%" }}>Author</Table.Th>
          {typed && <Table.Th style={{ width: "15%" }}>Type</Table.Th>}
          <Table.Th style={{ width: "10%" }}>Count</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {flaggedList.map(content => (
          <Table.Tr key={content.link}>
            <Table.Td>
              <Anchor
                c="blue"
                component={Link}
                to={content.link}
                target="_blank"
                style={{ wordBreak: "break-all" }}
              >
                {content.link}
              </Anchor>
            </Table.Td>
            <Table.Td>
              <Anchor
                c="blue"
                component={Link}
                to={`/user/${content.author.username}`}
                target="_blank"
              >
                {content.author.display_name}
              </Anchor>
            </Table.Td>
            {typed && (
              <Table.Td>{content.flagType ? "Comment" : "Answer"}</Table.Td>
            )}
            <Table.Td>{content.flaggedCount}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
};

const FlaggedContent: React.FC = () => {
  const {
    error: flaggedError,
    isLoading: flaggedLoading,
    data: flaggedList,
  } = useListFlagged({ query: { select: data => data.value } });

  const [mode, setMode] = useLocalStorageState("flaggedMode", "noGrouping");

  const [flaggedListNoGroup, flaggedListByAuthor, flaggedListByType] =
    useMemo(() => {
      if (!flaggedList) {
        return [undefined, undefined, undefined];
      }
      const flaggedListNoGroup = [...flaggedList].sort(
        (a, b) => b.flaggedCount - a.flaggedCount,
      );
      const byAuthor = new Map<string, [ListFlaggedSchema[], number]>();
      const byType = {
        comments: [] as ListFlaggedSchema[],
        answers: [] as ListFlaggedSchema[],
      };
      flaggedListNoGroup.forEach(fs => {
        const [list, count] = byAuthor.get(fs.author.username) ?? [[], 0];
        list.push(fs);
        byAuthor.set(fs.author.username, [list, count + fs.flaggedCount]);
        if (fs.flagType) {
          byType.comments.push(fs);
        } else {
          byType.answers.push(fs);
        }
      });
      return [flaggedListNoGroup, Array.from(byAuthor.entries()), byType];
    }, [flaggedList]);

  useTitle("Flagged Content");

  if (flaggedError) {
    return <Text color="red">Could not load flagged content.</Text>;
  }

  return (
    <Container size="xl">
      <Title order={2} mb="md">
        Flagged Content
      </Title>
      <SegmentedControl
        value={mode}
        onChange={setMode}
        data={[
          { label: "No Grouping", value: "noGrouping" },
          { label: "By Type", value: "byType" },
          { label: "By Author", value: "byAuthor" },
        ]}
      />
      <LoadingOverlay visible={flaggedLoading} />
      {mode === "noGrouping" && flaggedListNoGroup && (
        <FlaggedTable flaggedList={flaggedListNoGroup} typed={true} />
      )}
      {mode === "byAuthor" &&
        flaggedListByAuthor?.map(([author, [flaggedContent, count]]) => (
          <FlaggedTableUser
            key={author}
            author={author}
            flaggedContent={flaggedContent}
            count={count}
          />
        ))}
      {mode === "byType" && flaggedListByType && (
        <Container>
          <Title order={2}>Answers</Title>
          <FlaggedTable flaggedList={flaggedListByType.answers} typed={false} />
          <Title order={2}>Comments</Title>
          <FlaggedTable
            flaggedList={flaggedListByType.comments}
            typed={false}
          />
        </Container>
      )}
    </Container>
  );
};
export default FlaggedContent;
