import {
  Anchor,
  Box,
  Button,
  Card,
  Flex,
  Group,
  GroupProps,
  Loader,
  Menu,
  Paper,
  Text,
  Tooltip,
} from "@mantine/core";
import { differenceInSeconds } from "date-fns";
import React, { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { clsx } from "clsx";
import { usePendingImages } from "./Editor/pending-images";
import {
  useRemoveAnswer,
  useResetAnswerFlagged,
  useResetAnswerMarkedAsAi,
  useSetAnswer,
  useSetAnswerFlagged,
  useSetAnswerMarkedAsAI,
  useSetExpertVote,
} from "../api/hooks/answers";
import { AnswerSchema, AnswerSectionSchema, AnswerKind } from "../api/model";
import { useUser } from "../auth";
import useRemoveConfirm from "../hooks/useRemoveConfirm";
import { copy } from "../utils/clipboard";
import CodeBlock from "./code-block";
import CommentSectionComponent from "./comment-section";
import { UndoStack } from "./Editor/utils/undo-stack";
import MarkdownText from "./markdown-text";
import Score from "./score";
import TooltipButton from "./TooltipButton";
import { useOfficialSolutionLanguage } from "./official-solution";
import {
  IconArrowLeft,
  IconChevronDown,
  IconChevronUp,
  IconCode,
  IconDeviceFloppy,
  IconDots,
  IconEdit,
  IconFileText,
  IconFlag,
  IconLink,
  IconMessageCirclePlus,
  IconPencilCancel,
  IconRobot,
  IconRobotOff,
  IconStarFilled,
  IconTrash,
} from "@tabler/icons-react";
import FlaggedBadge from "./FlaggedBadge";
import MarkedAsAiBadge from "./MarkedAsAiBadge";
import classes from "./answer.module.css";
import { useDisclosure } from "@mantine/hooks";
import TimeText from "./time-text";
import {
  saveDraftToStorage,
  readDraftFromStorage,
  clearExpiredDrafts,
} from "../utils/drafts";

const Editor = lazy(() => import("./Editor"));

const AnswerToolbar = (props: GroupProps) => (
  <Group className={classes.answerToolbarStyle} {...props} />
);

interface Props {
  section?: AnswerSectionSchema;
  answer?: AnswerSchema;
  onSectionChanged?: (newSection: AnswerSectionSchema) => void;
  onDelete?: () => void;
  answerKind: AnswerKind;
  hasId?: boolean;
}
const AnswerComponent: React.FC<Props> = ({
  section,
  answer,
  onDelete,
  onSectionChanged,
  answerKind,
  hasId = true,
}) => {
  const [viewSource, { toggle: toggleViewSource }] = useDisclosure();
  const onSectionMutated = {
    mutation: {
      onSuccess: ({ value }: { value: AnswerSectionSchema }) =>
        onSectionChanged?.(value),
    },
  };
  const { isPending: setFlaggedLoading, mutate: setAnswerFlagged } =
    useSetAnswerFlagged(onSectionMutated);
  const { isPending: resetFlaggedLoading, mutate: resetAnswerFlagged } =
    useResetAnswerFlagged(onSectionMutated);
  const { mutate: setAnswerMarkedAsAi } =
    useSetAnswerMarkedAsAI(onSectionMutated);
  const { mutate: resetAnswerMarkedAsAi } =
    useResetAnswerMarkedAsAi(onSectionMutated);
  const { isPending: setExpertVoteLoading, mutate: setExpertVote } =
    useSetExpertVote(onSectionMutated);
  const { mutate: removeAnswer } = useRemoveAnswer(onSectionMutated);
  const answerId = section?.oid;
  const { isPending: updating, mutate: update } = useSetAnswer({
    mutation: {
      onSuccess: ({ value }) => {
        setEditing(false);
        onSectionChanged?.(value);
        if (answer === undefined && onDelete) onDelete();
        saveDraftToStorage(answerId, "", true);
      },
    },
  });
  const { isAdmin, isExpert, username } = useUser()!;
  const [removeConfirm, modals] = useRemoveConfirm();
  const [editing, setEditing] = useState(false);

  const [draftText, setDraftText] = useState("");
  const [undoStack, setUndoStack] = useState<UndoStack>({ prev: [], next: [] });
  const { deferredImageHandler, flushPendingImages, pendingObjectUrls } =
    usePendingImages();
  const startEdit = useCallback(() => {
    const possibleAnswer = readDraftFromStorage(answerId, true);
    if (possibleAnswer) {
      setDraftText(possibleAnswer);
    } else {
      setDraftText(answer?.text ?? "");
    }

    setEditing(true);
  }, [answer]);
  const onCancel = useCallback(() => {
    setEditing(false);
    if (answer === undefined && onDelete) onDelete();
    saveDraftToStorage(answerId, "", true);
  }, [onDelete, answer]);
  const save = useCallback(async () => {
    if (!section) return;
    const finalText = await flushPendingImages(draftText);
    update({ oid: section.oid, data: { text: finalText, kind: answerKind } });
  }, [section, draftText, update, answerKind, flushPendingImages]);
  const remove = useCallback(() => {
    if (answer)
      removeConfirm("Remove answer?", () => removeAnswer({ oid: answer.oid }));
  }, [removeConfirm, removeAnswer, answer]);
  const [hasCommentDraft, setHasCommentDraft] = useState(false);
  const languages = useOfficialSolutionLanguage();

  const isDraft = !answer;

  useEffect(() => {
    clearExpiredDrafts();
    setDraftText(readDraftFromStorage(answerId, true));
  }, []);

  const flaggedLoading = setFlaggedLoading || resetFlaggedLoading;
  const canEdit = section && onSectionChanged && answer?.canEdit;
  const canRemove = section && onSectionChanged && (isAdmin || answer?.canEdit);
  const isOwnAnswer = answer?.isAuthor ?? false;
  return (
    <>
      {modals}
      <Card
        mb="md"
        shadow="md"
        id={hasId ? answer?.longId : undefined}
        classNames={{
          root: clsx(
            classes.answerWrapperStyle,
            answerKind === AnswerKind.official &&
              classes.answerWrapperOfficialAnswer,
          ),
          section: classes.answerSectionStyle,
        }}
      >
        <Card.Section px="md" py="md" withBorder>
          <Flex justify="space-between" align="center">
            <div>
              {!hasId && (
                <Tooltip label="View Answer in Exam">
                  <Link
                    to={
                      answer ? `/exams/${answer.filename}#${answer.longId}` : ""
                    }
                  >
                    <Text mr={8} component="span">
                      <IconArrowLeft
                        style={{ marginBottom: "3px", verticalAlign: "middle" }}
                      />
                      <IconFileText
                        style={{ marginBottom: "3px", verticalAlign: "middle" }}
                      />
                    </Text>
                  </Link>
                </Tooltip>
              )}
              {answerKind != AnswerKind.personal ? (
                answerKind == AnswerKind.legacy ? (
                  isDraft ? (
                    "Legacy (Draft)"
                  ) : (
                    "Legacy Answer"
                  )
                ) : isDraft ? (
                  "Official (Draft)"
                ) : (
                  "Official Answer"
                )
              ) : (
                <Anchor
                  component={Link}
                  to={`/user/${answer?.author?.username ?? username}`}
                >
                  <Text fw={700} component="span">
                    {answer?.author?.display_name ?? "(Draft)"}
                  </Text>
                  <Text ml="0.3em" c="dimmed" component="span">
                    @{answer?.author?.username ?? username}
                  </Text>
                </Anchor>
              )}
              <Text c="dimmed" mx={6} component="span">
                ·
              </Text>
              {answer && <TimeText time={answer.time} suffix="ago" />}
              {answer &&
                differenceInSeconds(
                  new Date(answer.edittime),
                  new Date(answer.time),
                ) > 1 && (
                  <>
                    <Text c="dimmed" mx={6} component="span">
                      ·
                    </Text>
                    <TimeText
                      time={answer.edittime}
                      prefix="edited"
                      suffix="ago"
                    />
                  </>
                )}
              {answer && <MarkedAsAiBadge count={answer.markedAsAiCount} />}
            </div>
            <Flex>
              <AnswerToolbar>
                {answer &&
                  (answer.expertVotes > 0 ||
                    setExpertVoteLoading ||
                    isExpert) && (
                    <Paper shadow="xs">
                      <Button.Group>
                        <TooltipButton
                          px={12}
                          tooltip="This answer is endorsed by an expert"
                          variant="filled"
                          color="yellow"
                        >
                          <IconStarFilled />
                        </TooltipButton>
                        <TooltipButton
                          miw={30}
                          tooltip={`${answer.expertVotes} experts endorse this answer.`}
                          loading={setExpertVoteLoading}
                        >
                          {answer.expertVotes}
                        </TooltipButton>
                        {isExpert && (
                          <TooltipButton
                            size="sm"
                            px={8}
                            tooltip={
                              answer.isExpertVoted
                                ? "Remove expert vote"
                                : "Add expert vote"
                            }
                            style={{ borderLeftWidth: 0 }}
                            onClick={() =>
                              setExpertVote({
                                oid: answer.oid,
                                data: { vote: !answer.isExpertVoted },
                              })
                            }
                          >
                            {answer.isExpertVoted ? (
                              <IconChevronDown />
                            ) : (
                              <IconChevronUp />
                            )}
                          </TooltipButton>
                        )}
                      </Button.Group>
                    </Paper>
                  )}
                {answer && (
                  <FlaggedBadge
                    count={answer.flaggedCount}
                    isFlagged={answer.isFlagged}
                    loading={flaggedLoading}
                    onToggle={
                      isOwnAnswer
                        ? undefined
                        : () =>
                            setAnswerFlagged({
                              oid: answer.oid,
                              data: { flagged: !answer.isFlagged },
                            })
                    }
                  />
                )}
                {answer && onSectionChanged && (
                  <Score
                    oid={answer.oid}
                    upvotes={answer.upvotes}
                    userVote={
                      answer.isUpvoted ? 1 : answer.isDownvoted ? -1 : 0
                    }
                    onSectionChanged={onSectionChanged}
                  />
                )}
              </AnswerToolbar>
            </Flex>
          </Flex>
        </Card.Section>
        {editing || answer === undefined ? (
          <Card.Section>
            <Box p="md">
              <Suspense fallback={<Loader />}>
                <Editor
                  value={draftText}
                  onChange={newValue => {
                    setDraftText(newValue);
                    saveDraftToStorage(answerId, newValue, true);
                  }}
                  imageHandler={deferredImageHandler}
                  preview={value => (
                    <MarkdownText
                      value={value}
                      languages={languages}
                      pendingImages={pendingObjectUrls}
                    />
                  )}
                  undoStack={undoStack}
                  setUndoStack={setUndoStack}
                />
                <Text mt="xs" c="dimmed">
                  Your answer will be licensed as{" "}
                  <Anchor
                    c="blue"
                    href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
                    target="_blank"
                  >
                    CC BY-NC-SA 4.0
                  </Anchor>
                  .
                </Text>
              </Suspense>
            </Box>
          </Card.Section>
        ) : (
          <Card.Section>
            <Box p="md">
              {viewSource ? (
                <CodeBlock value={answer?.text ?? ""} language="markdown" />
              ) : (
                <MarkdownText
                  value={answer?.text ?? ""}
                  languages={languages}
                />
              )}
            </Box>
          </Card.Section>
        )}
        <Group justify="right">
          {(answer === undefined || editing) && (
            <>
              <Button
                size="sm"
                color="red"
                variant="subtle"
                onClick={onCancel}
                leftSection={<IconPencilCancel />}
              >
                {editing ? "Cancel" : "Delete Draft"}
              </Button>
              <Button
                size="sm"
                onClick={save}
                loading={updating}
                disabled={draftText.trim().length === 0}
                leftSection={<IconDeviceFloppy />}
              >
                Save
              </Button>
            </>
          )}
          {onSectionChanged && !editing && answer !== undefined && (
            <Button.Group>
              <Button
                size="sm"
                onClick={() => setHasCommentDraft(true)}
                leftSection={<IconMessageCirclePlus />}
                disabled={hasCommentDraft}
              >
                Add Comment
              </Button>
              <Menu withinPortal>
                <Menu.Target>
                  <Button leftSection={<IconDots />}>More</Button>
                </Menu.Target>
                <Menu.Dropdown>
                  {!isOwnAnswer && (
                    <>
                      {!answer.isMarkedAsAi ? (
                        <Menu.Item
                          leftSection={<IconRobot />}
                          onClick={() =>
                            setAnswerMarkedAsAi({
                              oid: answer.oid,
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
                            setAnswerMarkedAsAi({
                              oid: answer.oid,
                              data: { markedAsAi: false },
                            })
                          }
                        >
                          Remove AI-generated mark
                        </Menu.Item>
                      )}
                      {answer.flaggedCount === 0 && (
                        <Menu.Item
                          leftSection={<IconFlag />}
                          onClick={() =>
                            setAnswerFlagged({
                              oid: answer.oid,
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
                    leftSection={<IconLink />}
                    onClick={() =>
                      copy(
                        `${document.location.origin}/exams/${answer.filename}?answer=${answer.longId}`,
                      )
                    }
                  >
                    Copy Permalink
                  </Menu.Item>
                  {isAdmin && (
                    <>
                      {answer.markedAsAiCount > 0 && (
                        <Menu.Item
                          leftSection={<IconRobotOff />}
                          onClick={() =>
                            resetAnswerMarkedAsAi({ oid: answer.oid })
                          }
                        >
                          Remove all AI-generated marks
                        </Menu.Item>
                      )}
                      {answer.flaggedCount > 0 && (
                        <Menu.Item
                          leftSection={<IconFlag />}
                          onClick={() =>
                            resetAnswerFlagged({ oid: answer.oid })
                          }
                        >
                          Remove all inappropriate flags
                        </Menu.Item>
                      )}
                    </>
                  )}
                  {!editing && canEdit && (
                    <Menu.Item leftSection={<IconEdit />} onClick={startEdit}>
                      Edit
                    </Menu.Item>
                  )}
                  {answer && canRemove && (
                    <Menu.Item leftSection={<IconTrash />} onClick={remove}>
                      Delete
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
            </Button.Group>
          )}
        </Group>

        {answer &&
          onSectionChanged &&
          (hasCommentDraft || answer.comments.length > 0) && (
            <CommentSectionComponent
              hasDraft={hasCommentDraft}
              answer={answer}
              onSectionChanged={onSectionChanged}
              onChainReply={() => setHasCommentDraft(true)}
              onDraftDelete={() => setHasCommentDraft(false)}
            />
          )}
      </Card>
    </>
  );
};

export default AnswerComponent;
