import { useLocalStorageState, useRequest, useSize } from "ahooks";
import {
  Card,
  Breadcrumbs,
  Anchor,
  Loader,
  Alert,
  Container,
  Grid,
  Flex,
  Group,
  Button,
  useComputedColorScheme,
  Center,
} from "@mantine/core";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import { loadSections } from "../api/exam-loader";
import { loadSplitRenderer } from "../api/hooks";
import {
  getGetCutsQueryKey,
  getGetExamMetadataQueryKey,
  useAddCut,
  useEditCut,
  useGetCuts,
  useGetExamMetadata,
  useRemoveAnswerUserSolved,
  useSetAnswerUserSolved,
} from "../api/hooks/answers";
import type {
  CutPageSchema,
  EditCutBody,
  ExamMetadataSchema,
  ValueWrappedDictIntListCutPageSchema,
  ValueWrappedExamMetadataSchema,
} from "../api/model";
import { useQueryClient } from "@tanstack/react-query";
import { UserContext, useUser } from "../auth";
import Exam from "../components/exam";
import ExamMetadataEditor from "../components/exam-metadata-editor";
import ExamPanel from "../components/exam-panel";
import IconButton from "../components/icon-button";
import PrintExam from "../components/print-exam";
import ContentContainer from "../components/secondary-container";
import { TOC, TOCNode } from "../components/table-of-contents";
import useSet from "../hooks/useSet";
import useTitle from "../hooks/useTitle";
import {
  RECENT_EXAMS_KEY,
  pushRecentExam,
  RecentExam,
} from "../utils/recently-viewed-exams";
import {
  EditMode,
  EditState,
  PdfSection,
  Section,
  SectionKind,
} from "../interfaces";
import PDF from "../pdf/pdf-renderer";
import { getAnswerSectionId } from "../utils/exam-utils";
import {
  IconCheck,
  IconChevronRight,
  IconDownload,
  IconEdit,
  IconFileCheck,
  IconLink,
} from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { useQuickSearchFilter } from "../components/Navbar/QuickSearch/QuickSearchFilterContext";
import { useMarkExamChecked } from "../api/hooks/payments";

type ServerCutResponse = Record<string, CutPageSchema[]>;

function omitNullish<T extends object>(update: T) {
  return Object.fromEntries(
    Object.entries(update).filter(([, value]) => value != null),
  ) as { [K in keyof T]?: NonNullable<T[K]> };
}

