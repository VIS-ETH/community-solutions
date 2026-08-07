import { differenceInSeconds } from "date-fns";
import React, { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  useAddComment,
  useRemoveComment,
  useResetCommentFlagged,
  useResetCommentMarkedAsAi,
  useSetCommentFlagged,
  useSetCommentMarkedAsAi,
  useUpdateComment,
} from "../api/hooks/answers";
import { AnswerSchema, AnswerSectionSchema, CommentSchema } from "../api/model";
import { usePendingImages } from "./Editor/pending-images";
import { useUser } from "../auth";
import useRemoveConfirm from "../hooks/useRemoveConfirm";
import { UndoStack } from "./Editor/utils/undo-stack";
import CodeBlock from "./code-block";
import MarkdownText from "./markdown-text";
import { useOfficialSolutionLanguage } from "./official-solution";
import {
  Anchor,
  Button,
  Flex,
  Group,
  Loader,
  Menu,
  Paper,
  Text,
} from "@mantine/core";
import {
  IconCode,
  IconDeviceFloppy,
  IconDots,
  IconEdit,
  IconFlag,
  IconLink,
  IconPencilCancel,
  IconRobot,
  IconRobotOff,
  IconTrash,
} from "@tabler/icons-react";
import FlaggedBadge from "./FlaggedBadge";
import MarkedAsAiBadge from "./MarkedAsAiBadge";
import { useDisclosure } from "@mantine/hooks";
import TimeText from "./time-text";
import { copy } from "../utils/clipboard";
import { saveDraftToStorage, readDraftFromStorage } from "../utils/drafts";

const Editor = lazy(() => import("./Editor"));

