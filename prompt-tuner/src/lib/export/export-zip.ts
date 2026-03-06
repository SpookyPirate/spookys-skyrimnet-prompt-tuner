import { toast } from "sonner";

export async function exportZip(promptSetName: string): Promise<void> {
  try {
    const res = await fetch(`/api/export/package?set=${encodeURIComponent(promptSetName)}`);
    const data = await res.json();
    if (data.error) { toast.error(data.error); return; }

    const files: { skyrimPath: string; content: string }[] = data.files || [];
    if (files.length === 0) {
      toast.info("No modified files to export in this prompt set.");
      return;
    }

    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    for (const file of files) zip.file(file.skyrimPath, file.content);
    const blob = await zip.generateAsync({ type: "blob" });

    const setLabel = promptSetName || "original";
    const suggestedName = `skyrimnet-prompts-${setLabel}.zip`;

    // Native Save As dialog (Chromium/Edge on Windows)
    if ("showSaveFilePicker" in window) {
      try {
        const handle = await (window as Window & {
          showSaveFilePicker: (opts: object) => Promise<FileSystemFileHandle>;
        }).showSaveFilePicker({
          suggestedName,
          types: [{ description: "Zip archive", accept: { "application/zip": [".zip"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        toast.success(`Exported ${files.length} files`);
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return; // user cancelled
        // fall through to blob download
      }
    }

    // Fallback: browser download to Downloads folder
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${files.length} files`);
  } catch (e) {
    toast.error(`Export failed: ${(e as Error).message}`);
  }
}