interface ExamPageContentProps {
  metaData: ExamMetadataSchema;
  sections?: Section[];
  renderer?: PDF;
  reloadCuts: () => void;
  mutateCuts: (mutation: (old: ServerCutResponse) => ServerCutResponse) => void;
  mutateMetaData: (
    x: ExamMetadataSchema | ((data: ExamMetadataSchema) => ExamMetadataSchema),
  ) => void;
  goToEditPage: () => void;
}
const ExamPageContent: React.FC<ExamPageContentProps> = ({
  metaData,
  sections,
  renderer,
  reloadCuts,
  mutateCuts,
  mutateMetaData,
  goToEditPage,
}) => {
  const computedColorScheme = useComputedColorScheme();
  const { examFile, solutionFile } = metaData;
  const markExamChecked = useMarkExamChecked({
    mutation: {
      onSuccess() {
        mutateMetaData(metaData => ({
          ...metaData,
          oralTranscriptChecked: true,
        }));
      },
    },
  });
  const user = useUser()!;
  const { mutateAsync: addCut } = useAddCut({
    mutation: { onSuccess: reloadCuts },
  });
  const { mutateAsync: moveCut } = useEditCut({
    mutation: {
      onSuccess: () => {
        reloadCuts();
        setEditState({ mode: EditMode.None });
      },
    },
  });
  const { mutateAsync: runMarkExamUserSolved } = useSetAnswerUserSolved();
  const { mutateAsync: runUnmarkExamUserSolved } = useRemoveAnswerUserSolved();
  const { mutateAsync: editCut } = useEditCut({
    mutation: {
      // Apply the edit locally rather than refetching every cut on the exam.
      onSuccess: (_data, { oid, data: update }) => {
        mutateCuts(oldCuts =>
          Object.fromEntries(
            Object.entries(oldCuts).map(([page, cuts]) => [
              page,
              cuts.map(cut =>
                cut.oid === oid ? { ...cut, ...omitNullish(update) } : cut,
              ),
            ]),
          ),
        );
      },
    },
  });
  const onAddCut = useCallback(
    (filename: string, pageNum: number, relHeight: number) =>
      void addCut({ filename, data: { pageNum, relHeight, hasAnswers: true } }),
    [addCut],
  );
  const onMoveCut = useCallback(
    (oid: number, data: EditCutBody) => void moveCut({ oid, data }),
    [moveCut],
  );
  const onSectionChange = useCallback(
    async (section: number | [number, number], update: EditCutBody) => {
      if (Array.isArray(section)) {
        await addCut({
          filename: metaData.filename,
          data: {
            pageNum: section[0],
            relHeight: section[1],
            hidden: update.hidden ?? false,
          },
        });
      } else {
        await editCut({ oid: section, data: update });
      }
    },
    [addCut, metaData, editCut],
  );
  const toggleExamUserSolved: () => void = async () => {
    const { filename } = metaData;
    const { value } = metaData.userSolved
      ? await runUnmarkExamUserSolved({ filename })
      : await runMarkExamUserSolved({ filename });

    mutateMetaData(metaData => ({
      ...metaData,
      userSolved: value.userSolved,
    }));
  };

  const sizeRef = useRef<HTMLDivElement>(null);
  const size = useSize(sizeRef);
  const [maxWidth, setMaxWidth] = useLocalStorageState("max-width", 1000);

  const [inViewSplits, addInViewSplit, removeInViewSplit] =
    useSet<PdfSection>();
  const [panelIsOpen, { toggle: togglePanel }] = useDisclosure();
  const [editState, setEditState] = useState<EditState>({
    mode: EditMode.None,
  });

  const inViewChangeListener = useCallback(
    (section: PdfSection, v: boolean) =>
      v ? addInViewSplit(section) : removeInViewSplit(section),
    [addInViewSplit, removeInViewSplit],
  );

  const width = size.width;
  const [displayOptions, setDisplayOptions] = useState({
    displayHiddenPdfSections: false,
    displayHiddenAnswerSections: false,
    displayHideShowButtons: false,
    displayEmptyCutLabels: false,
  });

  const inViewPages = useMemo(() => {
    const s = new Set<number>();
    for (const split of inViewSplits) {
      s.add(split.start.page);
    }
    return s;
  }, [inViewSplits]);

  const visiblePages = useMemo(() => {
    const s = new Set<number>();
    if (!sections) return undefined;
    for (const section of sections) {
      if (
        section.kind === SectionKind.Pdf &&
        (!section.hidden || displayOptions.displayHiddenPdfSections)
      ) {
        s.add(section.start.page);
      }
    }
    return s;
  }, [sections, displayOptions]);

  const [expandedSections, expandSections, collapseSections] = useSet<number>();
  const answerSections = useMemo(() => {
    if (sections === undefined) return;
    const answerSections: number[] = [];
    for (const section of sections) {
      if (section.kind === SectionKind.Answer) {
        answerSections.push(section.oid);
      }
    }
    return answerSections;
  }, [sections]);
  const allSectionsExpanded = useMemo(() => {
    if (answerSections === undefined) return true;
    return answerSections.every(section => expandedSections.has(section));
  }, [answerSections, expandedSections]);
  const allSectionsCollapsed = useMemo(() => {
    if (answerSections === undefined) return true;
    return !answerSections.some(section => expandedSections.has(section));
  }, [answerSections, expandedSections]);
  const collapseAllSections = useCallback(() => {
    if (answerSections === undefined) return;
    collapseSections(...answerSections);
  }, [collapseSections, answerSections]);
  const expandAllSections = useCallback(() => {
    if (answerSections === undefined) return;
    expandSections(...answerSections);
  }, [expandSections, answerSections]);

  const toc = useMemo(() => {
    if (sections === undefined) {
      return undefined;
    }
    const rootNode = new TOCNode("[root]", "");
    for (const section of sections) {
      if (section.kind === SectionKind.Answer) {
        if (section.cutHidden) continue;
        const parts = section.name.split(" > ");
        if (parts.length === 1 && parts[0].length === 0) continue;
        const jumpTarget = getAnswerSectionId(section.oid, section.name);
        rootNode.add(parts, jumpTarget);
      }
    }
    if (rootNode.children.length === 0) return undefined;
    return rootNode;
  }, [sections]);

  return (
    <>
      <Container size="xl">
        <Flex justify="space-between" align="center">
          <h1>{metaData.displayname}</h1>
          <Group>
            <IconButton
              color={metaData.userSolved ? "grape" : "gray"}
              icon={<IconCheck />}
              tooltip={
                metaData.userSolved
                  ? "Mark exam as unsolved"
                  : "Mark exam as solved"
              }
              onClick={toggleExamUserSolved}
            />
            {examFile && (
              <IconButton
                color="gray"
                icon={<IconDownload />}
                tooltip="Download"
                onClick={() => open(examFile, "_blank")}
              />
            )}
            {user.isCategoryAdmin && (
              <>
                {user.isAdmin &&
                  metaData.isOralTranscript &&
                  !metaData.oralTranscriptChecked && (
                    <IconButton
                      color="gray"
                      tooltip="Mark as checked"
                      icon={<IconFileCheck />}
                      onClick={() =>
                        markExamChecked.mutate({
                          filename: metaData.filename,
                        })
                      }
                    />
                  )}
                <IconButton
                  color="gray"
                  icon={<IconEdit />}
                  tooltip="Edit"
                  onClick={() => goToEditPage()}
                />
              </>
            )}
          </Group>
        </Flex>
        {metaData.darkModeWarning && computedColorScheme === "dark" && (
          <Alert color="yellow" title="Dark mode warning" mb="md">
            Images are inverted in dark mode. This exam is marked as
            particularly affected, so please switch to light mode for correct
            rendering.
          </Alert>
        )}
        <Grid>
          {!metaData.canView && (
            <Grid.Col span={{ md: 6, lg: 4 }}>
              <Card m="xs">
                {metaData.needsPayment && !metaData.hasPaid ? (
                  <>
                    You have to pay a deposit in order to see oral exams. After
                    submitting a report of your own oral exam you can get your
                    deposit back.
                  </>
                ) : (
                  <>You can not view this exam at this time.</>
                )}
              </Card>
            </Grid.Col>
          )}
          {metaData.isPrintonly && (
            <Grid.Col span={{ md: 6, lg: 4 }}>
              <PrintExam
                title="exam"
                examtype="exam"
                filename={metaData.filename}
              />
            </Grid.Col>
          )}
          {metaData.hasSolution && metaData.solutionPrintonly && (
            <Grid.Col span={{ md: 6, lg: 4 }}>
              <PrintExam
                title="solution"
                examtype="solution"
                filename={metaData.filename}
              />
            </Grid.Col>
          )}
          {metaData.masterSolution && (
            <Grid.Col span={{ md: 4, lg: 3 }}>
              <Button
                fullWidth
                color="gray"
                component="a"
                variant="light"
                href={metaData.masterSolution}
                target="_blank"
                rel="noopener noreferrer"
                leftSection={<IconLink />}
              >
                Official Solution (external)
              </Button>
            </Grid.Col>
          )}

          {solutionFile && !metaData.solutionPrintonly && (
            <Grid.Col span={{ md: 4, lg: 3 }}>
              <Button
                fullWidth
                color="gray"
                component="a"
                href={solutionFile}
                variant="light"
                target="_blank"
                rel="noopener noreferrer"
                leftSection={<IconDownload />}
              >
                Official Solution
              </Button>
            </Grid.Col>
          )}
          {metaData.attachments.map(attachment => (
            <Grid.Col span={{ md: 4, lg: 3 }} key={attachment.filename}>
              <Button
                fullWidth
                component="a"
                variant="light"
                href={`/api/filestore/get/${attachment.filename}/`}
                target="_blank"
                rel="noopener noreferrer"
                leftSection={<IconDownload />}
              >
                {attachment.displayname}
              </Button>
            </Grid.Col>
          ))}
        </Grid>
        {toc && (
          <Grid>
            <Grid.Col span={{ lg: 12 }}>
              <TOC toc={toc} />
            </Grid.Col>
          </Grid>
        )}
      </Container>

      <ContentContainer>
        <Container ref={sizeRef} style={{ maxWidth }} my="sm" px="xs">
          {width && sections && renderer && (
            <Exam
              metaData={metaData}
              sections={sections}
              width={width}
              editState={editState}
              setEditState={setEditState}
              reloadCuts={reloadCuts}
              renderer={renderer}
              onUpdateCut={onSectionChange}
              onAddCut={onAddCut}
              onMoveCut={onMoveCut}
              inViewChangeListener={inViewChangeListener}
              displayHiddenPdfSections={displayOptions.displayHiddenPdfSections}
              displayHiddenAnswerSections={
                displayOptions.displayHiddenAnswerSections
              }
              displayEmptyCutLabels={displayOptions.displayEmptyCutLabels}
              displayHideShowButtons={displayOptions.displayHideShowButtons}
              expandedSections={expandedSections}
              onCollapseSections={collapseSections}
              onExpandSections={expandSections}
            />
          )}

          <Center>
            <Button
              leftSection={metaData.userSolved && <IconCheck />}
              onClick={toggleExamUserSolved}
              color={metaData.userSolved ? "grape" : "gray"}
            >
              Mark exam as solved
            </Button>
          </Center>
        </Container>
      </ContentContainer>
      <ExamPanel
        isOpen={panelIsOpen}
        toggle={togglePanel}
        metaData={metaData}
        renderer={renderer}
        inViewPages={inViewPages}
        visiblePages={visiblePages}
        allSectionsExpanded={allSectionsExpanded}
        allSectionsCollapsed={allSectionsCollapsed}
        onCollapseAllSections={collapseAllSections}
        onExpandAllSections={expandAllSections}
        maxWidth={maxWidth}
        setMaxWidth={setMaxWidth}
        editState={editState}
        setEditState={setEditState}
        displayOptions={displayOptions}
        setDisplayOptions={setDisplayOptions}
      />
    </>
  );
};

