import { Anchor, Text } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import React from "react";
import { Link } from "react-router-dom";
import { RECENT_EXAMS_KEY, RecentExam } from "../utils/recently-viewed-exams";

const RecentlyViewedExams: React.FC = () => {
  const [recentExams] = useLocalStorage<RecentExam[]>({
    key: RECENT_EXAMS_KEY,
    defaultValue: [],
    getInitialValueInEffect: false,
  });

  if (recentExams.length === 0) return null;

  return (
    <Text size="sm" pt="sm">
      <Text component="span" c="dimmed">
        Recently viewed:{" "}
      </Text>
      {recentExams.map((exam, i) => (
        <React.Fragment key={exam.filename}>
          {i > 0 && (
            <Text component="span" c="dimmed">
              {" "}
              /{" "}
            </Text>
          )}
          <Anchor component={Link} to={`/exams/${exam.filename}`} size="sm">
            {exam.category_displayname} {exam.displayname}
          </Anchor>
        </React.Fragment>
      ))}
    </Text>
  );
};
export default RecentlyViewedExams;
