import {
  Badge,
  Button,
  Card,
  Flex,
  Grid,
  Group,
  Modal,
  TextInput,
  Title,
  Alert,
  Paper,
  Text,
  ActionIcon,
  FileButton,
  Stack,
} from "@mantine/core";
import React, { useCallback, useState, useRef } from "react";
import IconButton from "./icon-button";
import {
  IconChevronDown,
  IconChevronUp,
  IconDeviceFloppy,
  IconEdit,
  IconKey,
  IconTrash,
  IconFile,
  IconX,
} from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import {
  useDeleteDocumentFile,
  useMoveDocumentFile,
  useUpdateDocumentFile,
} from "../api/hooks/documents";
import type { DocumentSchema } from "../api/model/documentSchema";
import type { DocumentFileSchema } from "../api/model/documentFileSchema";
import classes from "./document-file-item.module.css";
import uploadClasses from "./create-document-file-modal.module.css";
interface Props {
  max_order: number;
  document: DocumentSchema;
  file: DocumentFileSchema;
  refetch: () => void;
}

const DocumentFileItem: React.FC<Props> = ({
  max_order,
  file,
  document,
  refetch,
}) => {
  const [displayName, setDisplayName] = useState<string | undefined>();
  const [replaceFile, setFile] = useState<File | undefined>(undefined);
  const [replacementError, setReplacementError] = useState<string | null>(null);

  const resetFileInput = useRef<(() => void) | null>(null);

  const moveFile = useMoveDocumentFile({
    mutation: {
      onSuccess() {
        refetch();
      },
    },
  });
  const handleMove = useCallback(
    (direction: "up" | "down") => {
      moveFile.mutate({
        filename: file.filename,
        slug: document.slug,
        username: document.author.username,
        data: {
          direction,
        },
      });
    },
    [file.filename, document.slug, document.author, moveFile],
  );

  const deleteDocumentFile = useDeleteDocumentFile({
    mutation: {
      onSuccess() {
        refetch();
      },
    },
  });
  const handleDeleteFile = useCallback(() => {
    deleteDocumentFile.mutate({
      username: document.author.username,
      slug: document.slug,
      id: file.oid,
    });
  }, [document.author, document.slug, file.oid, deleteDocumentFile]);

  const [editIsOpen, { toggle: toggleEditIsOpen, close: closeEditModal }] =
    useDisclosure();
  const [keyIsOpen, { toggle: toggleKeyIsOpen, close: closeKeyModal }] =
    useDisclosure();
  const [
    deleteModalIsOpen,
    { toggle: toggleDeleteModalIsOpen, close: closeDeleteModal },
  ] = useDisclosure();

  const updateDocumentFile = useUpdateDocumentFile({
    mutation: {
      onSuccess() {
        setDisplayName(undefined);
        setFile(undefined);

        refetch();

        closeEditModal();
        setReplacementError(null);
      },
    },
  });
  const handleUpdateFile = useCallback(
    (displayName: string | undefined, newFile: File | undefined) => {
      updateDocumentFile.mutate({
        username: document.author.username,
        slug: document.slug,
        id: file.oid,
        data: {
          display_name: displayName,
          file: newFile,
        },
      });
    },
    [document.author, document.slug, file.oid, updateDocumentFile],
  );

  function handleReplacementDrop(event: React.DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    event.stopPropagation();

    if (updateDocumentFile.isPending) {
      return;
    }

    const droppedFiles = Array.from(event.dataTransfer.files);

    if (droppedFiles.length === 0) {
      return;
    }

    if (droppedFiles.length !== 1) {
      setReplacementError(
        "Drop exactly one file to replace this document file.",
      );
      return;
    }

    // already checking array length === 1
    const replacement = droppedFiles[0];

    setFile(replacement);
    setReplacementError(null);
  }

  function handleReplacementDragOver(
    event: React.DragEvent<HTMLDivElement>,
  ): void {
    event.preventDefault();
    event.stopPropagation();

    event.dataTransfer.dropEffect = updateDocumentFile.isPending
      ? "none"
      : "copy";
  }

  function handleReplacementSelected(selectedFile: File | undefined): void {
    if (updateDocumentFile.isPending) {
      return;
    }

    setFile(selectedFile);
    resetFileInput.current?.();
    setReplacementError(null);
  }

  return (
    <>
      <Modal
        classNames={{ title: classes.modalTitle }}
        title={`Edit ${file.display_name}`}
        onClose={closeEditModal}
        opened={editIsOpen}
      >
        <Modal.Body>
          <Stack
            onDragOver={handleReplacementDragOver}
            onDrop={handleReplacementDrop}
          >
            <TextInput
              label="Display Name"
              value={displayName ?? file.display_name}
              onChange={e => setDisplayName(e.currentTarget.value)}
            />

            {replaceFile === undefined && (
              <Paper className={uploadClasses.dropZone}>
                <IconFile size={40} stroke={1.5} aria-hidden="true" />
                <Text className={classes.replacementDescription}>
                  Drop one replacement file here, or choose one
                </Text>
              </Paper>
            )}

            {replaceFile !== undefined && (
              <Group gap="xs" wrap="nowrap">
                <Text
                  size="sm"
                  truncate="end"
                  flex={1}
                  miw={0}
                  title={replaceFile.name}
                >
                  {replaceFile.name}
                </Text>

                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  aria-label={`Remove ${replaceFile.name} as the replacement`}
                  disabled={updateDocumentFile.isPending}
                  onClick={() => handleReplacementSelected(undefined)}
                >
                  <IconX size={16} />
                </ActionIcon>
              </Group>
            )}

            {replacementError && (
              <Alert color="red" className={classes.replacementError}>
                {replacementError}
              </Alert>
            )}

            <Group justify="space-between">
              <FileButton
                resetRef={resetFileInput}
                disabled={updateDocumentFile.isPending}
                onChange={selectedFile =>
                  handleReplacementSelected(selectedFile ?? undefined)
                }
              >
                {buttonProps => (
                  <Button
                    {...buttonProps}
                    disabled={updateDocumentFile.isPending}
                    leftSection={<IconFile size={18} />}
                  >
                    Choose files
                  </Button>
                )}
              </FileButton>

              <Button
                disabled={displayName?.trim() === ""}
                onClick={() =>
                  handleUpdateFile(displayName?.trim(), replaceFile)
                }
                leftSection={<IconDeviceFloppy />}
                loading={updateDocumentFile.isPending}
              >
                Save
              </Button>
            </Group>
          </Stack>
        </Modal.Body>
      </Modal>
      <Modal
        title="Access Token"
        onClose={closeKeyModal}
        opened={keyIsOpen}
        size="lg"
      >
        <Modal.Body>
          <p>
            Token: <code>{document.api_key}</code>
          </p>
          <p>
            This token can be used to replace any file of this document without
            needing to login manually. You could for example use it in a GitLab
            / Github CI script to update the files whenever you push changes to
            a git repository.
          </p>
          <p>
            The token is valid for an endpoint that can be found at{" "}
            <code>
              {
                "POST /api/document/<str:username>/<str:document_slug>/files/<int:id>/update/"
              }
            </code>
            . The token has to be supplied as an Authorization header, a
            replacement file can be sent as multipart-form upload with the key
            "file". The content type and filename of the new file are ignored,
            the extension and the filename won't change.
          </p>
          <p>
            The token shouldn't be made public - you should always store it in a
            secret and hand it over to scripts using an environment variable.
          </p>
          <p>
            With <code>curl</code> this file could be replaced with the
            following command assuming that the new file is located in the
            current working directory and named "my_document.pdf".
          </p>
          <pre>
            <code>
              {`curl ${location.origin}/api/document/${document.author.username}/${document.slug}/files/${file.oid}/update/ \\\n  -H "Authorization: ${document.api_key}" \\\n  -F "file=@my_document.pdf"`}
            </code>
          </pre>
        </Modal.Body>
      </Modal>
      <Modal
        title={`Do you really want to delete the file named ${file.display_name}?`}
        onClose={closeDeleteModal}
        opened={deleteModalIsOpen}
      >
        <Modal.Body>
          <b>This cannot be undone.</b>
          <Group justify="right" mt="md">
            <Button onClick={toggleDeleteModalIsOpen}>Not really</Button>
            <Button onClick={handleDeleteFile} color="red">
              Delete this file
            </Button>
          </Group>
        </Modal.Body>
      </Modal>
      <Card withBorder my="xs">
        <Flex justify="space-between" align="center">
          <Flex direction="column" gap="xs">
            <Title order={3}>{file.display_name || <i>Unnamed</i>}</Title>
            <Group>
              <Badge>{file.filename}</Badge>{" "}
              <Badge color="gray">{file.mime_type}</Badge>
            </Group>
          </Flex>
          <Grid>
            {file.order > 0 && (
              <Grid.Col span={{ xs: "auto" }}>
                <IconButton
                  icon={<IconChevronUp />}
                  onClick={() => handleMove("up")}
                  tooltip="Move the file up in the list"
                />
              </Grid.Col>
            )}
            {file.order < max_order && (
              <Grid.Col span={{ xs: "auto" }}>
                <IconButton
                  icon={<IconChevronDown />}
                  onClick={() => handleMove("down")}
                  tooltip="Move the file down in the list"
                />
              </Grid.Col>
            )}
            <Grid.Col span={{ xs: "auto" }}>
              <IconButton
                icon={<IconKey />}
                onClick={toggleKeyIsOpen}
                tooltip="View access token"
              />
            </Grid.Col>
            <Grid.Col span={{ xs: "auto" }}>
              <IconButton
                icon={<IconEdit />}
                onClick={toggleEditIsOpen}
                tooltip="Edit file"
              />
            </Grid.Col>
            <Grid.Col span={{ xs: "auto" }}>
              <IconButton
                icon={<IconTrash />}
                color="red"
                onClick={toggleDeleteModalIsOpen}
                tooltip="Delete file"
              />
            </Grid.Col>
          </Grid>
        </Flex>
      </Card>
    </>
  );
};

export default DocumentFileItem;
