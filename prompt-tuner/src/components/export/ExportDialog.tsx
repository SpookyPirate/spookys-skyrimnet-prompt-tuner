"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Loader2, FileText, FilePlus } from "lucide-react";
import { toast } from "sonner";

interface ExportFile {
  path: string;
  skyrimPath: string;
  content: string;
  isNew: boolean;
}

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promptSetName: string;
}

export function ExportDialog({
  open,
  onOpenChange,
  promptSetName,
}: ExportDialogProps) {
  const [files, setFiles] = useState<ExportFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadManifest = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/export/package?set=${encodeURIComponent(promptSetName)}`
      );
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
      setFiles(data.files || []);
      setLoaded(true);
      if ((data.files || []).length === 0) {
        toast.info("No modified or new files found in this prompt set.");
      }
    } catch (e) {
      toast.error(`Failed to load: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (files.length === 0) return;
    setExporting(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      for (const file of files) {
        zip.file(file.skyrimPath, file.content);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `skyrimnet-prompts-${promptSetName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${files.length} files to zip`);
      onOpenChange(false);
    } catch (e) {
      toast.error(`Export failed: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setFiles([]);
      setLoaded(false);
    }
    onOpenChange(open);
  };

  const modifiedCount = files.filter((f) => !f.isNew).length;
  const newCount = files.filter((f) => f.isNew).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Export Prompt Set</DialogTitle>
          <DialogDescription>
            Export modified and new files from &quot;{promptSetName}&quot; as a
            zip with SkyrimNet directory structure.
          </DialogDescription>
        </DialogHeader>

        {!loaded ? (
          <div className="flex justify-center py-6">
            <Button onClick={loadManifest} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {loading ? "Scanning files..." : "Scan for changes"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2 text-xs">
              {modifiedCount > 0 && (
                <Badge variant="secondary">
                  {modifiedCount} modified
                </Badge>
              )}
              {newCount > 0 && (
                <Badge variant="outline">
                  {newCount} new
                </Badge>
              )}
              {files.length === 0 && (
                <span className="text-muted-foreground">
                  No changes to export
                </span>
              )}
            </div>

            {files.length > 0 && (
              <ScrollArea className="max-h-60">
                <div className="space-y-1">
                  {files.map((file) => (
                    <div
                      key={file.path}
                      className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-accent/50"
                    >
                      {file.isNew ? (
                        <FilePlus className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      )}
                      <span className="font-mono truncate">
                        {file.skyrimPath}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={!loaded || files.length === 0 || exporting}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {exporting ? "Generating..." : "Download Zip"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
