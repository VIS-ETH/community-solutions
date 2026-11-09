import { useRequest } from "ahooks";
import {
  Alert,
  Button,
  Checkbox,
  CloseButton,
  Grid,
  Group,
  NativeSelect,
  Stack,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import React from "react";
import useForm from "../hooks/useForm";
import useInitialState from "../hooks/useInitialState";
import { createOptions, options } from "../utils/ts-utils";
import AttachmentsEditor, { EditorAttachment } from "./attachments-editor";
import OfferedInEditor from "./offered-in-editor";
import UserSetEditor from "./user-set-editor";
import { IconDeviceFloppy, IconX } from "@tabler/icons-react";
import { CategoryData, CategoryDataAttachment } from "../api/model";
import {
  editAttachment,
  removeAttachment,
  uploadAttachment,
} from "../api/hooks/filestore";
import {
  addMetaCategory,
  addUserToCategorySet,
  removeMetaCategory,
  removeUserFromCategorySet,
  setCategoryMetadata,
} from "../api/hooks/categories";

export interface CategoryMetaDataDraft extends Omit<
  CategoryData,
  "attachments"
> {
  attachments: EditorAttachment[];
}

const applyChanges = async (
  slug: string,
  oldMetaData: CategoryData,
  newMetaData: CategoryMetaDataDraft,
  oldOfferedIn: (readonly [string, string])[],
  newOfferedIn: (readonly [string, string])[],
) => {
  const metaDataDiff: Partial<CategoryData> = {};
  if (oldMetaData.displayname !== newMetaData.displayname)
    metaDataDiff.displayname = newMetaData.displayname;
  if (oldMetaData.semester !== newMetaData.semester)
    metaDataDiff.semester = newMetaData.semester;
  if (oldMetaData.form !== newMetaData.form)
    metaDataDiff.form = newMetaData.form;
  if (oldMetaData.remark !== newMetaData.remark)
    metaDataDiff.remark = newMetaData.remark;
  if (oldMetaData.has_payments !== newMetaData.has_payments)
    metaDataDiff.has_payments = newMetaData.has_payments;
  if (oldMetaData.more_exams_link !== newMetaData.more_exams_link)
    metaDataDiff.more_exams_link = newMetaData.more_exams_link;
  if (oldMetaData.permission !== newMetaData.permission)
    metaDataDiff.permission = newMetaData.permission;
  const fetchedMetaData = await setCategoryMetadata(slug, metaDataDiff);
  const newSlug = fetchedMetaData.value.slug;
  const newAttachments: CategoryDataAttachment[] = [];
  for (const attachment of newMetaData.attachments) {
    if (attachment.filename instanceof File) {
      const { value: uploadResponse } = await uploadAttachment({
        category: newSlug,
        displayname: attachment.displayname,
        file: attachment.filename,
      });
      newAttachments.push({
        displayname: attachment.displayname,
        filename: uploadResponse.filename,
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
      await editAttachment(attachment.filename, {
        displayname: foundAttachment.displayname,
      });
      newAttachments.push({
        displayname: foundAttachment.displayname,
        filename: attachment.filename,
      });
    }
  }
  for (const [newMeta1, newMeta2] of newOfferedIn) {
    if (
      !oldOfferedIn.some(
        ([meta1, meta2]) => meta1 === newMeta1 && meta2 === newMeta2,
      )
    ) {
      await addMetaCategory({
        category: newSlug,
        meta1: newMeta1,
        meta2: newMeta2,
      });
    }
  }
  for (const [oldMeta1, oldMeta2] of oldOfferedIn) {
    if (
      !newOfferedIn.some(
        ([meta1, meta2]) => meta1 === oldMeta1 && meta2 === oldMeta2,
      )
    ) {
      await removeMetaCategory({
        category: newSlug,
        meta1: oldMeta1,
        meta2: oldMeta2,
      });
    }
  }
  for (const admin of newMetaData.admins) {
    if (!oldMetaData.admins.includes(admin)) {
      await addUserToCategorySet(newSlug, {
        key: "admins",
        user: admin,
      });
    }
  }
  for (const admin of oldMetaData.admins) {
    if (!newMetaData.admins.includes(admin)) {
      await removeUserFromCategorySet(newSlug, {
        key: "admins",
        user: admin,
      });
    }
  }

  for (const expert of newMetaData.experts) {
    if (!oldMetaData.experts.includes(expert)) {
      await addUserToCategorySet(newSlug, {
        key: "experts",
        user: expert,
      });
    }
  }
  for (const expert of oldMetaData.experts) {
    if (!newMetaData.experts.includes(expert)) {
      await removeUserFromCategorySet(newSlug, {
        key: "experts",
        user: expert,
      });
    }
  }
  return {
    ...oldMetaData,
    ...metaDataDiff,
    attachments: newAttachments,
    admins: newMetaData.admins,
    experts: newMetaData.experts,
    slug: newSlug,
  };
};

const semesterOptions = createOptions({
  None: "--",
  HS: "HS",
  FS: "FS",
  Both: "Both",
});
const formOptions = createOptions({
  oral: "Oral",
  written: "Written",
});
const permissionOptions = createOptions({
  public: "public",
  intern: "intern",
  hidden: "hidden",
  none: "none",
});

interface CategoryMetaDataEditorProps {
  currentMetaData: CategoryData;
  onMetaDataChange: (newMetaData: CategoryData) => void;
  close: () => void;
  offeredIn: (readonly [string, string])[];
}
const CategoryMetaDataEditor: React.FC<CategoryMetaDataEditorProps> = ({
  onMetaDataChange,
  currentMetaData,
  close,
  offeredIn: propOfferedIn,
}) => {
  const {
    error,
    loading,
    run: runApplyChanges,
  } = useRequest(applyChanges, {
    manual: true,
    onSuccess: newMetaData => {
      close();
      onMetaDataChange(newMetaData);
    },
  });
  const [offeredIn, setOfferedIn] =
    useInitialState<(readonly [string, string])[]>(propOfferedIn);
  const {
    registerInput,
    registerCheckbox,
    reset,
    formState,
    setFormValue,
    onSubmit,
  } = useForm(currentMetaData as CategoryMetaDataDraft, data => {
    void runApplyChanges(
      currentMetaData.slug,
      currentMetaData,
      data,
      propOfferedIn,
      offeredIn,
    );
  });
  return (
    <>
      <Group justify="space-between">
        <h2>Edit Category</h2>
        <CloseButton onClick={close} />
      </Group>
      {error && <Alert color="red">{error.toString()}</Alert>}
      <Title order={4} mb="xs">
        Metadata
      </Title>
      <Stack>
        <TextInput
          disabled={currentMetaData.slug === "default"}
          label="Name"
          {...registerInput("displayname")}
        />
        <Grid>
          <Grid.Col span={{ md: 6 }}>
            <NativeSelect
              label="Semester"
              data={options(semesterOptions)}
              value={
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                semesterOptions[
                  formState.semester as keyof typeof semesterOptions
                  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                ]?.value ?? "--"
              }
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                setFormValue("semester", event.currentTarget.value)
              }
            />
          </Grid.Col>
          <Grid.Col span={{ md: 6 }}>
            <NativeSelect
              label="Form"
              data={options(formOptions)}
              value={
                formOptions[formState.form as keyof typeof formOptions].value
              }
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                setFormValue("form", event.currentTarget.value)
              }
            />
          </Grid.Col>
        </Grid>
        <Textarea label="Remark" {...registerInput("remark")} />
        <Grid>
          <Grid.Col span={{ md: 6 }}>
            <NativeSelect
              label="Permission"
              data={options(permissionOptions)}
              value={
                permissionOptions[
                  formState.permission as keyof typeof permissionOptions
                ].value
              }
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                setFormValue("permission", event.currentTarget.value)
              }
            />
          </Grid.Col>
          <Grid.Col span={{ md: 6 }}>
            <TextInput
              type="url"
              label="More Exams Link"
              {...registerInput("more_exams_link")}
            />
          </Grid.Col>
        </Grid>
        <Checkbox
          name="check"
          label="Has Payments"
          {...registerCheckbox("has_payments")}
        />
      </Stack>
      <Title order={4} mt="xl" mb="sm">
        Attachments
      </Title>
      <AttachmentsEditor
        attachments={formState.attachments}
        setAttachments={a => setFormValue("attachments", a)}
      />
      <Title order={4} mt="xl" mb="sm">
        Offered In
      </Title>
      <OfferedInEditor offeredIn={offeredIn} setOfferedIn={setOfferedIn} />
      <Title order={4} mt="xl" mb="sm">
        Admins
      </Title>
      <UserSetEditor
        users={formState.admins}
        setUsers={u => setFormValue("admins", u)}
      />
      <Title order={4} mt="xl" mb="sm">
        Experts
      </Title>
      <UserSetEditor
        users={formState.experts}
        setUsers={e => setFormValue("experts", e)}
      />
      <Group mt="lg" justify="right">
        <Button
          leftSection={<IconX />}
          onClick={() => {
            reset();
            close();
          }}
        >
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
    </>
  );
};
export default CategoryMetaDataEditor;
