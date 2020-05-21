import { useRequest } from "@umijs/hooks";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { fetchGet } from "../api/fetch-utils";
import { loadCutVersions } from "../api/hooks";
import useSet from "../hooks/useSet";
import {
  CutVersions,
  EditMode,
  EditState,
  ExamMetaData,
  PdfSection,
  Section,
  SectionKind,
} from "../interfaces";
import { ExamSVG } from "../pages/exam-page";
import PDF from "../pdf/pdf-renderer";
import PdfSectionCanvas from "../pdf/pdf-section-canvas";
import AnswerSectionComponent from "./answer-section";
import PdfSectionSvg from "./pdf-section-svg";

interface Props {
  examSVG: ExamSVG;
  metaData: ExamMetaData;
  sections: Section[];
  width: number;
  editState: EditState;
  setEditState: (newEditState: EditState) => void;
  reloadCuts: () => void;
  renderer: PDF | undefined;
  requestRenderer: () => void;
  onCutNameChange: (oid: string, name: string) => void;
  onSectionHiddenChange: (
    section: string | [number, number],
    newState: boolean,
  ) => void;
  onAddCut: (filename: string, page: number, height: number) => void;
  onMoveCut: (
    filename: string,
    cut: string,
    page: number,
    height: number,
  ) => void;
  visibleChangeListener: (section: PdfSection, v: boolean) => void;
  displayHiddenPdfSections?: boolean;
  displayHiddenAnswerSections?: boolean;
  displayHideShowButtons?: boolean;
  displayEmptyCutLabels?: boolean;
}
function notUndefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
function compactMap<S, T>(array: T[], fn: (arg: T) => S | undefined) {
  return array.map(fn).filter(notUndefined);
}
function objectFromMap<S, T, K extends string | number | symbol>(
  array: T[],
  fn: (arg: T) => readonly [K, S] | undefined,
) {
  return Object.fromEntries(compactMap(array, fn)) as Record<K, S>;
}
function useObjectFromMap<S, T, K extends string | number | symbol>(
  array: T[],
  fn: (arg: T) => readonly [K, S] | undefined,
  deps: any[],
) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => objectFromMap(array, fn), [array, fn, ...deps]);
}

