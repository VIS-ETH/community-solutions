/* eslint-disable @typescript-eslint/no-misused-promises */
import {
  Alert,
  Anchor,
  Breadcrumbs,
  Button,
  Card,
  Container,
  Flex,
  Group,
  Title,
  Text,
  Tabs,
  Box,
  Tooltip,
  Modal,
  Stack,
  List
} from "@mantine/core";
import React, { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { download } from "../api/fetch-utils";
import IconButton from "../components/icon-button";
import LikeButton from "../components/like-button";
import ContentContainer from "../components/secondary-container";
import DocumentCode from "../components/document-code";
import DocumentCommentComponent from "../components/document-comment";
import DocumentCommentForm from "../components/document-comment-form";
import DocumentMarkdown from "../components/document-markdown";
import DocumentMarkdownEditor from "../components/document-markdown-editor";
import DocumentPdf from "../components/document-pdf";
import DocumentSettings from "../components/document-settings";
import { useDocumentDownload } from "../hooks/useDocumentDownload";
import MarkdownText from "../components/markdown-text";
import { differenceInSeconds, formatDistanceToNow } from "date-fns";
import {
  IconChevronRight,
  IconDownload,
  IconEdit,
  IconFile,
  IconFileTypePdf,
  IconFileTypeZip,
  IconMessage,
  IconSettings,
} from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { useQuickSearchFilter } from "../components/Navbar/QuickSearch/QuickSearchFilterContext";
import { useScrollToPermalink } from "../hooks/useScrollToPermalink";
import type { DocumentFileSchema } from "../api/model/documentFileSchema";
import type { DocumentSchema } from "../api/model/documentSchema";
import { useGetDocument } from "../api/hooks/documents";
import serverData from "../utils/server-data";

const isPdf = (file: DocumentFileSchema) =>
  file.mime_type === "application/pdf";
const isMarkdown = (file: DocumentFileSchema) =>
  file.filename.toLowerCase().endsWith(".md");
const isTex = (file: DocumentFileSchema) =>
  file.filename.toLowerCase().endsWith(".tex");
const isTypst = (file: DocumentFileSchema) =>
  file.filename.toLowerCase().endsWith(".typ");

const getComponents = (
  file: DocumentFileSchema | undefined,
):
  | {
      Viewer: React.FC<{
        document: DocumentSchema;
        file: DocumentFileSchema;
        url: string;
      }>;
      Editor:
        | React.FC<{
            document: DocumentSchema;
            file: DocumentFileSchema;
            url: string;
          }>
        | undefined;
    }
  | undefined => {
  if (file === undefined) return undefined;

  if (isPdf(file)) {
    return { Viewer: DocumentPdf, Editor: undefined };
  }
  if (isMarkdown(file)) {
    return { Viewer: DocumentMarkdown, Editor: DocumentMarkdownEditor };
  }
  if (isTex(file) || isTypst(file)) {
    return { Viewer: DocumentCode, Editor: undefined };
  }

  return undefined;
};

const getFile = (document: DocumentSchema | undefined, oid: number) =>
  document ? document.files?.find(x => x.oid === oid) : undefined;

const FileIcon: React.FC<{ filename: string }> = ({ filename }) => {
  if (filename.endsWith(".pdf")) {
    return <IconFileTypePdf />;
  }

  if (filename.endsWith(".zip")) {
    return <IconFileTypeZip />;
  }

  return <IconFile />;
};

// Calculate tab to show based on state if user hasn't
// navigated to a tab yet
function resolveTab(
  storedTab: string | null | undefined,
  searchParams: string,
  document?: DocumentSchema,
): string | undefined {
  if (storedTab) return storedTab;

  if (!document) return undefined;

  // If ?comment=... in url and that is a valid comment
  // navigate to comments
  const sp = new URLSearchParams(searchParams);
  const commentId = sp.get("comment");
  if (
    commentId &&
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    document.comments!.some(item => String(item.oid) === commentId)
  ) {
    return "comments";
  }

  // Navigate to first file if it exists
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const files = document.files!;
  if (files.length > 0) {
    return String(files[0].oid);
  }

  return undefined;
}

const DocumentPage: React.FC = () => {
  const { author, slug } = useParams() as { slug: string; author: string };
  const {
    data: document,
    isSuccess,
    refetch,
    isError,
    error,
  } = useGetDocument(
    author,
    slug,
    {
      include_comments: true,
      include_files: true,
    },
    {
      query: {
        select({ value: document }) {
          return document;
        },
      },
    },
  );

  useQuickSearchFilter(
    isSuccess
      ? { slug: document.category, displayname: document.category_display_name }
      : undefined,
  );

  const { search: searchParams } = useLocation();

  const [tab, setTab] = useState<string | null>();
  const resolvedTab = resolveTab(tab, searchParams, document);

  const activeFile =
    resolvedTab && !Number.isNaN(Number(resolvedTab))
      ? getFile(document, Number(resolvedTab))
      : undefined;
  const Components = getComponents(activeFile);
  const [editing, { toggle: toggleEditing }] = useDisclosure();
  const [warningFiles, setWarningFiles] = useState<DocumentFile[]>([]);
  const [
    showWarningModal,
    { open: openWarningModal, close: closeWarningModal },
  ] = useDisclosure();
  const [loadingDownload, startDownload] = useDocumentDownload(document);

  useScrollToPermalink();

  const getFileExtension = (filename: string): string | undefined => {
    return filename.split(".").at(-1)?.toLowerCase();
  };

  function formatDisplayName(file: DocumentFileSchema): string {
    const ext = getFileExtension(file.filename);
    if (ext && file.display_name.endsWith(`.${ext}`)) {
      return file.display_name;
    }

    return `${file.display_name}.${ext}`;
  }

  const isUnsafeFile = (file: DocumentFile): boolean => {
    const ext = getFileExtension(file.filename);
    return ext !== undefined && !serverData.document_download_safe_extensions.includes(ext);
  };

  const handleDownload = () => {
    const warningFiles = data?.files.filter(file => {
      return isUnsafeFile(file);
    });
    if (warningFiles && warningFiles.length > 0) {
      setWarningFiles(warningFiles);
      openWarningModal();
    } else {
      startDownload();
    }
  };

  return (
    <>
      <Modal
        opened={showWarningModal}
        onClose={closeWarningModal}
        withCloseButton={false}
      >
        <Stack>
          <Text>Some requested files have uncommon file extensions.</Text>
          <Text>
            Please note that the server has not scanned or verified the files for viruses,
            and you should exercise caution when downloading user-uploaded files.
          </Text>
          <Alert title={`Possibly unsafe file${warningFiles.length > 1 ? "s" : ""}`}>
            <List spacing={4} size="sm">
                  {warningFiles.map((file) => (
                    <List.Item key={file.display_name}>
                      {formatDisplayName(file)}
                    </List.Item>
                  ))}
                </List>
          </Alert>
          <Text>Are you sure you want to continue?</Text>
          <Group justify="flex-end">
            <Button onClick={closeWarningModal}>Cancel</Button>
            <Button
              color="red"
              onClick={() => {
                startDownload();
                closeWarningModal();
              }}
            >
              Download
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Container size="xl">
        <Breadcrumbs separator={<IconChevronRight />}>
          <Anchor tt="uppercase" size="xs" component={Link} to="/">
            Home
          </Anchor>
          <Anchor
            size="xs"
            tt="uppercase"
            component={Link}
            to={`/category/${document ? document.category : ""}`}
          >
            {document?.category_display_name}
          </Anchor>
          <Anchor size="xs" tt="uppercase">
            {document?.display_name}
          </Anchor>
        </Breadcrumbs>
        {document && (
          <Box my="sm">
            <Flex justify="space-between" align="center">
              <Title>{document.display_name}</Title>
              <Group>
                <IconButton
                  icon={<IconDownload />}
                  onClick={handleDownload}
                  color="gray"
                  tooltip="Download"
                  loading={loadingDownload}
                />
                <LikeButton document={document} refetch={refetch} />
              </Group>
            </Flex>
            <Anchor component={Link} to={`/user/${document.author}`}>
              <Text fw={700} component="span">
                {document.author_displayname}
              </Text>
              <Text ml="0.3em" c="dimmed" component="span">
                @{document.author}
              </Text>
            </Anchor>
            {differenceInSeconds(
              new Date(document.edittime),
              new Date(document.time),
            ) > 1 && (
              <>
                <Text c="dimmed" mx={6} component="span">
                  ·
                </Text>
                <Tooltip
                  withArrow
                  withinPortal
                  label={`Created ${formatDistanceToNow(new Date(document.time))} ago`}
                >
                  <Text c="dimmed" component="span">
                    updated {formatDistanceToNow(new Date(document.edittime))}{" "}
                    ago
                  </Text>
                </Tooltip>
              </>
            )}
          </Box>
        )}
        {isError && <Alert color="red">{String(error)}</Alert>}
        {document?.description && (
          <div>
            <MarkdownText value={document.description} />
          </div>
        )}
      </Container>
      <Container size="xl" mt="sm">
        <Tabs value={resolvedTab} onChange={setTab}>
          <Tabs.List>
            {/* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */}
            {document
              ?.files!.sort((a, b) => a.order - b.order)
              .map(file => (
                <Tabs.Tab
                  key={file.oid}
                  value={file.oid.toString()}
                  leftSection={<FileIcon filename={file.filename} />}
                >
                  {formatDisplayName(file)}
                </Tabs.Tab>
              ))}
            <Tabs.Tab value="comments" leftSection={<IconMessage />}>
              Comments
            </Tabs.Tab>
            {document && (document.can_delete || document.can_edit) && (
              <Tabs.Tab value="settings" leftSection={<IconSettings />}>
                Settings
              </Tabs.Tab>
            )}
          </Tabs.List>
        </Tabs>
      </Container>

      {activeFile &&
        document &&
        (Components?.Viewer ? (
          document.can_edit && Components.Editor !== undefined ? (
            <ContentContainer mt="-2px">
              <Container>
                <Flex py="sm" justify="center">
                  <Button leftSection={<IconEdit />} onClick={toggleEditing}>
                    Toggle Edit Mode
                  </Button>
                </Flex>
              </Container>
              {!editing && (
                <Components.Viewer
                  file={activeFile}
                  document={document}
                  url={`/api/document/file/${activeFile.filename}`}
                />
              )}
              {editing && (
                <Container size="xl">
                  <Components.Editor
                    file={activeFile}
                    document={document}
                    url={`/api/document/file/${activeFile.filename}`}
                  />
                </Container>
              )}
            </ContentContainer>
          ) : (
            <Components.Viewer
              file={activeFile}
              document={document}
              url={`/api/document/file/${activeFile.filename}`}
            />
          )
        ) : (
          <ContentContainer mt="-2px">
            <Container size="xl">
              {activeFile && (isUnsafeFile(activeFile) ? <Alert color="red" my="sm">
                This file has an uncommon file extension. Be careful when downloading it, as the server does not scan user-uploaded files for viruses.
              </Alert> : <Alert color="blue" my="sm">
                This file can only be downloaded.
              </Alert>)}
              <Button
                leftSection={<IconDownload />}
                onClick={() =>
                  download(`/api/document/file/${activeFile.filename}`)
                }
              >
                Download
              </Button>
            </Container>
          </ContentContainer>
        ))}
      {tab === "comments" && document && (
        <ContentContainer mt="-2px">
          <Container size="xl">
            {/* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */}
            {document.comments!.length === 0 && (
              <Alert mb="sm">There are no comments yet.</Alert>
            )}
            {/* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */}
            {document.comments!.map(comment => (
              <DocumentCommentComponent
                documentAuthor={document.author}
                documentSlug={slug}
                comment={comment}
                key={comment.oid}
                refetch={refetch}
              />
            ))}
            <Card shadow="md" withBorder>
              <DocumentCommentForm
                documentAuthor={author}
                documentSlug={slug}
                refetch={refetch}
              />
            </Card>
          </Container>
        </ContentContainer>
      )}

      {tab === "settings" && document && (
        <ContentContainer mt="-2px">
          <Container size="xl">
            <DocumentSettings document={document} refetch={refetch} />
          </Container>
        </ContentContainer>
      )}
    </>
  );
};

export default DocumentPage;
