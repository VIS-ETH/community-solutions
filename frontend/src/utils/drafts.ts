const draftsKey = "draft-ans/com-json";
const cacheDuration = 1000 * 60 * 60 * 24 * 30; // 1 Month

interface DraftItem {
  draftTime: number;
  draft: string;
}

interface StorageDraft {
  answers: Record<string, DraftItem>;
  comments: Record<string, DraftItem>;
}

function filterStale(draft: StorageDraft): StorageDraft {
  const now = Date.now();
  for (const key of ["answers", "comments"] as const) {
    // Filter expired items
    let entries = Object.entries(draft[key]).filter(
      ([_, draftItem]) => draftItem.draftTime + cacheDuration >= now,
    );

    // Limit to at most 30 most recent drafts per type
    entries = entries
      .toSorted((a, b) => b[1].draftTime - a[1].draftTime)
      .slice(0, 30);

    draft[key] = Object.fromEntries(entries);
  }

  return draft;
}

function readStorage(): StorageDraft {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(draftsKey);
  } catch {
    // safari private mode, quota exceeded, something else
  }

  if (!raw) {
    return {
      answers: {},
      comments: {},
    };
  }

  const parsed = JSON.parse(raw) as StorageDraft;
  return filterStale(parsed);
}

function writeStorage(drafts: StorageDraft) {
  drafts = filterStale(drafts);

  try {
    localStorage.setItem(draftsKey, JSON.stringify(drafts));
  } catch {
    // oh well
  }
}

export function saveDraftToStorage(
  oid: string | undefined,
  newValue: string,
  type: "answer" | "comment",
) {
  if (oid === undefined) return;

  if (newValue === "") {
    clearDraftFromStorage(oid, type);
    return;
  }

  const drafts = readStorage();

  if (type === "answer") {
    drafts.answers[oid] = {
      draft: newValue,
      draftTime: Date.now(),
    };
  } else {
    drafts.comments[oid] = {
      draft: newValue,
      draftTime: Date.now(),
    };
  }

  writeStorage(drafts);
}

export function clearDraftFromStorage(
  oid: string | undefined,
  type: "answer" | "comment",
) {
  if (oid === undefined) return;

  const drafts = readStorage();
  if (type === "answer") {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete drafts.answers[oid];
  } else {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete drafts.comments[oid];
  }

  writeStorage(drafts);
}

export function readDraftFromStorage(
  oid: string | undefined,
  type: "answer" | "comment",
): string | undefined {
  if (oid === undefined) return;

  const drafts = readStorage();
  if (type === "answer") {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    return drafts.answers[oid]?.draft;
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return drafts.comments[oid]?.draft;
}

export function clearExpiredDrafts() {
  // readStorage filters expired draft items
  writeStorage(readStorage());
}
