import { ExamSelectedForDownload } from "../interfaces";
import { getExamPdfUrl } from "../api/hooks/answers";
import { downloadZipFile, type ZipFileItem } from "./download-zip-file.js";
import type { ListExamsResponse, Meta1CategoryResponse } from "../api/model";

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
  metaCategories: Meta1CategoryResponse[],
  category: string,
): Meta1CategoryResponse[] {
  return metaCategories
    .map(meta1 => ({
      ...meta1,
      meta2: meta1.meta2.filter(meta2 => meta2.categories.includes(category)),
    }))
    .filter(meta1 => meta1.meta2.length > 0);
}
export const mapExamsToExamType = (exams: ListExamsResponse[]) => {
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
      }, new Map<string, ListExamsResponse[]>())
      .entries(),
  ].sort(([a], [b]) => a.localeCompare(b));
};
export const dlSelectedExams = async (
  categoryName: string,
  selectedExams: ExamSelectedForDownload[],
) => {
  categoryName = categoryName.replaceAll(/\s/g, "_");
  const examtypes = new Set<string>();
  for (const exam of selectedExams) {
    examtypes.add(exam.examtype);
  }
  const zipFileItems = selectedExams.map(
    async (exam): Promise<ZipFileItem | undefined> => {
      const { value } = await getExamPdfUrl(exam.filename);
      const responseFile = fetch(value.url).then(r => r.arrayBuffer());
      let documentCategoryName: string;
      if (examtypes.size === 1) {
        documentCategoryName = exam.displayname + "-" + categoryName;
      } else {
        documentCategoryName =
          exam.examtype + "/" + exam.displayname + "-" + categoryName;
      }
      return {
        displayName: documentCategoryName,
        filename: exam.filename,
        file: responseFile,
      };
    },
  );
  await downloadZipFile("exams-" + categoryName + ".zip", zipFileItems);
};
