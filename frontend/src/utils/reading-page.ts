const readingPagesKey = "comsol-reading-pages";
let loggingOut = false;

interface ReadingPage {
  filename: string;
  page: number;
}

function readStorage(): ReadingPage[] {
  try {
    const raw = localStorage.getItem(readingPagesKey);
    return raw ? (JSON.parse(raw) as ReadingPage[]) : [];
  } catch {
    // Reading progress is optional when browser storage is unavailable.
    return [];
  }
}

export function loadReadingPage(filename: string): number | undefined {
  const page = readStorage().find(entry => entry.filename === filename)?.page;
  if (page !== undefined && Number.isInteger(page) && page > 0) return page;
}

export function saveReadingPage(filename: string, page: number) {
  if (loggingOut) return;
  const pages = readStorage().filter(entry => entry.filename !== filename);
  pages.unshift({ filename, page });

  try {
    localStorage.setItem(readingPagesKey, JSON.stringify(pages.slice(0, 20)));
  } catch {
    // Reading progress must not prevent using the exam.
  }
}

export function clearReadingPages() {
  // The old document can still receive visibility updates during navigation.
  loggingOut = true;
  try {
    localStorage.removeItem(readingPagesKey);
  } catch {
    // Storage may be unavailable.
  }
}
