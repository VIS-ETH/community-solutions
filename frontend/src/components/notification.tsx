import {
  ActionIcon,
  Anchor,
  Badge,
  Card,
  Group,
  Text,
  Title,
} from "@mantine/core";
import { lightFormat, parseISO } from "date-fns";
import * as React from "react";
import { Link } from "react-router-dom";
import GlobalConsts from "../globalconsts";
import MarkdownText from "./markdown-text";
import { IconLink } from "@tabler/icons-react";
import type { NotificationResponse } from "../api/model";

interface Props {
  notification: NotificationResponse;
}

const NotificationComponent: React.FC<Props> = ({ notification }) => {
  return (
    <div>
      <Card withBorder shadow="md" my="sm">
        <Card.Section p="md" mb="md" withBorder>
          <Group justify="space-between">
            <div>
              <Title order={4}>
                <Anchor component={Link} to={notification.link}>
                  {notification.title}
                </Anchor>
              </Title>
              <Group gap={0}>
                <Anchor
                  component={Link}
                  to={`/user/${notification.sender.username}`}
                >
                  {notification.sender.display_name}
                </Anchor>
                <Text mx={6} component="span">
                  •
                </Text>
                <Text>
                  {lightFormat(
                    parseISO(notification.time),
                    GlobalConsts.dateFNSFormatString,
                  )}
                </Text>
                {!notification.read && (
                  <Badge ml="sm" component="span" color="red">
                    Unread
                  </Badge>
                )}
              </Group>
            </div>
            <ActionIcon component={Link} to={notification.link}>
              <IconLink />
            </ActionIcon>
          </Group>
        </Card.Section>
        <MarkdownText value={notification.message} />
      </Card>
    </div>
  );
};
export default NotificationComponent;
