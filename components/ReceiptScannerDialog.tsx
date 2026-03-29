"use client";
import { useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, ImageIcon, QrCode } from "lucide-react";

export interface ParsedReceipt {
  amount?: number;
  description: string;
  date: string;
}

function parseCode(text: string): ParsedReceipt {
  const today = new Date().toISOString().slice(0, 10);

  // Slovak e-Kasa receipt URL
  if (text.includes("ekasa.financnasprava.sk")) {
    try {
      const url = new URL(text);
      const id = url.searchParams.get("receiptId") ?? url.searchParams.get("id") ?? "";
      return { description: id ? `Bloček ${id.slice(0, 8)}` : "e-Kasa bloček", date: today };
    } catch {
      return { description: "e-Kasa bloček", date: today };
    }
  }

  // Try JSON
  try {
    const obj = JSON.parse(text) as Record<string, unknown>;
    const amount =
      typeof obj.amount === "number" ? obj.amount
      : typeof obj.total === "number" ? obj.total
      : typeof obj.suma === "number" ? obj.suma
      : undefined;
    const description =
      typeof obj.merchant === "string" ? obj.merchant
      : typeof obj.merchantName === "string" ? obj.merchantName
      : typeof obj.description === "string" ? obj.description
      : typeof obj.popis === "string" ? obj.popis
      : "Bloček";
    const rawDate =
      typeof obj.date === "string" ? obj.date
      : typeof obj.datum === "string" ? obj.datum
      : typeof obj.createDate === "string" ? obj.createDate
      : null;
    return { amount, description, date: rawDate ? rawDate.slice(0, 10) : today };
  } catch {
    return { description: text.slice(0, 80), date: today };
  }
}

async function decodeImageFile(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const reader = new BrowserMultiFormatReader();
    const result = await reader.decodeFromImageUrl(url);
    return result.getText();
  } finally {
    URL.revokeObjectURL(url);
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
  onScanned: (receipt: ParsedReceipt) => void;
}

export function ReceiptScannerDialog({ open, onClose, onScanned }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setError(null);
    setLoading(true);
    try {
      const text = await decodeImageFile(file);
      onScanned(parseCode(text));
      onClose();
    } catch {
      setError("Kód sa nenašiel. Skús odfotiť zreteľnejšie alebo z bližšia.");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setError(null);
    setLoading(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            Skenovať bloček
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <p className="text-xs text-muted-foreground text-center">
            Podporuje QR kódy aj čiarové kódy (EAN-13, Code128, e-Kasa...)
          </p>

          {/* Camera capture */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFile}
          />
          <Button
            className="w-full"
            disabled={loading}
            onClick={() => cameraRef.current?.click()}
          >
            <Camera className="w-4 h-4 mr-2" />
            {loading ? "Dekódujem..." : "Odfotiť bloček"}
          </Button>

          {/* Gallery pick */}
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
          <Button
            variant="outline"
            className="w-full"
            disabled={loading}
            onClick={() => galleryRef.current?.click()}
          >
            <ImageIcon className="w-4 h-4 mr-2" />
            Vybrať z galérie
          </Button>

          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}

          <Button variant="ghost" className="w-full" onClick={handleClose}>
            Zrušiť
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
