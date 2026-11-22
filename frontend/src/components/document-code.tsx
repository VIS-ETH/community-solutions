import { Container } from "@mantine/core";
import React from "react";
import CodeBlock from "./code-block";
import { useQuery } from "@tanstack/react-query";

interface DocumentCodeProps {
  url: string;
}
const DocumentCode: React.FC<DocumentCodeProps> = ({ url }) => {
  const { data } = useQuery({
    queryKey: ["document-code", url],
    async queryFn({ signal }) {
      const response = await fetch(url, { signal });
      if (!response.ok)
        throw new Error(`Failed to load document (${response.status}).`);
      return response.text();
    },
    refetchOnWindowFocus: false,
  });

  return (
    <Container size="xl" py="sm">
      {data !== undefined &&
        (data.length > 0 ? (
          <CodeBlock value={data} language="tex" />
        ) : (
          "This document currently doesn't have any content."
        ))}
    </Container>
  );
};

export default DocumentCode;
