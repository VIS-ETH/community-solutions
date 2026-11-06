import {
  Alert,
  Button,
  Stack,
  TextInput,
  Text,
  ActionIcon,
  Group,
} from "@mantine/core";
import * as React from "react";
import { useState } from "react";
import { IconPlus, IconX } from "@tabler/icons-react";
import { useCreateDocumentFile } from "../api/hooks/documents";
import type { DocumentSchema } from "../api/model/documentSchema";

interface Props {
  document: DocumentSchema;
  onClose: () => void;
  refetch: () => void;
}

const CreateMarkdownFileModal: React.FC<Props> = ({
  document,
  onClose,
  refetch,
}) => {
  const [displayName, setDisplayName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const { mutateAsync, isError, error } = useCreateDocumentFile<
    string | Error
  >();

  function handleAddFile(): void {
    const name = displayName.trim();

    if (name === "") {
      return;
    }

    const filename = name.toLowerCase().endsWith(".md") ? name : `${name}.md`;

    const newFile = new File([], filename, {
      type: "text/markdown",
    });

    setFiles(previousFiles => [...previousFiles, newFile]);
    setDisplayName("");
  }

  function handleRemoveFile(indexToRemove: number): void {
    if (isCreating) {
      return;
    }
    setFiles(previousFiles =>
      previousFiles.filter((_, index) => index !== indexToRemove),
    );
  }

  async function handleCreate(): Promise<void> {
    if (files.length === 0 || isCreating) {
      return;
    }

    setIsCreating(true);
    let createdCount = 0;

    try {
      // Reverse a copy so popping processes files in their original order.
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

        createdCount += 1;
      }

      onClose();
    } catch {
      // The existing Alert displays the mutation error.
    } finally {
      if (createdCount > 0) {
        setFiles(previousFiles => previousFiles.slice(createdCount));
      }
      refetch();
      setIsCreating(false);
    }
  }

  return (
    <Stack>
      {isError && (
        <Alert color="red">
          {" "}
          {error instanceof Error ? error.message : error}{" "}
        </Alert>
      )}
      <Group align="flex-end" wrap="nowrap">
        <TextInput
          flex={1}
          label="File name"
          placeholder="Please enter a file name..."
          value={displayName}
          disabled={isCreating}
          onChange={event => setDisplayName(event.currentTarget.value)}
        />

        <Button
          disabled={isCreating || displayName.trim() === ""}
          onClick={handleAddFile}
          leftSection={<IconPlus />}
        >
          Add
        </Button>
      </Group>

      {files.length > 0 && (
        <Stack gap="xs">
          <Text size="sm" fw={500}>
            Files to create: {files.length}
          </Text>

          {files.map((file, index) => (
            <Group key={`${file.name}-${index}`} gap="xs" wrap="nowrap">
              <Text size="sm" truncate="end" flex={1} miw={0} title={file.name}>
                {file.name}
              </Text>

              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label={`Remove ${file.name} from the pending list`}
                disabled={isCreating}
                onClick={() => handleRemoveFile(index)}
              >
                <IconX size={16} />
              </ActionIcon>
            </Group>
          ))}
        </Stack>
      )}

      <Button
        loading={isCreating}
        leftSection={<IconPlus />}
        disabled={isCreating || files.length === 0}
        onClick={() => {
          void handleCreate();
        }}
      >
        {files.length >= 2 ? "Create Files" : "Create File"}
      </Button>
    </Stack>
  );
};

export default CreateMarkdownFileModal;
