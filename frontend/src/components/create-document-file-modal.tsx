import {
  Alert,
  Button,
  FileButton,
  Stack,
  Text,
  ActionIcon,
  Group,
  Paper,
} from "@mantine/core";
import * as React from "react";
import { useState, useRef } from "react";
import { IconCloudUpload, IconX, IconFile } from "@tabler/icons-react";
import { useCreateDocumentFile } from "../api/hooks/documents";
import type { DocumentSchema } from "../api/model/documentSchema";
import classes from "./create-document-file-modal.module.css";
interface Props {
  document: DocumentSchema;
  onClose: () => void;
  refetch: () => void;
}

const CreateDocumentFileModal: React.FC<Props> = ({
  onClose,
  document,
  refetch,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // added to clear browser input when a file is deleted from the pending list
  const resetFileInput = useRef<(() => void) | null>(null);

  const { mutateAsync, isError, error } = useCreateDocumentFile<
    string | Error
  >();

  function handleFilesSelected(selectedFiles: File[]): void {
    setFiles(prevFiles => [...prevFiles, ...selectedFiles]);
    resetFileInput.current?.();
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    event.stopPropagation();

    if (isUploading) {
      return;
    }

    const droppedFiles = Array.from(event.dataTransfer.files);

    if (droppedFiles.length === 0) {
      return;
    }

    handleFilesSelected(droppedFiles);
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    event.stopPropagation();

    event.dataTransfer.dropEffect = isUploading ? "none" : "copy";
  }

  function handleRemoveFile(indexToRemove: number): void {
    if (isUploading) {
      return;
    }
    setFiles(previousFiles =>
      previousFiles.filter((_, index) => index !== indexToRemove),
    );
  }

  async function handleUpload(): Promise<void> {
    if (files.length === 0 || isUploading) {
      return;
    }

    setIsUploading(true);
    let uploadedCount = 0;

    try {
      // reversing the array to optimize filtering state at every iteration, state updates when the upload finishes
      const fileQueue = [...files].reverse();
      while (fileQueue.length > 0) {
        const curFile = fileQueue.pop();

        if (curFile === undefined) {
          break;
        }

        await mutateAsync({
          username: document.author.username,
          slug: document.slug,
          data: {
            display_name: curFile.name,
            file: curFile,
          },
        });

        uploadedCount += 1;
      }

      onClose();
    } catch {
      // The existing Alert displays the mutation error.
    } finally {
      if (uploadedCount > 0) {
        setFiles(previousFiles => previousFiles.slice(uploadedCount));
      }
      refetch();
      setIsUploading(false);
    }
  }

  return (
    <>
      <Stack onDragOver={handleDragOver} onDrop={handleDrop}>
        {isError && (
          <Alert color="red">
            {" "}
            {error instanceof Error ? error.message : error}{" "}
          </Alert>
        )}
        <FileButton
          multiple
          resetRef={resetFileInput}
          disabled={isUploading}
          onChange={handleFilesSelected}
        >
          {buttonProps => (
            <Button
              {...buttonProps}
              disabled={isUploading}
              leftSection={<IconFile size={18} />}
            >
              Choose files
            </Button>
          )}
        </FileButton>

        {files.length === 0 && (
          <Paper className={classes.dropZone} p="md" radius="md">
            <IconCloudUpload size={40} stroke={1.5} aria-hidden="true" />
            <Text size="sm" ta="center">
              Drop files here, or use Choose files.
            </Text>
          </Paper>
        )}
        {files.length !== 0 && (
          <Text size="xs" c="dimmed">
            Drop more files into this dialog, or use Choose files.
          </Text>
        )}
        {files.length > 0 && (
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Selected files: {files.length}
            </Text>

            {files.map((file, index) => (
              <Group key={`${file.name}-${index}`} gap="xs" wrap="nowrap">
                <Text
                  size="sm"
                  truncate="end"
                  flex={1}
                  miw={0}
                  title={file.name}
                >
                  {file.name}
                </Text>

                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  aria-label={`Remove ${file.name} from the pending list`}
                  disabled={isUploading}
                  onClick={() => handleRemoveFile(index)}
                >
                  <IconX size={16} />
                </ActionIcon>
              </Group>
            ))}
          </Stack>
        )}
        <Button
          loading={isUploading}
          leftSection={<IconCloudUpload />}
          disabled={isUploading || files.length === 0}
          onClick={() => {
            void handleUpload();
          }}
        >
          Upload
        </Button>
      </Stack>
    </>
  );
};

export default CreateDocumentFileModal;
