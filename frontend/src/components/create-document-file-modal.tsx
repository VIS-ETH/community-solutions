import {
  Alert,
  Button,
  FileButton,
  Stack,
  Text,
  ActionIcon,
  Group,
} from "@mantine/core";
import * as React from "react";
import { useState } from "react";
import { IconCloudUpload, IconX } from "@tabler/icons-react";
import { useCreateDocumentFile } from "../api/hooks/documents";
import type { DocumentSchema } from "../api/model/documentSchema";

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

  const { mutateAsync, isError, error } = useCreateDocumentFile<
    string | Error
  >();

  function handleFilesSelected(selectedFiles: File[]): void {
    setFiles(prevFiles => [...prevFiles, ...selectedFiles]);
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
      <Stack>
        {isError && (
          <Alert color="red">
            {" "}
            {error instanceof Error ? error.message : error}{" "}
          </Alert>
        )}
        <FileButton
          multiple
          disabled={isUploading}
          onChange={handleFilesSelected}
        >
          {buttonProps => (
            <Button
              {...buttonProps}
              disabled={isUploading}
              leftSection={<IconCloudUpload />}
            >
              Choose files
            </Button>
          )}
        </FileButton>
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
