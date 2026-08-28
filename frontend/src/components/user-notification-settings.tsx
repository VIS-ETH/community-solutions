import { Alert, Checkbox, Stack } from "@mantine/core";
import React from "react";
import {
  useEnableNotification,
  useGetEnabledNotifications,
} from "../api/hooks/notifications";
import type { EnableNotificationBodyType } from "../api/model";

const UserNotificationsSettings: React.FC = () => {
  const enabled = useGetEnabledNotifications({
    query: {
      select: data => new Set(data.value),
    },
  });
  const setEnabled = useEnableNotification({
    mutation: {
      onSuccess() {
        void enabled.refetch();
      },
    },
  });

  function handleSetEnabled(
    type: EnableNotificationBodyType,
    enabled: boolean,
  ) {
    setEnabled.mutate({
      data: {
        type,
        enabled,
      },
    });
  }

  const error = enabled.error ?? setEnabled.error;
  const checkboxLoading = enabled.isLoading || setEnabled.isPending;
  return (
    <>
      <h3>Notifications</h3>
      {error && <Alert color="red">{error as unknown as string}</Alert>}
      <Stack gap="sm">
        <Checkbox
          label="Comment to my answer"
          checked={enabled.data?.has(1)}
          disabled={checkboxLoading}
          onChange={e => handleSetEnabled(1, e.currentTarget.checked)}
        />
        <Checkbox
          label="Comment to my comment"
          checked={enabled.data?.has(2)}
          disabled={checkboxLoading}
          onChange={e => handleSetEnabled(2, e.currentTarget.checked)}
        />
        <Checkbox
          label="Other answer to same question"
          checked={enabled.data?.has(3)}
          disabled={checkboxLoading}
          onChange={e => handleSetEnabled(3, e.currentTarget.checked)}
        />
        <Checkbox
          label="Comment to my document"
          checked={enabled.data?.has(4)}
          disabled={checkboxLoading}
          onChange={e => handleSetEnabled(4, e.currentTarget.checked)}
        />
        <Checkbox
          label="Admin comments on my feedback"
          checked={enabled.data?.has(5)}
          disabled={checkboxLoading}
          onChange={e => handleSetEnabled(5, e.currentTarget.checked)}
        />
        <Checkbox
          label="New document transfer or document transfer accepted"
          checked={enabled.data?.has(6)}
          disabled={checkboxLoading}
          onChange={e => handleSetEnabled(6, e.currentTarget.checked)}
        />
      </Stack>
    </>
  );
};
export default UserNotificationsSettings;
