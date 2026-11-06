import {
  Anchor,
  Box,
  Breadcrumbs,
  Button,
  Card,
  Divider,
  Flex,
  Menu,
  Text,
} from "@mantine/core";
import { differenceInSeconds } from "date-fns";
import React from "react";
import { Link } from "react-router-dom";
import MarkdownText from "./markdown-text";
import {
  IconChevronRight,
  IconCode,
  IconDots,
  IconFlag,
  IconRobot,
  IconRobotOff,
} from "@tabler/icons-react";
import TimeText from "./time-text";
import classes from "./comment-single.module.css";
import { useUser } from "../auth";
import {
  useResetCommentFlagged,
  useResetCommentMarkedAsAi,
  useSetCommentFlagged,
  useSetCommentMarkedAsAi,
} from "../api/hooks/answers";
import { SingleCommentSchema } from "../api/model";
import { useDisclosure } from "@mantine/hooks";
import CodeBlock from "./code-block";
import { copy } from "../utils/clipboard";
import FlaggedBadge from "./FlaggedBadge";
import MarkedAsAiBadge from "./MarkedAsAiBadge";

interface Props {
  comment: SingleCommentSchema;
  reload: () => void;
}

const SingleCommentComponent: React.FC<Props> = ({ comment, reload }) => {
  const [viewSource, { toggle: toggleViewSource }] = useDisclosure();
  const onCommentMutated = { mutation: { onSuccess: () => reload() } };
  const { isPending: setFlaggedLoading, mutate: setExamCommentFlagged } =
    useSetCommentFlagged(onCommentMutated);
  const { isPending: resetFlaggedLoading, mutate: resetExamCommentFlagged } =
    useResetCommentFlagged(onCommentMutated);
  const { mutate: setExamCommentMarkedAsAi } =
    useSetCommentMarkedAsAi(onCommentMutated);
  const { mutate: resetExamCommentMarkedAsAi } =
    useResetCommentMarkedAsAi(onCommentMutated);
  const { isAdmin, username } = useUser()!;

  const flaggedLoading = setFlaggedLoading || resetFlaggedLoading;
  const isOwnComment = comment.author.username === username;

  return (
    <Card withBorder shadow="md" mb="md">
      <Card.Section mb="md">
        <Breadcrumbs
          px="md"
          pt="md"
          separator={<IconChevronRight />}
          className={classes.noMargin}
        >
          <Anchor
            component={Link}
            to={`/category/${comment.categorySlug}`}
            tt="uppercase"
            size="xs"
          >
            {comment.categoryDisplayname}
          </Anchor>
          <Anchor
            component={Link}
            to={`/exams/${comment.filename}`}
            tt="uppercase"
            size="xs"
          >
            {comment.examDisplayname}
          </Anchor>
          <Anchor
            component={Link}
            to={`/exams/${comment.filename}?comment=${comment.longId}&answer=${comment.answerLongId}`}
            tt="uppercase"
            size="xs"
          >
            Comment
          </Anchor>
        </Breadcrumbs>
        <Flex justify="space-between" align="center">
          <Box my="xs" px="md">
            <Anchor component={Link} to={`/user/${comment.author.username}`}>
              <Text fw={700} component="span">
                {comment.author.display_name}
              </Text>
              <Text ml="0.3em" c="dimmed" component="span">
                @{comment.author.username}
              </Text>
              <Text c="dimmed" mx={6} component="span">
                ·
              </Text>
            </Anchor>
            {comment && <TimeText time={comment.time} suffix="ago" />}
            {comment &&
              differenceInSeconds(
                new Date(comment.edittime),
                new Date(comment.time),
              ) > 1 && (
                <>
                  <Text c="dimmed" mx={6} component="span">
                    ·
                  </Text>
                  <TimeText
                    time={comment.edittime}
                    prefix="edited"
                    suffix="ago"
                  />
                </>
              )}
            <MarkedAsAiBadge count={comment.markedAsAiCount} />
          </Box>
          <Flex align="center">
            {comment && (
              <FlaggedBadge
                count={comment.flaggedCount}
                isFlagged={comment.isFlagged}
                loading={flaggedLoading}
                onToggle={
                  isOwnComment
                    ? undefined
                    : () =>
                        setExamCommentFlagged({
                          oid: comment.oid,
                          data: { flagged: !comment.isFlagged },
                        })
                }
              />
            )}
            {comment && (
              <Menu withinPortal>
                <Menu.Target>
                  <Button size="xs" variant="light" color="gray" mr="md">
                    <IconDots />
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  {!isOwnComment && (
                    <>
                      {!comment.isMarkedAsAi ? (
                        <Menu.Item
                          leftSection={<IconRobot />}
                          onClick={() =>
                            setExamCommentMarkedAsAi({
                              oid: comment.oid,
                              data: { markedAsAi: true },
                            })
                          }
                        >
                          Mark as AI-generated
                        </Menu.Item>
                      ) : (
                        <Menu.Item
                          leftSection={<IconRobotOff />}
                          onClick={() =>
                            setExamCommentMarkedAsAi({
                              oid: comment.oid,
                              data: { markedAsAi: false },
                            })
                          }
                        >
                          Remove AI-generated mark
                        </Menu.Item>
                      )}
                      {comment.flaggedCount === 0 && (
                        <Menu.Item
                          leftSection={<IconFlag />}
                          onClick={() =>
                            setExamCommentFlagged({
                              oid: comment.oid,
                              data: { flagged: true },
                            })
                          }
                        >
                          Flag as Inappropriate
                        </Menu.Item>
                      )}
                    </>
                  )}
                  <Menu.Item
                    onClick={() =>
                      copy(
                        `${document.location.origin}/exams/${comment.filename}?comment=${comment.longId}&answer=${comment.answerLongId}`,
                      )
                    }
                  >
                    Copy Permalink
                  </Menu.Item>
                  {isAdmin && comment.markedAsAiCount > 0 && (
                    <Menu.Item
                      leftSection={<IconRobotOff />}
                      onClick={() =>
                        resetExamCommentMarkedAsAi({ oid: comment.oid })
                      }
                    >
                      Remove all AI-generated marks
                    </Menu.Item>
                  )}
                  {isAdmin && comment.flaggedCount > 0 && (
                    <Menu.Item
                      leftSection={<IconFlag />}
                      onClick={() =>
                        resetExamCommentFlagged({ oid: comment.oid })
                      }
                    >
                      Remove all inappropriate flags
                    </Menu.Item>
                  )}
                  <Menu.Item
                    leftSection={<IconCode />}
                    onClick={toggleViewSource}
                  >
                    Toggle Source Code Mode
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}
          </Flex>
        </Flex>
        <Divider />
      </Card.Section>
      <div>
        {viewSource ? (
          <CodeBlock value={comment.text} language="markdown" />
        ) : (
          <MarkdownText value={comment.text} />
        )}
      </div>
    </Card>
  );
};
export default SingleCommentComponent;
