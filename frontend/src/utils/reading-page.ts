const keyPrefix = "comsol-reading-page:";
let loggingOut = false;

export function loadReadingPage(filename: string): number | undefined {
  try {
    const page = Number(localStorage.getItem(keyPrefix + filename));
    if (Number.isInteger(page) && page > 0) return page;
  } catch {
    // Reading progress is optional when browser storage is unavailable.
  }
}

export function saveReadingPage(filename: string, page: number) {
  if (loggingOut) return;
  try {
    localStorage.setItem(keyPrefix + filename, String(page));
  } catch {
    // Reading progress must not prevent using the exam.
  }
}

export function clearReadingPages() {
  // The old document can still receive visibility updates during navigation.
  loggingOut = true;
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(keyPrefix)) localStorage.removeItem(key);
    }
  } catch {
    // Storage may be unavailable.
  }
}
