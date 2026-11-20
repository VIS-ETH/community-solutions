import { Container } from "@mantine/core";
import React from "react";
import MarkdownText from "./markdown-text";
import { useQuery } from "@tanstack/react-query";

interface DocumentMarkdownProps {
  url: string;
}
const DocumentMarkdown: React.FC<DocumentMarkdownProps> = ({ url }) => {
  const { error, data } = useQuery({
    queryKey: ["document-markdown", url],
    async queryFn({ signal }) {
      const response = await fetch(url, { signal });
      if (!response.ok)
        throw new Error(`Failed to load markdown (${response.status}).`);
      return response.text();
    },
  });

  return (
    <Container py="sm">
      {error && "Error loading Markdown"}
      {data !== undefined &&
        (data.length > 0 ? (
          <MarkdownText value={data} />
        ) : (
          "This document currently doesn't have any content."
        ))}
    </Container>
  );
};

export default DocumentMarkdown;
