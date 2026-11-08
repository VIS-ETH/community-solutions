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

export interface FlaggedStatus {
  link: string; // link to the flagged comment or answer
  flaggedCount: number; // how many time it was flagger
  author: string;
  flagType: boolean; // true if this is a comment false if it is an answer
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
  filename: string;
  displayname: string;
}

export interface FAQEntry {
  oid: string;
  question: string;
  answer: string;
  order: number;
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
