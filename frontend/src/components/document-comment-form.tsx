import { Flex } from "@mantine/core";
import React, { useState, useEffect } from "react";
import { imageHandler } from "../api/fetch-utils";
import { Mutate, useCreateDocumentComment } from "../api/hooks";
import { Document } from "../interfaces";
import Editor from "./Editor";
import { UndoStack } from "./Editor/utils/undo-stack";
import MarkdownText from "./markdown-text";
import TooltipButton from "./TooltipButton";

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
  const localStorageKey = documentSlug + "_comment";
  const [draftText, setDraftText] = useState(() => {
    console.log("Ran state");
    const cachedDraftText = localStorage.getItem(localStorageKey);
    return cachedDraftText ? JSON.parse(cachedDraftText) : "";
  });

  // Retrieve cached draftText on first render, if present
  {
    /*useEffect(() => {
      console.log("Retrieval ran");
    const cachedDraftText = JSON.parse(localStorage.getItem(documentSlug + "_comment"));
        if (cachedDraftText) {
            setDraftText(cachedDraftText);
        }
    }, []);*/
  }

  // Cache draftText on change
  useEffect(() => {
    console.log("Caching ran");
    if (draftText != "") {
      localStorage.setItem(localStorageKey, JSON.stringify(draftText));
    } else {
      localStorage.removeItem(localStorageKey);
    }
  }, [draftText]);

  const [undoStack, setUndoStack] = useState<UndoStack>({
    prev: [],
    next: [],
  });
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
      window.localStorage.removeItem(documentSlug + "_comment"); // Clear draft cache
    },
  );

  return (
    <div>
      <Editor
        value={draftText}
        onChange={setDraftText}
        imageHandler={imageHandler}
        preview={value => <MarkdownText value={value} />}
        undoStack={undoStack}
        setUndoStack={setUndoStack}
      />
      <Flex justify="end" mt="xs">
        <TooltipButton
          size="md"
          tooltip="Submit comment"
          disabled={loading || draftText.length === 0}
          onClick={() => createDocumentComment(draftText)}
        >
          Submit
        </TooltipButton>
      </Flex>
    </div>
  );
};

export default DocumentCommentForm;
