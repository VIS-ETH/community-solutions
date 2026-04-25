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
import { UserInfo, UserCategoryScore } from "../interfaces";
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
import { useRequest } from "ahooks";
import { fetchGet } from "../api/fetch-utils";

interface UserScoreCardProps {
  username?: string;
  userInfo?: UserInfo;
  isMyself: boolean;
}

interface DemoProps {
  data: { category: string; Scores: number }[] | undefined;
}

const loadUserCategories = async (username: string) => {
  return (await fetchGet(`/api/scoreboard/usercategories/${username}/`))
    .value as UserCategoryScore[];
};

function scoreCard(
  userInfo: UserInfo | undefined,
  title: string,
  key: keyof UserInfo,
  Icon: React.ForwardRefExoticComponent<
    Omit<IconProps, "ref"> & React.RefAttributes<Icon>
  >,
) {
  return (
    <Paper shadow="md" withBorder px="md" py="lg" pos="relative">
      <LoadingOverlay visible={!userInfo} />
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
    </Paper>
  );
}      

function Demo(
  {data}: DemoProps
) {
  console.log("radarData", data);
  if(!data) return null;
  return (
    <RadarChart
      h={300}
      data = {data}
      dataKey = "category"
      withPolarRadiusAxis
      series={[{ name: 'Scores', color: 'yellow.4', opacity: 0.2 }]}
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
  const { data: categoryData } = useRequest(() => loadUserCategories(username ?? ""), {
        refreshDeps: [username],
      });
  const radarData = categoryData?.map(item => ({
      category: item.answer_section__exam__category__meta_categories__displayname,
      Scores: item.count,
  }));
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
      <SimpleGrid cols={{ base: 1, xs: 2 }}>
        <SimpleGrid cols={{ base: 1, xs: 2, sm: 3 }}>
          {scoreCard(userInfo, "Score", "score", IconChevronUp)}
          {scoreCard(userInfo, "Answers", "score_answers", IconPencil)}
          {scoreCard(userInfo, "Comments", "score_comments", IconMessage)}
          {scoreCard(userInfo, "Documents", "score_documents", IconFile)}
          {userInfo &&
            userInfo.score_cuts > 0 &&
            scoreCard(userInfo, "Exam Import", "score_cuts", IconFileUpload)}
          {userInfo &&
            userInfo.score_legacy > 0 &&
            scoreCard(userInfo, "Legacy Answers", "score_legacy", IconPencilCog)}
        </SimpleGrid>
        <Demo data={radarData} />
      </SimpleGrid>
    </>
  );
};
export default UserScoreCard;
