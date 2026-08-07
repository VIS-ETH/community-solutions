import { AnswerSectionSchema } from "./api/model";

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

export interface CategoryExam {
  displayname: string; // Name of exam which should be displayed
  filename: string; // unique filename
  category_displayname: string; // category of exam
  needs_payment: boolean; // whether a payment is required
  examtype: string; // type of exam
  remark: string; // remark for the exam
  import_claim: string | null; // the user who is importing the exam
  import_claim_displayname: string | null; // the name of the user who claimed the exam
  import_claim_time: string | null; // time at which the user claimed the exam
  public: boolean; // whether the exam is public
  has_solution: boolean; // whether there is an official solution
  is_printonly: boolean; // whether this exam can only be printed
  finished_cuts: boolean; // whether all cuts were added
  canView: boolean; // whether the exam can be viewed by the user
  count_cuts: number; // number of cuts in exam
  count_answered: number; // number of cuts with answers in exam
  user_solved: boolean;
}

export interface CategoryPaymentExam {
  displayname: string;
  filename: string;
  category_displayname: string;
  payment_uploader: string;
  payment_uploader_displayname: string;
}

export interface MetaCategory {
  displayname: string;
  meta2: {
    displayname: string;
    categories: string[];
  }[];
}

export interface MetaCategoryWithCategories {
  displayname: string;
  meta2: {
    displayname: string;
    categories: CategoryMetaDataOverview[];
  }[];
}

export interface CategoryMetaDataMinimal {
  displayname: string; // Name of category
  slug: string;
}

export interface CategoryMetaDataOverview {
  displayname: string; // Name of category
  slug: string;
  examcountpublic: number;
  examcountanswered: number;
  answerprogress: number;
}

export interface CategoryMetaData {
  displayname: string; // Name of category
  slug: string;
  admins: string[];
  experts: string[];
  semester: string;
  form: string;
  permission: string;
  remark: string;
  has_payments: boolean;
  catadmin: boolean;
  more_exams_link: string;
  documentcount: number;
  examcountpublic: number;
  examcountanswered: number;
  answerprogress: number;
  attachments: Attachment[];
  pinned: boolean;
}

export type CategoryMetaDataAny =
  CategoryMetaData | CategoryMetaDataOverview | CategoryMetaDataMinimal;

export interface ExamSelectedForDownload {
  filename: string;
  displayname: string;
}

export interface NotificationInfo {
  oid: string;
  receiver: string;
  type: number;
  time: string;
  sender: string;
  senderDisplayName: string;
  title: string;
  message: string;
  link: string;
  read: boolean;
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
