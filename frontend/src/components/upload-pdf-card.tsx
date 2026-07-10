import {
  Alert,
  Button,
  Card,
  FileInput,
  Select,
  Stack,
  TextInput,
  Title,
} from "@mantine/core";
import { IconCloudUpload } from "@tabler/icons-react";
import { useRequest } from "ahooks";
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadCategories, uploadPdf } from "../api/hooks";

interface UploadPdfFormProps {
  category?: string;
}

export const UploadPdfForm: React.FC<UploadPdfFormProps> = ({
  category: givenCategory,
}) => {
  const navigate = useNavigate();
  const {
    error: categoriesError,
    loading: categoriesLoading,
    data: categories,
  } = useRequest(loadCategories, {
    manual: !!givenCategory,
  });
  const {
    error: uploadError,
    loading: uploadLoading,
    run: upload,
  } = useRequest(uploadPdf, {
    manual: true,
    onSuccess: filename => void navigate(`/exams/${filename}`),
  });
  const [validationError, setValidationError] = useState("");
  const error = categoriesError ?? uploadError ?? validationError;
  const loading = categoriesLoading || uploadLoading;
  const options = useMemo(
    () =>
      categories?.map(category => ({
        value: category.slug,
        label: category.displayname,
      })) ?? [],
    [categories],
  );
  const [file, setFile] = useState<File | null>();
  const [displayname, setDisplayname] = useState("");
  const [category, setCategory] = useState<string | undefined>();
  const onSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    const actualCategory = givenCategory ?? category;
    if (file && actualCategory) {
      void upload(file, displayname, actualCategory);
    } else if (file === undefined) {
      setValidationError("No file selected");
    } else {
      setValidationError("No category selected");
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <Stack mt="sm">
        {error && <Alert color="red">{error.toString()}</Alert>}
        <FileInput
          label="File"
          placeholder="Click to choose file..."
          leftSection={<IconCloudUpload />}
          value={file}
          onChange={setFile}
          accept="application/pdf"
        />
        <TextInput
          label="Name"
          placeholder="Name"
          value={displayname}
          onChange={e => setDisplayname(e.currentTarget.value)}
          required
        />
        {!givenCategory && (
          <Select
            label="Category"
            placeholder="Choose category..."
            searchable
            nothingFoundMessage="No category found"
            data={options}
            onChange={(value: string | null) => value && setCategory(value)}
            required
          />
        )}
        <Button type="submit" loading={loading}>
          Submit
        </Button>
      </Stack>
    </form>
  );
};

const UploadPdfCard: React.FC = () => (
  <Card withBorder shadow="md">
    <Card.Section withBorder p="md">
      <Title order={4}>Upload PDF</Title>
    </Card.Section>
    <UploadPdfForm />
  </Card>
);

export default UploadPdfCard;
