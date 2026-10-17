import { Alert, Button, FileButton, Stack, Text } from "@mantine/core";
import * as React from "react";
import { useState } from "react";
import { IconCloudUpload } from "@tabler/icons-react";
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

  const { mutateAsync, isError, error } = useCreateDocumentFile();

  function handleFilesSelected(selectedFiles: File[]): void {
    setFiles(prevFiles => [...prevFiles, ...selectedFiles]);
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
        {isError && <Alert color="red">{error as unknown as string}</Alert>}
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
              Selected files ({files.length})
            </Text>

            {files.map((file, index) => (
              <Text key={`${file.name}-${index}`} size="sm" truncate="end">
                {file.name}
              </Text>
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
