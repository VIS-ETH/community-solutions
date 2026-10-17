import { Alert, Button, Stack, TextInput, Popover, Text } from "@mantine/core";
import * as React from "react";
import { useState } from "react";
import { IconPlus } from "@tabler/icons-react";
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
  const [namePopoverIsOpen, setNamePopoverIsOpen] = useState(false);
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
    setNamePopoverIsOpen(false);
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
      <Popover
        opened={namePopoverIsOpen}
        onChange={setNamePopoverIsOpen}
        position="bottom"
        withArrow
      >
        <Popover.Target>
          <Button
            leftSection={<IconPlus />}
            onClick={() => setNamePopoverIsOpen(true)}
            disabled={isCreating}
          >
            Add File
          </Button>
        </Popover.Target>

        <Popover.Dropdown>
          <Stack gap="sm">
            <TextInput
              label="File name"
              placeholder="Please enter a file name..."
              value={displayName}
              onChange={event => setDisplayName(event.currentTarget.value)}
            />

            <Button
              disabled={isCreating || displayName.trim() === ""}
              onClick={handleAddFile}
            >
              Add
            </Button>
          </Stack>
        </Popover.Dropdown>
      </Popover>

      {files.length > 0 && (
        <Stack gap="xs">
          <Text size="sm" fw={500}>
            Files to create: {files.length}
          </Text>

          {files.map((file, index) => (
            <Text key={`${file.name}-${index}`} size="sm" truncate="end">
              {file.name}
            </Text>
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
        {files.length === 1 ? "Create File" : "Create Files"}
      </Button>
    </Stack>
  );
};

export default CreateMarkdownFileModal;
