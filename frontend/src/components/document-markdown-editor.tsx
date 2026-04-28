import { Button, Loader } from "@mantine/core";
import { useRequest } from "ahooks";
import React, { lazy, Suspense, useState } from "react";
import { imageHandler, NamedBlob } from "../api/fetch-utils";
import { useUpdateDocumentFile } from "../api/hooks";
import { Document, DocumentFile } from "../interfaces";
import { UndoStack } from "./Editor/utils/undo-stack";
import MarkdownText from "./markdown-text";
import { IconDeviceFloppy } from "@tabler/icons-react";

const Editor = lazy(() => import("./Editor"));

interface Props {
  document: Document;
  file: DocumentFile;
  url: string;
}
const DocumentMarkdownEditor: React.FC<Props> = ({ document, file, url }) => {
  const [draftText, setDraftText] = useState("");
  useRequest(() => fetch(url).then(r => r.text()), {
    onSuccess: text => setDraftText(text),
  });
  const [loading, updateDocument] = useUpdateDocumentFile(
    document.author,
    document.slug,
    file.oid,
  );
  const [undoStack, setUndoStack] = useState<UndoStack>({
    prev: [],
    next: [],
  });
  return (
    <Suspense fallback={<Loader />}>
      <Editor
        value={draftText}
        onChange={setDraftText}
        imageHandler={imageHandler}
        preview={value => <MarkdownText value={value} />}
        undoStack={undoStack}
        setUndoStack={setUndoStack}
      />
      <Button
        onClick={() =>
          updateDocument({
            file: new NamedBlob(new Blob([draftText]), "file.md"),
          })
        }
        loading={loading}
        leftSection={<IconDeviceFloppy />}
      >
        Save
      </Button>
    </Suspense>
  );
};

export default DocumentMarkdownEditor;
