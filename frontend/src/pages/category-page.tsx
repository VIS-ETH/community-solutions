import {
  Breadcrumbs,
  Alert,
  Badge,
  Container,
  Anchor,
  Flex,
  Group,
  Grid,
  List,
  Button,
  Box,
  Title,
  Loader,
  Modal,
} from "@mantine/core";
import React, { useCallback, useMemo, useState } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import { UserContext, useUser } from "../auth";
import CategoryMetaDataEditor from "../components/category-metadata-editor";
import ExamList from "../components/exam-list";
import MandateAcceptModal from "../components/mandate-accept-modal";
import LoadingOverlay from "../components/loading-overlay";
import DocumentList from "../components/document-list";
import useRemoveConfirm from "../hooks/useRemoveConfirm";
import useTitle from "../hooks/useTitle";
import { getMetaCategoriesForCategory } from "../utils/category-utils";
import {
  IconChevronRight,
  IconEdit,
  IconInfoCircle,
  IconStar,
  IconTrash,
  IconUpload,
  IconUserStar,
} from "@tabler/icons-react";
import { useQuickSearchFilter } from "../components/Navbar/QuickSearch/QuickSearchFilterContext";
import { UploadPdfForm } from "../components/upload-pdf-card";
import { UploadTranscriptForm } from "../components/upload-transcript-card.js";
import { useDisclosure } from "@mantine/hooks";
import { useCreateMandate } from "../api/hooks/mandates";
import {
  getGetCategoryMetadataQueryKey,
  getListCategoryExamsQueryKey,
  useGetCategoryMetadata,
  useListMetaCategories,
  useRemoveCategory,
} from "../api/hooks/categories";
import { CategoryData } from "../api/model";
import { useQueryClient } from "@tanstack/react-query";

