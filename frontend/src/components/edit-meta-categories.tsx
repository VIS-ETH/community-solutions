import { useDisclosure } from "@mantine/hooks";
import useInitialState from "../hooks/useInitialState";
import { useEffect, useMemo } from "react";
import {
  ActionIcon,
  Button,
  Flex,
  Loader,
  Modal,
  Stack,
  TextInput,
} from "@mantine/core";
import { IconEdit, IconTrash } from "@tabler/icons-react";
import Creatable from "./creatable";
import type { Meta1CategoryResponse } from "../api/model";
import {
  useDeleteMetaCategory1,
  useDeleteMetaCategory2,
  useEditMetaCategory1,
  useEditMetaCategory2,
} from "../api/hooks/categories";

interface EditMeta1Props {
  data: Meta1CategoryResponse[] | undefined;
  oldMeta1: string;
  onChange: () => void;
}
export const EditMeta1: React.FC<EditMeta1Props> = ({
  data,
  oldMeta1,
  onChange,
}) => {
  const [editModal, { open: openEditModal, close: closeEditModal }] =
    useDisclosure();
  const [deleteModal, { open: openDeleteModal, close: closeDeleteModal }] =
    useDisclosure();
  const [meta1, setMeta1] = useInitialState(oldMeta1);
  const [disabled, setDisabled] = useInitialState(true);
  const editMeta1 = useEditMetaCategory1({
    mutation: {
      onSuccess() {
        closeEditModal();
        onChange();
      },
    },
  });
  const deleteMeta1 = useDeleteMetaCategory1({
    mutation: {
      onSuccess() {
        onChange();
      },
    },
  });
  const onSubmit = () => {
    editMeta1.mutate({
      data: {
        oldmeta1: oldMeta1,
        newmeta1: meta1,
      },
    });
  };
  const onDelete = () => {
    deleteMeta1.mutate({
      data: {
        meta1: oldMeta1,
      },
    });
  };
  const meta1Options: string[] = useMemo(
    () => data?.map(d => d.displayname) ?? [],
    [data],
  );
  const onTextChange = (input: string) => {
    setMeta1(input);
    if (meta1Options.includes(input)) {
      setDisabled(true);
    } else {
      setDisabled(false);
    }
  };

  return (
    <>
      <Modal
        opened={deleteModal}
        onClose={closeDeleteModal}
        title="Delete Meta Category"
      >
        <Stack>
          Are you sure you want to delete this meta category?
          <b>This is irreversible.</b>
          Note: This action will also delete the sub meta categories but won't
          delete the categories themselves.
          <Flex gap={"lg"}>
            <Button flex={1} onClick={onDelete} color="red">
              Delete
            </Button>
            <Button flex={1} onClick={closeDeleteModal}>
              Cancel
            </Button>
          </Flex>
        </Stack>
      </Modal>
      <Modal
        opened={editModal}
        onClose={closeEditModal}
        title="Edit Meta Category"
      >
        <Stack>
          <TextInput
            label="Meta Category Name"
            type="text"
            value={meta1}
            onChange={e => {
              onTextChange(e.currentTarget.value);
            }}
          />
          <Button
            onClick={onSubmit}
            disabled={meta1.length === 0 || editMeta1.isPending || disabled}
          >
            {editMeta1.isPending ? <Loader /> : "Edit Meta Category"}
          </Button>
        </Stack>
      </Modal>

      <ActionIcon onClick={openEditModal}>
        <IconEdit />
      </ActionIcon>
      <ActionIcon onClick={openDeleteModal}>
        <IconTrash />
      </ActionIcon>
    </>
  );
};

interface EditMeta2Props {
  data: Meta1CategoryResponse[] | undefined;
  oldMeta2: string;
  meta1: string;
  onChange: () => void;
}

export const EditMeta2: React.FC<EditMeta2Props> = ({
  data,
  oldMeta2,
  meta1,
  onChange,
}) => {
  const [editModal, { open: openEditModal, close: closeEditModal }] =
    useDisclosure();
  const [deleteModal, { open: openDeleteModal, close: closeDeleteModal }] =
    useDisclosure();
  const [disabled, setDisabled] = useInitialState(true);
  const editMeta2 = useEditMetaCategory2({
    mutation: {
      onSuccess() {
        closeEditModal();
        onChange();
      },
    },
  });
  const deleteMeta2 = useDeleteMetaCategory2({
    mutation: {
      onSuccess() {
        onChange();
      },
    },
  });

  const [newMeta1, setNewMeta1] = useInitialState(meta1);
  const [newMeta2, setNewMeta2] = useInitialState(oldMeta2);
  const meta1Options: string[] = useMemo(
    () => data?.map(d => d.displayname) ?? [],
    [data],
  );
  const meta2Options: string[] = useMemo(
    () =>
      data && newMeta1.length > 0
        ? (data
            .find(m => m.displayname === newMeta1)
            ?.meta2.map(m => m.displayname) ?? [])
        : [],
    [data, newMeta1],
  );

  const onMeta1Change = (value: string) => {
    setNewMeta1(value);
    checkIfExists();
  };
  const onMeta1Create = (value: string) => {
    setNewMeta1(value);
    checkIfExists();
    return value;
  };
  const onSubmit = () => {
    editMeta2.mutate({
      data: {
        meta1,
        newmeta1: newMeta1,
        newmeta2: newMeta2,
        oldmeta2: oldMeta2,
      },
    });
  };
  const onDelete = () => {
    deleteMeta2.mutate({
      data: {
        meta1,
        meta2: oldMeta2,
      },
    });
  };
  const onTextChange = (input: string) => {
    setNewMeta2(input);
    checkIfExists();
  };
  const checkIfExists = () => {
    if (meta2Options.includes(newMeta2)) {
      setDisabled(true);
    } else {
      setDisabled(false);
    }
  };

  useEffect(checkIfExists, [meta2Options, newMeta2, setDisabled]);

  return (
    <>
      <Modal
        opened={deleteModal}
        onClose={closeDeleteModal}
        title="Delete Meta Category"
      >
        <Stack>
          Are you sure you want to delete this meta category?
          <b>This is irreversible.</b>
          Note: This action won't delete the categories themselves.
          <Flex gap={"lg"}>
            <Button flex={1} onClick={onDelete} color="red">
              Delete
            </Button>
            <Button flex={1} onClick={closeDeleteModal}>
              Cancel
            </Button>
          </Flex>
        </Stack>
      </Modal>
      <Modal
        opened={editModal}
        onClose={closeEditModal}
        title="Edit Meta Category"
        size="md"
      >
        <Stack gap={"lg"}>
          <TextInput
            label="Meta Category Name"
            type="text"
            value={newMeta2}
            onChange={e => onTextChange(e.currentTarget.value)}
          />
          <Creatable
            title="Edit Parent"
            getCreateLabel={(query: string) =>
              `+ Create new Parent Meta Category "${query}"`
            }
            data={meta1Options}
            value={newMeta1}
            onChange={onMeta1Change}
            onCreate={onMeta1Create}
            withinPortal={true}
          />
          <Button
            onClick={onSubmit}
            disabled={newMeta2.length === 0 || editMeta2.isPending || disabled}
          >
            {editMeta2.isPending ? <Loader /> : "Edit Meta Category"}
          </Button>
        </Stack>
      </Modal>

      <ActionIcon onClick={openEditModal}>
        <IconEdit />
      </ActionIcon>
      <ActionIcon onClick={openDeleteModal}>
        <IconTrash />
      </ActionIcon>
    </>
  );
};
