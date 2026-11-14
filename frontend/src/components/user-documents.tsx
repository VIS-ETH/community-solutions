import React from "react";
import { Alert, Loader } from "@mantine/core";
import Grid from "../components/grid";
import { useUser } from "../auth";
import DocumentCard from "./document-card";
import type { DocumentSchema } from "../api/model/documentSchema";
import { useListDocuments } from "../api/hooks/documents";
import { UserInfoResponse } from "../api/model";

interface UserDocumentsProps {
  username: string;
  userInfo?: UserInfoResponse;
}
const UserDocuments: React.FC<UserDocumentsProps> = ({
  username,
  userInfo,
}) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const user = useUser()!;
  const isMyself = user.user?.username === username;
  const documents = useListDocuments({
    username,
  });
  const likedDocuments = useListDocuments(
    {
      liked_by: username,
    },
    {
      query: {
        enabled: isMyself,
      },
    },
  );
  const displayDocuments = (documents: DocumentSchema[]) => {
    return (
      <Grid>
        {documents.map(document => (
          <DocumentCard key={document.slug} document={document} showCategory />
        ))}
      </Grid>
    );
  };
  return (
    <>
      <h3>
        {isMyself ? "Your" : `${userInfo?.displayName ?? `@${username}`}'s`}{" "}
        Documents
      </h3>
      {documents.isError && (
        <Alert color="red">{documents.error.message}</Alert>
      )}
      {documents.data && displayDocuments(documents.data)}
      {(!documents.data || documents.data.length === 0) && (
        <Alert color="gray">No documents</Alert>
      )}
      {documents.isLoading && <Loader />}

      {isMyself && (
        <>
          <h3>Liked Documents</h3>
          {likedDocuments.isError && (
            <Alert color="red">{likedDocuments.error.message}</Alert>
          )}
          {likedDocuments.data && displayDocuments(likedDocuments.data)}
          {(!likedDocuments.data || likedDocuments.data.length === 0) && (
            <Alert color="gray">No liked documents</Alert>
          )}
          {likedDocuments.isLoading && <Loader />}
        </>
      )}
    </>
  );
};

export default UserDocuments;
