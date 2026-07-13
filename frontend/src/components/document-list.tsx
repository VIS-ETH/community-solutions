import { Button, Paper, Tooltip, Title } from "@mantine/core";
import React, { Fragment, useMemo } from "react";
import CreateDocumentForm from "./create-document-modal";
import Grid from "./grid";
import DocumentCard from "./document-card";
import { IconPlus } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import classes from "../utils/focus-outline.module.css";
import { clsx } from "clsx";
import { useListDocuments, useListDocumentTypes } from "../api/hooks/documents";
import type { DocumentListSchema } from "../api/model/documentListSchema";
import type { DocumentSchema } from "../api/model/documentSchema";

interface Props {
  slug: string;
}

// Take list of documents and mutate it
// into a record<document-type, documents[]>
function splitDocuments(
  documents: DocumentListSchema,
): Record<string, readonly DocumentSchema[]> {
  const grouped: Record<string, DocumentSchema[]> = {};
  for (const document of documents.value) {
    grouped[document.document_type] ??= [];
    grouped[document.document_type].push(document);
  }

  for (const documents of Object.values(grouped)) {
    documents.sort(
      (a, b) =>
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        b.like_count! - a.like_count! ||
        a.display_name.localeCompare(b.display_name),
    );
  }

  return grouped;
}

const DocumentList: React.FC<Props> = ({ slug }) => {
  const [isOpen, { open, close }] = useDisclosure();
  const documents = useListDocuments({
    category: slug,
  });
  const docTypes = useListDocumentTypes();
  const splitDocs = useMemo(
    () => (documents.isSuccess ? splitDocuments(documents.data) : undefined),
    [documents.isSuccess, documents.data],
  );

  return (
    <>
      <CreateDocumentForm isOpen={isOpen} categorySlug={slug} onClose={close} />
      <Title order={2} mt="xl" mb="lg">
        Documents
      </Title>
      {docTypes.isSuccess &&
        docTypes.data.value.map(
          type =>
            splitDocs?.[type] && (
              <Fragment key={type}>
                {type !== "Documents" && (
                  <Title order={3} mt="xl" mb="lg">
                    {type}
                  </Title>
                )}
                <Grid>
                  {splitDocs[type].map(document => (
                    <DocumentCard key={document.slug} document={document} />
                  ))}
                </Grid>
              </Fragment>
            ),
        )}
      <Title order={3} mt="xl" mb="lg">
        Add Documents
      </Title>
      <Grid>
        <Paper
          className={clsx(classes.focusOutline, classes.hoverShadow)}
          style={{ minHeight: "6em" }}
        >
          <Tooltip label="Add Document Bundle">
            <Button
              style={{ width: "100%", height: "100%" }}
              onClick={open}
              leftSection={<IconPlus />}
            >
              Add Document Bundle
            </Button>
          </Tooltip>
        </Paper>
      </Grid>
    </>
  );
};
export default DocumentList;
