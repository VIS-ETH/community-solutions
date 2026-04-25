import { useState, useEffect, useCallback } from "react";
import { download } from "../api/fetch-utils";
import { Document } from "../interfaces";

export const useDocumentDownload = (doc: Document | undefined) => {
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    if (doc === undefined) return;
    if (!isLoading) return;
    let controller: AbortController | undefined;
    let cancel = false;

    const abort = () => {
      cancel = true;
      controller?.abort();
    };

    void (async () => {
      if (doc.files.length === 0) return;
      if (doc.files.length === 1) {
        download(`/api/document/file/${doc.files[0].filename}`);
        setIsLoading(false);
        return;
      }

      const JSZip = await import("jszip").then(e => e.default);
      const zip = new JSZip();

      await Promise.all(
        doc.files.map(async file => {
          controller = new AbortController();
          const response = await fetch(`/api/document/file/${file.filename}`, {
            signal: controller.signal,
          }).catch((e: unknown) => {
            if (e instanceof DOMException && e.name === "AbortError") return;
            console.error(e);
          });
          if (cancel) return;
          if (response === undefined) return;
          const responseFile = response.arrayBuffer();

          const ext = file.filename.split(".").at(-1);
          let displayName = file.display_name;
          if (ext && !displayName.endsWith(ext)) {
            displayName += `.${ext}`;
          }

          zip.file(displayName, responseFile);
        }),
      );

      const content = await zip.generateAsync({ type: "blob" });
      const name = `${doc.display_name}.zip`;
      const url = URL.createObjectURL(content);

      const a = document.createElement("a");
      a.href = url;
      a.download = name;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setIsLoading(false);
    })();

    return abort;
  }, [isLoading, doc]);
  const startDownload = useCallback(() => setIsLoading(true), []);
  return [isLoading, startDownload] as const;
};
