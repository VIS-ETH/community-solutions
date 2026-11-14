import { AnswerSectionSchema, type CategoryData } from "./api/model";

export type Section = AnswerSection | PdfSection;

export enum SectionKind {
  Answer,
  Pdf,
}

export type AnswerSection = AnswerSectionSchema & {
  kind: SectionKind.Answer;
  cutHidden: boolean;
};

export interface PdfSection {
  key: string | number;
  cutOid?: number;
  kind: SectionKind.Pdf;
  start: CutPosition;
  end: CutPosition;
  hidden: boolean;
}

export interface CutPosition {
  page: number; // the first page is 1
  position: number;
}

export interface Attachment {
  displayname: string;
  filename: string;
}

export type CategoryMetaDataMinimal = Pick<
  CategoryData,
  "displayname" | "slug"
>;

export interface ExamSelectedForDownload {
  examtype: string;
  filename: string;
  displayname: string;
}

export enum EditMode {
  None,
  Add,
  Move,
}
export type EditState =
  | { mode: EditMode.None }
  | { mode: EditMode.Add; snap: boolean }
  | { mode: EditMode.Move; cut: number; snap: boolean };
