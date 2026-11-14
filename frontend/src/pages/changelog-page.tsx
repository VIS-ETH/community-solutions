import * as React from "react";
import {
  Container,
  Timeline,
  Group,
  Badge,
  Paper,
  Title,
  Anchor,
} from "@mantine/core";
import { versions } from "../utils/changelog";
import MarkdownText from "../components/markdown-text";
import useTitle from "../hooks/useTitle";
import { useChangelog } from "../hooks/useChangelog";

const ChangelogPage: React.FC = () => {
  useTitle("What's New");

  const { lastSeen, dismiss } = useChangelog();

  // Remember the first value so we can set local storage without triggering
  // a re-render
  const [lastSeenState] = React.useState(lastSeen);

  const lastSeenIndex = versions.findIndex(v => v.version === lastSeenState);

  // Dismiss in background after 1 second on the page
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      dismiss();
    }, 1000);
    return () => clearTimeout(timeout);
  }, [dismiss]);

  return (
    <Container size="xl">
      <Title order={1} mb="lg">
        Changelog
      </Title>

      <Timeline
        active={lastSeenIndex !== -1 ? lastSeenIndex - 1 : versions.length - 1}
        radius="md"
        bulletSize={36}
      >
        {versions.map((version, index) => {
          return (
            <Timeline.Item
              title={
                <Group wrap="nowrap" gap="xs" mb="lg">
                  <Title order={2}>{version.version}</Title>
                  {index < lastSeenIndex && (
                    <Badge color="brand">New since your last visit</Badge>
                  )}
                </Group>
              }
              key={version.version}
            >
              <Paper
                withBorder
                p="md"
                style={
                  index < lastSeenIndex
                    ? { borderLeft: "2px solid var(--mantine-color-brand-6)" }
                    : {}
                }
              >
                <MarkdownText value={version.content} />
              </Paper>
            </Timeline.Item>
          );
        })}
      </Timeline>

      <Title order={2} mt="xl">
        All Changes
      </Title>
      <p>
        An exhaustive list of changes and older releases is available on GitLab:{" "}
        <Anchor
          href="https://gitlab.ethz.ch/vseth/sip-com-apps/community-solutions"
          c="blue"
        >
          gitlab.ethz.ch/vseth/sip-com-apps/community-solutions
        </Anchor>
        .
      </p>
    </Container>
  );
};

export default ChangelogPage;