interface CategoryPageContentProps {
  onMetaDataChange: (newMetaData: CategoryData) => void;
  metadata: CategoryData;
}
const CategoryPageContent: React.FC<CategoryPageContentProps> = ({
  onMetaDataChange,
  metadata: metadata,
}) => {
  const { data, isPending: loading, refetch: run } = useListMetaCategories();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isPending: removeLoading, mutate: remove } = useRemoveCategory({
    mutation: {
      onSuccess: () => {
        void navigate("/");
        // Remove caches
        queryClient.removeQueries({
          queryKey: getGetCategoryMetadataQueryKey(metadata.slug),
        });
        queryClient.removeQueries({
          queryKey: getListCategoryExamsQueryKey(metadata.slug),
        });
        // Invalidate caches for all category listings (e.g. quicksearch box)
        void queryClient.invalidateQueries({
          predicate: ({ queryKey: [key] }) =>
            typeof key === "string" && key.startsWith("/api/category/list"),
        });
      },
    },
  });
  const [removeConfirm, modals] = useRemoveConfirm();
  const onRemove = useCallback(
    () =>
      removeConfirm(
        `Do you really want to remove the category "${metadata.displayname}"?`,
        () => remove({ data: { slug: metadata.slug } }),
      ),
    [removeConfirm, remove, metadata],
  );
  const offeredIn = useMemo(
    () =>
      data ? getMetaCategoriesForCategory(data, metadata.slug) : undefined,
    [data, metadata],
  );
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const user = useUser()!;
  const editorOnMetaDataChange = useCallback(
    (newMetaData: CategoryData) => {
      onMetaDataChange(newMetaData);
      void run();
    },
    [run, onMetaDataChange],
  );
  const [showUploadModal, setShowUploadModal] = useState<
    false | "exam" | "transcript"
  >(false);
  const [
    showMandateAcceptModal,
    { open: openMandateAcceptModal, close: closeMandateAcceptModal },
  ] = useDisclosure(false);
  const { isPending: creatingMandate, mutate: runCreateMandate } =
    useCreateMandate({
      mutation: {
        onSuccess() {
          closeMandateAcceptModal();
          // hides the banner and unlocks the paid exams
          void queryClient.invalidateQueries({
            queryKey: getGetCategoryMetadataQueryKey(metadata.slug),
          });
          void queryClient.invalidateQueries({
            queryKey: getListCategoryExamsQueryKey(metadata.slug),
          });
        },
      },
    });

  return (
    <>
      <MandateAcceptModal
        opened={showMandateAcceptModal}
        onClose={closeMandateAcceptModal}
        loading={creatingMandate}
        dueDate={metadata.mandate_due_date}
        onAccept={() => runCreateMandate({ data: { category: metadata.slug } })}
      />
      {modals}
      <Breadcrumbs separator={<IconChevronRight />}>
        <Anchor tt="uppercase" size="xs" component={Link} to="/">
          Home
        </Anchor>
        <Anchor
          tt="uppercase"
          size="xs"
          component={Link}
          to={`/category/${metadata.slug}`}
        >
          {metadata.displayname}
        </Anchor>
      </Breadcrumbs>
      <Routes>
        <Route
          path="edit"
          element={
            !user.isCategoryAdmin ? (
              <Navigate to="./.." replace />
            ) : (
              offeredIn && (
                <CategoryMetaDataEditor
                  onMetaDataChange={editorOnMetaDataChange}
                  close={() => {
                    void navigate("./..");
                  }}
                  currentMetaData={metadata}
                  offeredIn={offeredIn.flatMap(b =>
                    b.meta2.map(d => [b.displayname, d.displayname] as const),
                  )}
                />
              )
            )
          }
        />
        <Route
          path="/"
          element={
            <>
              <Flex
                direction={{ base: "column", sm: "row" }}
                justify="space-between"
                mb="sm"
              >
                <Title order={1} my="md">
                  {metadata.displayname}
                </Title>
                {!user.isCategoryAdmin && metadata.has_payments && (
                  <Button
                    leftSection={<IconUpload />}
                    onClick={() => {
                      setShowUploadModal("transcript");
                    }}
                  >
                    Upload Transcript
                  </Button>
                )}
                {user.isCategoryAdmin && (
                  <Group>
                    {metadata.has_payments && (
                      <Button
                        leftSection={<IconUpload />}
                        onClick={() => {
                          setShowUploadModal("transcript");
                        }}
                      >
                        Upload Transcript
                      </Button>
                    )}
                    <Button
                      leftSection={<IconUpload />}
                      onClick={() => {
                        setShowUploadModal("exam");
                      }}
                    >
                      Upload Exam
                    </Button>
                    <Button
                      leftSection={<IconEdit />}
                      component={Link}
                      to="./edit"
                    >
                      Edit
                    </Button>
                    <Button
                      color="red"
                      loading={removeLoading}
                      disabled={metadata.slug === "default"}
                      leftSection={<IconTrash />}
                      onClick={onRemove}
                    >
                      Delete
                    </Button>
                  </Group>
                )}
              </Flex>

              <Grid mb="xs">
                {metadata.semester && (
                  <Grid.Col span="content">
                    Semester: <Badge>{metadata.semester}</Badge>
                  </Grid.Col>
                )}
                {metadata.form && (
                  <Grid.Col span="content">
                    Form: <Badge>{metadata.form}</Badge>
                  </Grid.Col>
                )}
                {metadata.more_exams_link && (
                  <Grid.Col span="content">
                    <Anchor
                      href={metadata.more_exams_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      c="blue"
                    >
                      Additional Exams
                    </Anchor>
                  </Grid.Col>
                )}
                {metadata.remark && (
                  <Grid.Col>Remark: {metadata.remark}</Grid.Col>
                )}
              </Grid>
              {(offeredIn === undefined || offeredIn.length > 0) && (
                <Box mb="sm">
                  Offered in:
                  {loading ? (
                    <Loader />
                  ) : (
                    <List>
                      {offeredIn?.map(meta1 =>
                        meta1.meta2.map(meta2 => (
                          <List.Item
                            key={meta1.displayname + meta2.displayname}
                          >
                            {meta2.displayname} in {meta1.displayname}
                          </List.Item>
                        )),
                      )}
                    </List>
                  )}
                </Box>
              )}
              <Grid my="sm">
                {user.user?.username &&
                  metadata.experts.includes(user.user.username) && (
                    <Grid.Col span="auto">
                      <Alert
                        color="yellow"
                        title="Category expert"
                        icon={<IconStar />}
                      >
                        You are an expert for this category. You can endorse
                        correct answers, which will be visible to other users.
                      </Alert>
                    </Grid.Col>
                  )}
                {metadata.has_payments && !metadata.user_has_mandate && (
                  <Grid.Col span="auto">
                    <Alert color="gray" icon={<IconInfoCircle />}>
                      As oral exams are crowdsourced, more so than other types
                      of exams, they require active contribution to Community
                      Solutions. You must explicitly agree to these terms before
                      continuing.{" "}
                      <Button ms="md" onClick={openMandateAcceptModal}>
                        Accept terms
                      </Button>
                    </Alert>
                  </Grid.Col>
                )}
                {metadata.catadmin && (
                  <Grid.Col span="auto">
                    <Alert
                      variant="light"
                      color="blue"
                      title="Category admin"
                      icon={<IconUserStar />}
                    >
                      You can edit exams in this category. Please do so
                      responsibly.
                    </Alert>
                  </Grid.Col>
                )}
              </Grid>
              <ExamList metaData={metadata} />

              <DocumentList slug={metadata.slug} />

              {metadata.attachments.length > 0 && (
                <>
                  <Title order={2} mt="xl" mb="lg">
                    Attachments
                  </Title>
                  <List>
                    {metadata.attachments.map(att => (
                      <List.Item key={att.filename}>
                        <Anchor
                          href={`/api/filestore/get/${att.filename}/`}
                          c="blue"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {att.displayname}
                        </Anchor>
                      </List.Item>
                    ))}
                  </List>
                </>
              )}
              {(user.isCategoryAdmin || metadata.has_payments) && (
                <Modal
                  opened={showUploadModal !== false}
                  onClose={() => {
                    setShowUploadModal(false);
                  }}
                  title={
                    showUploadModal === "exam"
                      ? "Upload Exam"
                      : "Upload Transcript"
                  }
                >
                  {showUploadModal === "exam" && (
                    <UploadPdfForm category={metadata.slug} />
                  )}
                  {showUploadModal === "transcript" && (
                    <UploadTranscriptForm category={metadata.slug} />
                  )}
                </Modal>
              )}
            </>
          }
        />
        <Route path="*" element={<Navigate to="./.." replace />} />
      </Routes>
    </>
  );
};

