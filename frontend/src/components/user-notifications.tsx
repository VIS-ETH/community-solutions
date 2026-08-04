import { Button, Alert, Loader } from "@mantine/core";
import React, { useEffect, useState } from "react";
import NotificationComponent from "./notification";
import {
  useGetAllNotifications,
  useMarkAllNotificationsAsRead,
} from "../api/hooks/notifications";

const UserNotifications: React.FC = () => {
  const [showUnread, setShowUnread] = useState(true);

  const {
    data: notifications,
    error,
    isLoading,
  } = useGetAllNotifications(
    {
      unread: showUnread,
    },
    {
      query: {
        select: data => data.value,
      },
    },
  );

  const markAllNotificationsAsRead = useMarkAllNotificationsAsRead();

  useEffect(() => {
    if (
      notifications &&
      notifications.length > 0 &&
      markAllNotificationsAsRead.isIdle
    ) {
      void markAllNotificationsAsRead.mutate();
    }
  }, [markAllNotificationsAsRead, notifications]);

  return (
    <div>
      <h3>Notifications</h3>
      {error && <Alert color="red">{error as unknown as string}</Alert>}
      <Button mb="sm" onClick={() => setShowUnread(prev => !prev)}>
        {showUnread ? "Show all" : "Show unread"}
      </Button>
      {!isLoading && notifications?.length === 0 && (
        <Alert my="sm" color="gray">
          No notifications
        </Alert>
      )}
      {isLoading && <Loader />}
      {notifications?.map(notification => (
        <NotificationComponent
          notification={notification}
          key={notification.oid}
        />
      ))}
    </div>
  );
};
export default UserNotifications;
