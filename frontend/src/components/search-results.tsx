import {
  Anchor,
  Badge,
  Box,
  Breadcrumbs,
  Card,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import React from "react";
import { Link } from "react-router-dom";
import MarkdownText from "./markdown-text";
import { IconChevronRight } from "@tabler/icons-react";
import classes from "./search-results.module.css";
import { HighlightedContent } from "./HighlightSearchHeadline";
import type { SearchResult } from "../api/model";

interface Props {
  data: SearchResult;
}
const SearchResults: React.FC<Props> = React.memo(({ data }) => {
  return (
    <div className={classes.column}>
      {data.map(result => {
        if (result.type === "exam") {
          return (
            <div key={`exam-${result.filename}`}>
              <Card withBorder shadow="md" mb="sm" p="md">
                <Group>
                  <Badge>Exam</Badge>
                  <Breadcrumbs
                    separator={<IconChevronRight />}
                    className={classes.noMarginBreadcrumb}
                  >
                    <Anchor
                      tt="uppercase"
                      size="xs"
                      component={Link}
                      to={`/category/${result.categorySlug}`}
                    >
                      {result.categoryDisplayname}
                    </Anchor>
                  </Breadcrumbs>
                </Group>
                <Title py="xs" order={4}>
                  <Anchor component={Link} to={`/exams/${result.filename}/`}>
                    {result.headline.map((part, i) => (
                      <HighlightedContent content={part} key={i} />
                    ))}
                  </Anchor>
                </Title>
                {result.pages.map(([page, _, matches]) => (
                  <Group key={page}>
                    <Link
                      to={`/exams/${result.filename}/#page-${page}`}
                      className="border stretched-link position-static"
                      style={{ textDecoration: "none" }}
                    >
                      <Paper
                        withBorder
                        py="xs"
                        px="md"
                        style={{ position: "static", flex: "0 0 auto" }}
                      >
                        <Text>{page}</Text>
                      </Paper>
                    </Link>
                    <Stack style={{ flexGrow: "1", flexBasis: "0" }}>
                      {matches.map((part, i) => (
                        <Box key={i}>
                          <Text component="span" c="dimmed">
                            ...{" "}
                          </Text>
                          <HighlightedContent content={part} key={i} />
                          <Text component="span" c="dimmed">
                            {" "}
                            ...
                          </Text>
                          {i !== matches.length - 1 && " "}
                        </Box>
                      ))}
                    </Stack>
                  </Group>
                ))}
              </Card>
            </div>
          );
        } else if (result.type === "answer") {
          return (
            <div key={`answer-${result.longId}`}>
              <Card withBorder shadow="md" mb="sm" p="md">
                <Group>
                  <Badge>Answer</Badge>
                  <Breadcrumbs
                    separator={<IconChevronRight />}
                    className={classes.noMarginBreadcrumb}
                  >
                    <Anchor
                      tt="uppercase"
                      size="xs"
                      component={Link}
                      to={`/category/${result.categorySlug}`}
                    >
                      {result.categoryDisplayname}
                    </Anchor>
                    <Anchor
                      tt="uppercase"
                      size="xs"
                      component={Link}
                      to={`/exams/${result.filename}`}
                    >
                      {result.examDisplayname}
                    </Anchor>
                  </Breadcrumbs>
                </Group>
                <div>
                  <Anchor
                    component={Link}
                    to={`/exams/${result.filename}/#${result.longId}`}
                  >
                    <Title py="xs" order={4}>
                      {result.author.display_name}
                    </Title>
                  </Anchor>
                  <MarkdownText
                    value={result.text}
                    highlight_matches={result.highlightedWords}
                  />
                </div>
              </Card>
            </div>
          );
        } else {
          return (
            <div key={`comment-${result.longId}`}>
              <Card withBorder shadow="md" mb="sm" p="md">
                <Group>
                  <Badge>Comment</Badge>
                  <Breadcrumbs
                    separator={<IconChevronRight />}
                    className={classes.noMarginBreadcrumb}
                  >
                    <Anchor
                      tt="uppercase"
                      size="xs"
                      component={Link}
                      to={`/category/${result.categorySlug}`}
                    >
                      {result.categoryDisplayname}
                    </Anchor>
                    <Anchor
                      tt="uppercase"
                      size="xs"
                      component={Link}
                      to={`/exams/${result.filename}`}
                    >
                      {result.examDisplayname}
                    </Anchor>
                  </Breadcrumbs>
                </Group>
                <div>
                  <Anchor
                    component={Link}
                    to={`/exams/${result.filename}/#${result.longId}`}
                  >
                    <Title py="xs" order={4}>
                      {result.author.display_name}
                    </Title>
                  </Anchor>
                  <MarkdownText
                    value={result.text}
                    highlight_matches={result.highlightedWords}
                  />
                </div>
              </Card>
            </div>
          );
        }
      })}
    </div>
  );
});
export default SearchResults;