const ExamPage: React.FC = () => {
  const { filename } = useParams() as { filename: string };
  const queryClient = useQueryClient();
  const {
    error: metadataError,
    isLoading: metadataLoading,
    data: metadata,
  } = useGetExamMetadata(filename, { query: { select: data => data.value } });
  const setMetadata = useCallback(
    (
      update:
        ExamMetadataSchema | ((old: ExamMetadataSchema) => ExamMetadataSchema),
    ) =>
      queryClient.setQueryData(
        getGetExamMetadataQueryKey(filename),
        (old: ValueWrappedExamMetadataSchema | undefined) =>
          old && {
            value: typeof update === "function" ? update(old.value) : update,
          },
      ),
    [queryClient, filename],
  );
  useTitle(metadata?.displayname ?? filename);
  useEffect(() => {
    if (!metadata) return;
    try {
      const raw = localStorage.getItem(RECENT_EXAMS_KEY);
      const list: RecentExam[] = raw ? JSON.parse(raw) : [];
      const updated = pushRecentExam(list, {
        filename: metadata.filename,
        displayname: metadata.displayname,
        category: metadata.category,
        category_displayname: metadata.categoryDisplayname,
      });
      localStorage.setItem(RECENT_EXAMS_KEY, JSON.stringify(updated));
    } catch {
      // corrupted localStorage entry — silently ignore
    }
  }, [metadata?.filename]);
  useQuickSearchFilter(
    metadata && {
      slug: metadata.category,
      displayname: metadata.categoryDisplayname,
    },
  );
  const {
    error: cutsError,
    isLoading: cutsLoading,
    data: cuts,
    refetch,
  } = useGetCuts(filename, { query: { select: data => data.value } });
  const reloadCuts = useCallback(() => void refetch(), [refetch]);
  const mutateCuts = useCallback(
    (mutation: (old: ServerCutResponse) => ServerCutResponse) =>
      queryClient.setQueryData(
        getGetCutsQueryKey(filename),
        (old: ValueWrappedDictIntListCutPageSchema | undefined) =>
          old && { value: mutation(old.value) },
      ),
    [queryClient, filename],
  );
  const {
    error: pdfError,
    loading: pdfLoading,
    data,
  } = useRequest(
    () => {
      if (metadata === undefined) return Promise.resolve(undefined);
      const examFile = metadata.examFile;
      if (examFile === null) return Promise.resolve(undefined);
      return loadSplitRenderer(examFile);
    },
    { refreshDeps: [metadata === undefined, metadata?.examFile] },
  );
  const [pdf, renderer] = !pdfLoading && data ? data : [];
  const sections = useMemo(
    () => (cuts && pdf ? loadSections(pdf.numPages, cuts) : undefined),
    [pdf, cuts],
  );
  const error = metadataError ?? cutsError ?? pdfError;
  const user = useUser()!;

  const navigate = useNavigate();

  return (
    <div key={filename}>
      <Container size="xl">
        <Breadcrumbs separator={<IconChevronRight />}>
          <Anchor component={Link} tt="uppercase" size="xs" to="/">
            Home
          </Anchor>
          <Anchor
            tt="uppercase"
            size="xs"
            component={Link}
            to={`/category/${metadata ? metadata.category : ""}`}
          >
            {metadata?.categoryDisplayname}
          </Anchor>
          <Anchor tt="uppercase" size="xs">
            {metadata?.displayname}
          </Anchor>
        </Breadcrumbs>
      </Container>
      <div>
        {error && (
          <Container>
            <Alert color="red">{error.toString()}</Alert>
          </Container>
        )}
        {metadataLoading && (
          <Container>
            <Loader />
          </Container>
        )}
        {!metadataLoading && metadata && (
          <Routes>
            <Route
              path="edit"
              element={
                !user.isAdmin && !metadata.canEdit ? (
                  <Navigate to="./.." replace />
                ) : (
                  <Container size="xl">
                    <ExamMetadataEditor
                      currentMetaData={metadata}
                      closeEditPage={() => navigate("./..")}
                      onMetaDataChange={setMetadata}
                    />
                  </Container>
                )
              }
            />
            <Route
              path="/"
              element={
                <UserContext.Provider
                  value={{
                    ...user,
                    isExpert: user.isExpert ?? metadata.isExpert,
                    isCategoryAdmin: user.isAdmin || metadata.canEdit,
                  }}
                >
                  <ExamPageContent
                    metaData={metadata}
                    sections={sections}
                    renderer={renderer}
                    reloadCuts={reloadCuts}
                    mutateCuts={mutateCuts}
                    mutateMetaData={setMetadata}
                    goToEditPage={() => navigate("./edit")}
                  />
                </UserContext.Provider>
              }
            />
            <Route path="*" element={<Navigate to="./.." replace />} />
          </Routes>
        )}
        {(cutsLoading || pdfLoading) && !metadataLoading && (
          <Container>
            <Loader />
          </Container>
        )}
      </div>
    </div>
  );
};
export default ExamPage;
