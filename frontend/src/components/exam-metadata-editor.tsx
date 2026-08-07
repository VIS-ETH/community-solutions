import { useRequest } from "ahooks";
import {
  Alert,
  Button,
  Checkbox,
  CloseButton,
  Flex,
  Grid,
  Group,
  NativeSelect,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import React, { useEffect, useState } from "react";
import { download, fetchPost, fetchPut } from "../api/fetch-utils";
import { loadCategories } from "../api/hooks";
import useInitialState from "../hooks/useInitialState";
import { Attachment } from "../interfaces";
import { createOptions, options } from "../utils/ts-utils";
import AttachmentsEditor, { EditorAttachment } from "./attachments-editor";
import FileInput from "./file-input";
import useForm from "../hooks/useForm";
import { IconDeviceFloppy, IconX } from "@tabler/icons-react";
import Creatable from "./creatable";
import type { ExamMetadataSchema, SetExamMetadataBody } from "../api/model";
import {
  getPrintonlyPdfUrl,
  getSolutionPdfUrl,
  useListExamTypes,
  removePrintonly,
  removeSolution,
  setExamMetadata,
  uploadPrintonly,
  uploadSolution,
} from "../api/hooks/answers";

const stringKeys = [
  "displayname",
  "category",
  "examType",
  "masterSolution",
  "resolveAlias",
  "remark",
] as const;
const booleanKeys = [
  "public",
  "finishedCuts",
  "needsPayment",
  "solutionPrintonly",
  "darkModeWarning",
] as const;
const addAttachment = async (exam: string, displayname: string, file: File) => {
  return (
    await fetchPost("/api/filestore/upload/", {
      exam,
      displayname,
      file,
    })
  ).filename as string;
};
const editAttachment = async (filename: string, newdisplayname: string) => {
  await fetchPut(`/api/filestore/edit/${filename}/`, { newdisplayname });
};
const removeAttachment = async (filename: string) => {
  await fetchPost(`/api/filestore/remove/${filename}/`, {});
};

export interface ExamMetaDataDraft extends Omit<
  ExamMetadataSchema,
  "attachments"
> {
  attachments: EditorAttachment[];
}
const applyChanges = async (
  filename: string,
  oldMetaData: ExamMetadataSchema,
  newMetaData: ExamMetaDataDraft,
  printonly: File | true | undefined,
  masterSolution: File | true | undefined,
) => {
  const metaDataDiff: Partial<ExamMetadataSchema> = {};
  const update: SetExamMetadataBody = {};
  for (const key of stringKeys) {
    if (oldMetaData[key] !== newMetaData[key]) {
      metaDataDiff[key] = newMetaData[key];
      update[key] = newMetaData[key];
    }
  }
  for (const key of booleanKeys) {
    if (oldMetaData[key] !== newMetaData[key]) {
      metaDataDiff[key] = newMetaData[key];
      update[key] = newMetaData[key];
    }
  }
  if (Object.keys(update).length > 0) {
    await setExamMetadata(filename, update);
  }
  const newAttachments: Attachment[] = [];
  for (const attachment of newMetaData.attachments) {
    if (attachment.filename instanceof File) {
      const newFilename = await addAttachment(
        filename,
        attachment.displayname,
        attachment.filename,
      );
      newAttachments.push({
        displayname: attachment.displayname,
        filename: newFilename,
      });
    }
  }
  for (const attachment of oldMetaData.attachments) {
    const foundAttachment = newMetaData.attachments.find(
      otherAttachment => otherAttachment.filename === attachment.filename,
    );
    if (!foundAttachment) {
      await removeAttachment(attachment.filename);
      continue;
    }
    if (foundAttachment.displayname === attachment.displayname) {
      newAttachments.push(attachment);
    } else {
      await editAttachment(attachment.filename, foundAttachment.displayname);
      newAttachments.push({
        displayname: foundAttachment.displayname,
        filename: attachment.filename,
      });
    }
  }

  if (printonly === undefined && oldMetaData.isPrintonly) {
    await removePrintonly(filename);
    metaDataDiff.isPrintonly = false;
    metaDataDiff.printonlyFile = null;
  } else if (printonly instanceof File) {
    const result = await uploadPrintonly({
      file: printonly,
      filename,
    });
    metaDataDiff.isPrintonly = true;
    metaDataDiff.printonlyFile = result.value.url;
  }

  if (masterSolution === undefined && oldMetaData.hasSolution) {
    await removeSolution(filename);
    metaDataDiff.hasSolution = false;
  } else if (masterSolution instanceof File) {
    const result = await uploadSolution({
      file: masterSolution,
      filename,
    });
    metaDataDiff.hasSolution = true;
    metaDataDiff.solutionFile = result.value.url;
  }

  return {
    ...oldMetaData,
    ...metaDataDiff,
    attachments: newAttachments,
    categoryDisplayname: newMetaData.categoryDisplayname,
  };
};

interface Props {
  currentMetaData: ExamMetadataSchema;
  closeEditPage: () => void;
  onMetaDataChange: (newMetaData: ExamMetadataSchema) => void;
}
const ExamMetadataEditor: React.FC<Props> = ({
  currentMetaData,
  closeEditPage,
  onMetaDataChange,
}) => {
  const { data: categories } = useRequest(loadCategories);
  const { data: examTypes } = useListExamTypes({
    query: { select: data => data.value },
  });
  const categoryOptions =
    categories &&
    createOptions(
      Object.fromEntries(
        categories.map(
          category => [category.slug, category.displayname] as const,
        ),
      ) as Record<string, string>,
    );

  const [examTypeOptions, setExamTypeOptions] = useState<string[]>([]);
  useEffect(() => {
    setExamTypeOptions(examTypes ?? []);
  }, [examTypes]);

  const {
    loading,
    error,
    run: runApplyChanges,
  } = useRequest(applyChanges, {
    manual: true,
    onSuccess: newMetaData => {
      closeEditPage();
      onMetaDataChange(newMetaData);
    },
  });

  const [printonlyFile, setPrintonlyFile] = useInitialState<
    File | true | undefined
  >(currentMetaData.isPrintonly ? true : undefined);
  const [masterFile, setMasterFile] = useInitialState<File | true | undefined>(
    currentMetaData.hasSolution ? true : undefined,
  );

  const { registerInput, registerCheckbox, formState, setFormValue, onSubmit } =
    useForm(
      currentMetaData as ExamMetaDataDraft,
      values =>
        runApplyChanges(
          currentMetaData.filename,
          currentMetaData,
          values,
          printonlyFile,
          masterFile,
        ),
      ["category", "categoryDisplayname", "examType", "remark", "attachments"],
    );

  return (
    <Stack mb="xl">
      <Group justify="space-between" pt="sm">
        <Title order={2}>Edit Exam</Title>
        <CloseButton onClick={closeEditPage} />
      </Group>
      {error && <Alert color="red">{error.toString()}</Alert>}
      <Title order={5}>Metadata</Title>
      <Grid>
        <Grid.Col span={{ md: 6 }}>
          <TextInput label="Display name" {...registerInput("displayname")} />
        </Grid.Col>
        <Grid.Col span={{ md: 6 }}>
          <TextInput label="Resolve Alias" {...registerInput("resolveAlias")} />
        </Grid.Col>
      </Grid>
      <Grid>
        <Grid.Col span={{ md: 6 }}>
          <NativeSelect
            label="Category"
            data={categoryOptions ? (options(categoryOptions) as any) : []}
            value={categoryOptions?.[formState.category].value}
            onChange={(e: any) => {
              const value = e.currentTarget.value;
              setFormValue("category", value as string);
              setFormValue(
                "categoryDisplayname",
                categoryOptions?.[value]?.label ?? value,
              );
            }}
          />
        </Grid.Col>
        <Grid.Col span={{ md: 6 }}>
          <Creatable
            title="Exam type"
            getCreateLabel={(query: string) =>
              `+ Create new exam type "${query}"`
            }
            onCreate={(query: string) => {
              setExamTypeOptions([...(examTypes ?? []), query]);
              return query;
            }}
            data={examTypeOptions}
            value={formState.examType}
            onChange={(value: string) => setFormValue("examType", value)}
          />
        </Grid.Col>
      </Grid>
      <Grid>
        <Grid.Col span={{ md: 6 }}>
          <Checkbox
            name="check"
            label="Public"
            {...registerCheckbox("public")}
          />
        </Grid.Col>
        <Grid.Col span={{ md: 6 }}>
          <Checkbox
            name="check"
            id="needsPayment"
            label="Needs Payment"
            {...registerCheckbox("needsPayment")}
          />
        </Grid.Col>
      </Grid>
      <Grid>
        <Grid.Col span={{ md: 6 }}>
          <Checkbox
            name="check"
            label="Finished Cuts"
            {...registerCheckbox("finishedCuts")}
          />
        </Grid.Col>
        <Grid.Col span={{ md: 6 }}>
          <Checkbox
            name="check"
            id="darkModeWarning"
            label="Warn users against using dark mode with this exam"
            {...registerCheckbox("darkModeWarning")}
          />
        </Grid.Col>
      </Grid>
      <Grid>
        <Grid.Col span={{ md: 6 }}>
          <TextInput
            type="url"
            {...registerInput("masterSolution")}
            label="Master Solution (extern)"
          />
        </Grid.Col>
      </Grid>
      <Grid>
        <Grid.Col span={{ md: 6 }}>
          <Text size="sm">Print Only File</Text>
          {printonlyFile === true ? (
            <Flex align="center" gap="sm">
              <Button
                size="sm"
                onClick={() =>
                  void getPrintonlyPdfUrl(currentMetaData.filename).then(
                    ({ value }) => download(value.url, value.displayName),
                  )
                }
              >
                Download Current File
              </Button>
              <CloseButton onClick={() => setPrintonlyFile(undefined)} />
            </Flex>
          ) : (
            <FileInput
              value={printonlyFile}
              onChange={e => setPrintonlyFile(e)}
            />
          )}
        </Grid.Col>
        <Grid.Col span={{ md: 6 }}>
          <Text size="sm">Master Solution</Text>
          {masterFile === true ? (
            <Flex align="center" gap="sm">
              <Button
                size="sm"
                onClick={() =>
                  void getSolutionPdfUrl(currentMetaData.filename).then(
                    ({ value }) => download(value.url, value.displayName),
                  )
                }
              >
                Download Current File
              </Button>
              <CloseButton onClick={() => setMasterFile(undefined)} />
            </Flex>
          ) : (
            <FileInput value={masterFile} onChange={e => setMasterFile(e)} />
          )}
        </Grid.Col>
      </Grid>
      <Textarea label="Remark" {...registerInput("remark")} />
      <Title order={5}>Attachments</Title>
      <AttachmentsEditor
        attachments={formState.attachments}
        setAttachments={a => setFormValue("attachments", a)}
      />
      <Group justify="right">
        <Button leftSection={<IconX />} onClick={closeEditPage}>
          Cancel
        </Button>
        <Button
          leftSection={<IconDeviceFloppy />}
          loading={loading}
          onClick={onSubmit}
        >
          Save
        </Button>
      </Group>
    </Stack>
  );
};
export default ExamMetadataEditor;