const Exam: React.FC<Props> = React.memo(
  ({
    requestRenderer,
    examSVG,
    metaData,
    sections,
    width,
    editState,
    setEditState,
    reloadCuts,
    renderer,
    onCutNameChange,
    onAddCut,
    onSectionHiddenChange,
    onMoveCut,
    visibleChangeListener,
    displayHiddenPdfSections = false,
    displayHiddenAnswerSections = false,
    displayHideShowButtons = true,
    displayEmptyCutLabels = false,
  }) => {
    const getAddCutHandler = useCallback(
      (section: PdfSection) => {
        return (height: number) => {
          if (editState.mode === EditMode.Add) {
            onAddCut(metaData.filename, section.start.page, height);
          } else if (editState.mode === EditMode.Move) {
            onMoveCut(
              metaData.filename,
              editState.cut,
              section.start.page,
              height,
            );
          }
        };
      },
      [editState, metaData.filename, onAddCut, onMoveCut],
    );

    const masterSvg = useMemo(() => {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      /*for (const attribute of examSVG.attributes) {
        svg.setAttribute(attribute.name, attribute.value);
      }*/

      svg.appendChild(examSVG.defs);
      for (let i = 0; i < examSVG.pages.length; i++) {
        const page = examSVG.pages[i];
        const symbol = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "symbol",
        );

        symbol.id = `${metaData.filename}-page${i}`;
        for (let j = 0; j < page.children.length; j++) {
          symbol.appendChild(page.children[j]);
        }
        svg.append(symbol);
      }
      return svg;
    }, [examSVG, metaData.filename]);
    const mountMasterSvg = useCallback(
      (div: HTMLDivElement) => {
        if (div === null) return;
        while (div.lastChild) div.removeChild(div.lastChild);
        div.appendChild(masterSvg);
      },
      [masterSvg],
    );

    const [visible, show, hide] = useSet<string>();
    const [cutVersions, setCutVersions] = useState<CutVersions>({});
    useRequest(() => loadCutVersions(metaData.filename), {
      pollingInterval: 6_000,
      onSuccess: response => {
        setCutVersions(oldVersions => ({ ...oldVersions, ...response }));
      },
    });
    const snap =
      editState.mode === EditMode.Add || editState.mode === EditMode.Move
        ? editState.snap
        : true;
    let pageCounter = 0;
    const addCutText =
      editState.mode === EditMode.Add
        ? "Add Cut"
        : editState.mode === EditMode.Move
        ? "Move Cut"
        : undefined;
    const hash = document.location.hash.substr(1);
    useEffect(() => {
      let cancelled = false;
      if (hash.length > 0) {
        fetchGet(`/api/exam/answer/${hash}`)
          .then(res => {
            if (cancelled) return;
            const sectionId = res.value.sectionId;
            show(sectionId);
          })
          .catch(() => {});
      }
      return () => {
        cancelled = true;
      };
    }, [hash, show, sections]);
    const onChangeListeners = useObjectFromMap(
      sections,
      section => {
        if (section.kind === SectionKind.Pdf) {
          return [
            section.key,
            (v: boolean) => visibleChangeListener(section, v),
          ];
        } else {
          return undefined;
        }
      },
      [sections, visibleChangeListener],
    );
    const addCutHandlers = useObjectFromMap(
      sections,
      section => {
        if (section.kind === SectionKind.Pdf) {
          return [section.key, getAddCutHandler(section)];
        } else {
          return undefined;
        }
      },
      [sections, getAddCutHandler],
    );
    const needsCanvas = editState.mode !== EditMode.None;
    useEffect(() => {
      if (needsCanvas) requestRenderer();
    }, [needsCanvas, requestRenderer]);
    return (
      <>
        <div ref={mountMasterSvg} />
        {sections.map(section => {
          if (section.kind === SectionKind.Answer) {
            if (displayHiddenAnswerSections || !section.cutHidden) {
              return (
                <AnswerSectionComponent
                  displayEmptyCutLabels={displayEmptyCutLabels}
                  key={section.oid}
                  oid={section.oid}
                  onSectionChange={reloadCuts}
                  onToggleHidden={() =>
                    visible.has(section.oid)
                      ? hide(section.oid)
                      : show(section.oid)
                  }
                  cutName={section.name}
                  onCutNameChange={(newName: string) =>
                    onCutNameChange(section.oid, newName)
                  }
                  hidden={!visible.has(section.oid)}
                  cutVersion={cutVersions[section.oid] || section.cutVersion}
                  setCutVersion={newVersion =>
                    setCutVersions(oldVersions => ({
                      ...oldVersions,
                      [section.oid]: newVersion,
                    }))
                  }
                  onCancelMove={() => setEditState({ mode: EditMode.None })}
                  onMove={() =>
                    setEditState({
                      mode: EditMode.Move,
                      cut: section.oid,
                      snap,
                    })
                  }
                  isBeingMoved={
                    editState.mode === EditMode.Move &&
                    editState.cut === section.oid
                  }
                />
              );
            } else {
              return null;
            }
          } else {
            if (displayHiddenPdfSections || !section.hidden) {
              return (
                <React.Fragment key={section.key}>
                  {pageCounter < section.start.page && ++pageCounter && (
                    <div id={`page-${pageCounter}`} />
                  )}
                  {!needsCanvas || renderer === undefined ? (
                    <PdfSectionSvg
                      name={metaData.filename}
                      examSVG={examSVG}
                      start={section.start.position}
                      end={section.end.position}
                      page={section.start.page}
                    />
                  ) : (
                    renderer && (
                      <PdfSectionCanvas
                        /* PDF cut data */
                        oid={section.cutOid}
                        page={section.start.page}
                        start={section.start.position}
                        end={section.end.position}
                        hidden={section.hidden}
                        /* Handler */
                        onSectionHiddenChange={onSectionHiddenChange}
                        displayHideShowButtons={displayHideShowButtons}
                        renderer={renderer}
                        targetWidth={width}
                        onVisibleChange={onChangeListeners[section.key]}
                        /* Add cut */
                        snap={snap}
                        addCutText={addCutText}
                        onAddCut={addCutHandlers[section.key]}
                      />
                    )
                  )}
                </React.Fragment>
              );
            } else {
              return null;
            }
          }
        })}
      </>
    );
  },
);
export default Exam;