const CategoryPage: React.FC = () => {
  const { slug } = useParams() as { slug: string };
  const { data, isPending, error, refetch } = useGetCategoryMetadata(slug);
  const navigate = useNavigate();
  const onMetaDataChange = useCallback(
    (newMetaData: CategoryData) => {
      void refetch();
      if (slug !== newMetaData.slug) {
        void navigate(`/category/${newMetaData.slug}`);
      }
    },
    [refetch, navigate, slug],
  );
  useTitle(data?.displayname ?? slug);
  useQuickSearchFilter(
    data && { slug: data.slug, displayname: data.displayname },
  );
  const user = useUser();
  return (
    <Container
      size="xl"
      mb="xl"
      key={
        slug
      } /* we need key to make sure all state is reset when slug changes due to navigation */
    >
      {error && <Alert color="red">{error.message}</Alert>}
      {isPending && <LoadingOverlay visible={isPending} />}
      {data && (
        <UserContext
          value={
            user
              ? {
                  ...user,
                  isCategoryAdmin: user.isAdmin || data.catadmin,
                }
              : undefined
          }
        >
          <CategoryPageContent
            metadata={data}
            onMetaDataChange={onMetaDataChange}
          />
        </UserContext>
      )}
    </Container>
  );
};
export default CategoryPage;
