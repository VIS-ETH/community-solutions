import { Flex, Loader } from "@mantine/core";
import React, { lazy, Suspense, useState } from "react";
import { usePendingImages } from "./Editor/pending-images";
import { Mutate, useCreateDocumentComment } from "../api/hooks";
import { Document } from "../interfaces";
import { UndoStack } from "./Editor/utils/undo-stack";
import MarkdownText from "./markdown-text";
import TooltipButton from "./TooltipButton";

const Editor = lazy(() => import("./Editor"));

interface Props {
  documentAuthor: string;
  documentSlug: string;
  mutate: Mutate<Document>;
}
const DocumentCommentForm: React.FC<Props> = ({
  documentAuthor,
  documentSlug,
  mutate,
}) => {
  const [draftText, setDraftText] = useState("");
  const [undoStack, setUndoStack] = useState<UndoStack>({
    prev: [],
    next: [],
  });
  const { deferredImageHandler, flushPendingImages, pendingObjectUrls } = usePendingImages();
  const [loading, createDocumentComment] = useCreateDocumentComment(
    documentAuthor,
    documentSlug,
    document => {
      mutate(data => ({ ...data, comments: [...data.comments, document] }));
      setDraftText("");
      setUndoStack({
        prev: [],
        next: [],
      });
    },
  );

  return (
    <Suspense fallback={<Loader />}>
      <Editor
        value={draftText}
        onChange={setDraftText}
        imageHandler={deferredImageHandler}
        preview={value => <MarkdownText value={value} pendingImages={pendingObjectUrls} />}
        undoStack={undoStack}
        setUndoStack={setUndoStack}
      />
      <Flex justify="end" mt="xs">
        <TooltipButton
          size="md"
          tooltip="Submit comment"
          disabled={loading || draftText.length === 0}
          onClick={async () => createDocumentComment(await flushPendingImages(draftText))}
        >
          Submit
        </TooltipButton>
      </Flex>
    </Suspense>
  );
};

export default DocumentCommentForm;