interface Props {
  answer: AnswerSchema;
  comment?: CommentSchema;
  onSectionChanged: (newSection: AnswerSectionSchema) => void;
  onDelete?: () => void;
}
const CommentComponent: React.FC<Props> = ({
  answer,
  comment,
  onSectionChanged,
  onDelete,
}) => {
  const draftKey = comment?.oid ?? answer.oid;

  const onSectionMutated = {
    mutation: {
      onSuccess: ({ value }: { value: AnswerSectionSchema }) =>
        onSectionChanged(value),
    },
  };
  const { isPending: setFlaggedLoading, mutate: setExamCommentFlagged } =
    useSetCommentFlagged(onSectionMutated);
  const { isPending: resetFlaggedLoading, mutate: resetExamCommentFlagged } =
    useResetCommentFlagged(onSectionMutated);
  const { mutate: setExamCommentMarkedAsAi } =
    useSetCommentMarkedAsAi(onSectionMutated);
  const { mutate: resetExamCommentMarkedAsAi } =
    useResetCommentMarkedAsAi(onSectionMutated);
  const [viewSource, { toggle: toggleViewSource }] = useDisclosure();
  const { isAdmin, username } = useUser()!;
  const [removeConfirm, modals] = useRemoveConfirm();
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(() =>
    readDraftFromStorage(draftKey, false),
  );
  const [undoStack, setUndoStack] = useState<UndoStack>({ prev: [], next: [] });
  const { deferredImageHandler, flushPendingImages, pendingObjectUrls } =
    usePendingImages();
  const { isPending: addNewLoading, mutate: runAddNewComment } = useAddComment({
    mutation: {
      onSuccess: ({ value }) => {
        if (onDelete) onDelete();
        onSectionChanged(value);
        saveDraftToStorage(draftKey, "", false);
      },
    },
  });
  const { isPending: updateLoading, mutate: runUpdateComment } =
    useUpdateComment({
      mutation: {
        onSuccess: ({ value }) => {
          setEditing(false);
          onSectionChanged(value);
          saveDraftToStorage(draftKey, "", false);
        },
      },
    });
  const { isPending: removeLoading, mutate: runRemoveComment } =
    useRemoveComment(onSectionMutated);
  const loading = addNewLoading || updateLoading || removeLoading;
  const languages = useOfficialSolutionLanguage();

  useEffect(() => {
    // On first render it is already set as a default value.
    // This only reruns if the comment id changes
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftText(readDraftFromStorage(draftKey, false));
  }, [draftKey, setDraftText]);

  const onSave = async () => {
    const finalText = await flushPendingImages(draftText);
    if (comment === undefined) {
      runAddNewComment({ oid: answer.oid, data: { text: finalText } });
    } else {
      runUpdateComment({ oid: comment.oid, data: { text: finalText } });
    }
  };
  const onCancel = () => {
    saveDraftToStorage(draftKey, "", false);
    if (comment === undefined) {
      if (onDelete) onDelete();
    } else {
      setEditing(false);
    }
  };
  const startEditing = () => {
    if (comment === undefined) return;
    setDraftText(readDraftFromStorage(comment.oid, false) || comment.text);
    setEditing(true);
  };
  const remove = () => {
    if (comment)
      removeConfirm("Remove comment?", () => {
        runRemoveComment({ oid: comment.oid });
        saveDraftToStorage(draftKey, "", false);
      });
  };
  const flaggedLoading = setFlaggedLoading || resetFlaggedLoading;
  const isOwnComment = comment?.author.username === username;

  return (
    <Paper
      radius={0}
      withBorder
      shadow="none"
      p="sm"
      style={{ marginBottom: "-1px" }}
      id={comment?.longId ?? ""}
    >
      {modals}
      <Flex justify="space-between">
        <div>
          <Anchor
            component={Link}
            to={`/user/${comment?.author.username ?? username}`}
          >
            <Text fw={700} component="span">
              {comment?.author.display_name ?? "(Draft)"}
            </Text>
            <Text ml="0.25em" c="dimmed" component="span">
              @{comment?.author.username ?? username}
            </Text>
          </Anchor>
          <Text component="span" mx={6} c="dimmed">
            ·
          </Text>
          {comment && <TimeText time={comment.time} suffix="ago" />}
          {comment &&
            differenceInSeconds(
              new Date(comment.edittime),
              new Date(comment.time),
            ) > 1 && (
              <>
                <Text component="span" mx={6} c="dimmed">
                  ·
                </Text>
                <TimeText
                  time={comment.edittime}
                  prefix="edited"
                  suffix="ago"
                />
              </>
            )}
          {comment && <MarkedAsAiBadge count={comment.markedAsAiCount} />}
        </div>
        <Flex>
          {comment && (
            <FlaggedBadge
              count={comment.flaggedCount}
              isFlagged={comment.isFlagged}
              loading={flaggedLoading}
              size="xs"
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
                  leftSection={<IconLink />}
                  onClick={() =>
                    copy(
                      `${document.location.origin}/exams/${answer.filename}?comment=${comment.longId}&answer=${answer.longId}`,
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
                {!editing && comment.canEdit && (
                  <Menu.Item leftSection={<IconEdit />} onClick={startEditing}>
                    Edit
                  </Menu.Item>
                )}
                {comment && (comment.canEdit || isAdmin) && (
                  <Menu.Item leftSection={<IconTrash />} onClick={remove}>
                    Delete
                  </Menu.Item>
                )}
                {!editing && !comment.canEdit && (
                  <Menu.Item
                    leftSection={<IconCode />}
                    onClick={toggleViewSource}
                  >
                    Toggle Source Code Mode
                  </Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>
          )}
        </Flex>
      </Flex>
      {comment === undefined || editing ? (
        <Suspense fallback={<Loader />}>
          <Editor
            value={draftText}
            onChange={newValue => {
              setDraftText(newValue);
              saveDraftToStorage(draftKey, newValue, false);
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
          <Group justify="flex-end" mt="sm">
            <Button
              size="sm"
              color="red"
              variant="subtle"
              onClick={onCancel}
              leftSection={<IconPencilCancel />}
            >
              {comment === undefined ? "Delete Draft" : "Cancel"}
            </Button>
            <Button
              size="sm"
              loading={loading}
              disabled={draftText.trim().length === 0}
              onClick={onSave}
              leftSection={<IconDeviceFloppy />}
            >
              Save
            </Button>
          </Group>
        </Suspense>
      ) : (
        <div>
          {viewSource ? (
            <CodeBlock value={comment.text} language="markdown" />
          ) : (
            <MarkdownText value={comment.text} languages={languages} />
          )}
        </div>
      )}
    </Paper>
  );
};

export default CommentComponent;
