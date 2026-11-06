import { useLocalStorage } from "@mantine/hooks";
import type { ExamMetadataSchema } from "../api/model";
import { useCallback } from "react";

export interface RecentExam {
  filename: string;
  displayname: string;
  category: string;
  category_displayname: string;
  viewedAt: number;
}

const RECENT_EXAMS_KEY = "recently-viewed-exams";
const MAX_RECENT_EXAMS = 5;

export function useRecentExams(): readonly [
  readonly RecentExam[],
  (metadata: ExamMetadataSchema) => void,
] {
  const [recentExams, updateRecentExams] = useLocalStorage<RecentExam[]>({
    key: RECENT_EXAMS_KEY,
    defaultValue: [],
    getInitialValueInEffect: false,
  });

  const pushExam = useCallback(
    (metadata: ExamMetadataSchema) => {
      updateRecentExams(previous => {
        // Remove exam if it is already viewed so it is duplicated
        // We want to push it to the top
        const filtered = previous.filter(
          exam => exam.filename !== metadata.filename,
        );

        return [
          {
            filename: metadata.filename,
            displayname: metadata.displayname,
            category: metadata.category,
            category_displayname: metadata.categoryDisplayname,
            viewedAt: Date.now(),
          },
          ...filtered,
        ].slice(0, MAX_RECENT_EXAMS);
      });
    },
    [updateRecentExams],
  );

  return [recentExams, pushExam] as const;
}
