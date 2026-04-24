import {
  Button,
  Container,
  SimpleGrid,
  Text,
  Group,
  Paper,
  LoadingOverlay,
  Title,
  Divider
} from "@mantine/core";
import { RadarChart } from '@mantine/charts';
import React, { ReactNode } from "react";
import { logout } from "../api/fetch-utils";
import { useSetUser, useUser } from "../auth";
import { UserInfo } from "../interfaces";
import {
  Icon,
  IconChevronUp,
  IconFile,
  IconFileUpload,
  IconLogout,
  IconMessage,
  IconPencil,
  IconPencilCog,
  IconProps,
} from "@tabler/icons-react";

interface UserScoreCardProps {
  username?: string;
  userInfo?: UserInfo;
  isMyself: boolean;
}

interface DemoProps {
  userInfo: UserInfo | undefined;
}

function scoreCard(
  userInfo: UserInfo | undefined,
  title: string,
  key: keyof UserInfo,
  Icon: React.ForwardRefExoticComponent<
    Omit<IconProps, "ref"> & React.RefAttributes<Icon>
  >,
) {
  return (
    <div style={{ flex: 1, padding: "var(--mantine-spacing-lg) var(--mantine-spacing-md)" }}>
      <Group justify="space-between" mb="xs">
        <Text inline size="xs" tt="uppercase" component="p" c="dimmed">
          {title}
        </Text>
        <Icon
          style={{
            width: "1em",
            height: "1em",
            color: "var(--mantine-color-dimmed)",
          }}
        />
      </Group>
      <Text lh={1} fz="2rem" fw={600}>
        {userInfo ? userInfo[key] : "-"}
      </Text>
    </div>
  );
}      

function Demo(
  {userInfo} : DemoProps
) {
  if(!userInfo) return null;
  const data = [
  { category: "Score",     Scores: userInfo.score },
  { category: "Answers",   Scores: userInfo.score_answers },
  { category: "Comments",  Scores: userInfo.score_comments },
  { category: "Documents", Scores: userInfo.score_documents },
  ...(userInfo.score_cuts > 0   ? [{ category: "Exam Import", Scores: userInfo.score_cuts }]   : []),
  ...(userInfo.score_legacy > 0 ? [{ category: "Legacy",      Scores: userInfo.score_legacy }] : []),
  ];
  return (
    <RadarChart
      h={300}
      data = {data}
      dataKey = "category"
      withPolarRadiusAxis
      series={[{ name: 'Scores', color: 'blue.4', opacity: 0.2 }]}
    />
  );
}

const UserScoreCard: React.FC<UserScoreCardProps> = ({
  username,
  userInfo,
  isMyself,
}) => {
  const setUser = useSetUser();
  const user = useUser()!;
  return (
    <>
      <Group justify="space-between" my="lg">
        <Title order={1}>{userInfo?.displayName ?? username}</Title>

        {isMyself && (
          <Group>
            {(user.isAdmin || localStorage.getItem("simulate_nonadmin")) && (
              <Button
                onClick={() => {
                  if (user.isAdmin) {
                    localStorage.setItem("simulate_nonadmin", "true");
                  } else {
                    localStorage.removeItem("simulate_nonadmin");
                  }
                  setUser(undefined);
                }}
              >
                {user.isAdmin
                  ? "View without admin privileges"
                  : "View with admin privileges"}
              </Button>
            )}
            <Button leftSection={<IconLogout />} onClick={() => logout("/")}>
              Log out
            </Button>
          </Group>
        )}
      </Group>

        <Paper withBorder shadow="sm" pos="relative">
          <LoadingOverlay visible={!userInfo} />
          <Group align="stretch" gap={0} wrap="nowrap">
            {scoreCard(userInfo, "Score", "score", IconChevronUp)}
            <Divider orientation="vertical" />
            {scoreCard(userInfo, "Answers", "score_answers", IconPencil)}
            <Divider orientation="vertical" />
            {scoreCard(userInfo, "Comments", "score_comments", IconMessage)}
            <Divider orientation="vertical" />
            {scoreCard(userInfo, "Documents", "score_documents", IconFile)}
            {userInfo && userInfo.score_cuts > 0 && (
              <>
                <Divider orientation="vertical" />
                {scoreCard(userInfo, "Exam Import", "score_cuts", IconFileUpload)}
              </>
            )}
            {userInfo && userInfo.score_legacy > 0 && (
              <>
                <Divider orientation="vertical" />
                {scoreCard(userInfo, "Legacy Answers", "score_legacy", IconPencilCog)}
              </>
            )}
          </Group>
        </Paper>
    </>
  );
};
export default UserScoreCard;
