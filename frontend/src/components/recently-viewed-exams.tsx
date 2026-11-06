import { Anchor, Text } from "@mantine/core";
import React from "react";
import { Link } from "react-router-dom";
import { useRecentExams } from "../utils/recently-viewed-exams";

const RecentlyViewedExams: React.FC = () => {
  const [recentExams] = useRecentExams();

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
