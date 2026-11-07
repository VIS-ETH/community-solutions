import {
  CategoryExam,
  MetaCategory,
  ExamSelectedForDownload,
} from "../interfaces";
import { getExamPdfUrl } from "../api/hooks/answers";
import { downloadZipFile, type ZipFileItem } from "./download-zip-file.js";

export function filterMatches(filter: string, name: string): boolean {
  const nameLower = name.replace(/\s/g, "").toLowerCase();
  const filterLower = filter.replace(/\s/g, "").toLowerCase();
  if (filter.length === 0) {
    return true;
  }
  let fpos = 0;
  // Check if name contains the letters from `filter` in order
  for (const nameChar of nameLower) {
    if (filterLower[fpos] === nameChar) {
      fpos++;
      if (fpos === filterLower.length) {
        return true;
      }
    }
  }
  return false;
}

export function getMetaCategoriesForCategory(
  metaCategories: MetaCategory[],
  category: string,
): MetaCategory[] {
  return metaCategories
    .map(meta1 => ({
      ...meta1,
      meta2: meta1.meta2.filter(meta2 => meta2.categories.includes(category)),
    }))
    .filter(meta1 => meta1.meta2.length > 0);
}
export const mapExamsToExamType = (exams: CategoryExam[]) => {
  return [
    ...exams
      .reduce((map, exam) => {
        const examtype = exam.examtype;
        const arr = map.get(examtype);
        if (arr) {
          arr.push(exam);
        } else {
          map.set(examtype, [exam]);
        }
        return map;
      }, new Map<string, CategoryExam[]>())
      .entries(),
  ].sort(([a], [b]) => a.localeCompare(b));
};
export const dlSelectedExams = async (
  selectedExams: ExamSelectedForDownload[],
) => {
  const zipFileItems = selectedExams.map(
    async (exam): Promise<ZipFileItem | undefined> => {
      const { value } = await getExamPdfUrl(exam.filename);
      const responseFile = fetch(value.url).then(r => r.arrayBuffer());

      return {
        displayName: exam.displayname,
        filename: exam.filename,
        file: responseFile,
      };
    },
  );

  await downloadZipFile("exams.zip", zipFileItems);
};
