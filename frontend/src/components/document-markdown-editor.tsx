import { Button } from "@mantine/core";
import { useRequest } from "ahooks";
import React, { useState } from "react";
import { NamedBlob } from "../api/fetch-utils";
import { usePendingImages } from "./Editor/pending-images";
import { useUpdateDocumentFile } from "../api/hooks";
import { Document, DocumentFile } from "../interfaces";
import Editor from "./Editor";
import { UndoStack } from "./Editor/utils/undo-stack";
import MarkdownText from "./markdown-text";
import { IconDeviceFloppy } from "@tabler/icons-react";

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
  const { deferredImageHandler, flushPendingImages, pendingObjectUrls } = usePendingImages();
  return (
    <div>
      <div>
        <Editor
          value={draftText}
          onChange={setDraftText}
          imageHandler={deferredImageHandler}
          preview={value => <MarkdownText value={value} pendingImages={pendingObjectUrls} />}
          undoStack={undoStack}
          setUndoStack={setUndoStack}
        />
      </div>
      <div>
        <Button
          onClick={async () => {
            const finalText = await flushPendingImages(draftText);
            updateDocument({ file: new NamedBlob(new Blob([finalText]), "file.md") });
          }}
          loading={loading}
          leftSection={<IconDeviceFloppy />}
        >
          Save
        </Button>
      </div>
    </div>
  );
};

export default DocumentMarkdownEditor;
