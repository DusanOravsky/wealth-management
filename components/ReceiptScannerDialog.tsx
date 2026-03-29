"use client";
import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, ImageIcon } from "lucide-react";

export interface ParsedReceipt {
  amount?: number;
  description: string;
  date: string;
}

function parseQR(text: string): ParsedReceipt {
  const today = new Date().toISOString().slice(0, 10);

  // Slovak e-Kasa receipt URL
  if (text.includes("ekasa.financnasprava.sk")) {
    try {
      const url = new URL(text);
      const id = url.searchParams.get("receiptId") ?? url.searchParams.get("id") ?? "";
      return {
        description: id ? `Bloček ${id.slice(0, 8)}` : "e-Kasa bloček",
        date: today,
      };
    } catch {
      return { description: "e-Kasa bloček", date: today };
    }
  }

  // Try JSON (custom receipt formats)
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

interface Props {
  open: boolean;
  onClose: () => void;
  onScanned: (receipt: ParsedReceipt) => void;
}

export function ReceiptScannerDialog({ open, onClose, onScanned }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [decoding, setDecoding] = useState(false);

  function stopCamera() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setActive(false);
  }

  useEffect(() => {
    if (!open) {
      stopCamera();
      setError(null);
      return;
    }

    setError(null);

    async function startScanner() {
      if (!videoRef.current) return;
      try {
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, _err, ctrl) => {
            if (result) {
              ctrl.stop();
              setActive(false);
              onScanned(parseQR(result.getText()));
              onClose();
            }
          }
        );
        controlsRef.current = controls;
        setActive(true);
      } catch {
        setError("Kamera nie je dostupná. Skontroluj povolenia prehliadača.");
      }
    }

    startScanner();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function scanFromImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setError(null);
    setDecoding(true);
    try {
      const url = URL.createObjectURL(file);
      const reader = new BrowserMultiFormatReader();
      const result = await reader.decodeFromImageUrl(url);
      URL.revokeObjectURL(url);
      stopCamera();
      onScanned(parseQR(result.getText()));
      onClose();
    } catch {
      setError("Kód sa nenašiel v obrázku. Skús odfotiť zreteľnejšie.");
    } finally {
      setDecoding(false);
    }
  }

  function handleClose() {
    stopCamera();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            Skenovať bloček
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Camera viewfinder */}
          {!error && (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              {active && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-3/4 h-3/4 relative">
                    <div className="absolute top-0 left-0 w-7 h-7 border-t-[3px] border-l-[3px] border-primary rounded-tl-md" />
                    <div className="absolute top-0 right-0 w-7 h-7 border-t-[3px] border-r-[3px] border-primary rounded-tr-md" />
                    <div className="absolute bottom-0 left-0 w-7 h-7 border-b-[3px] border-l-[3px] border-primary rounded-bl-md" />
                    <div className="absolute bottom-0 right-0 w-7 h-7 border-b-[3px] border-r-[3px] border-primary rounded-br-md" />
                    {/* Scanning line animation */}
                    <div className="absolute inset-x-0 top-1/2 h-0.5 bg-primary/60 animate-pulse" />
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive text-center">
              {error}
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Funguje pre QR kódy aj čiarové kódy (EAN, Code128...)
          </p>

          {/* Gallery option */}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={scanFromImage} />
          <Button
            variant="outline"
            className="w-full"
            disabled={decoding}
            onClick={() => fileRef.current?.click()}
          >
            <ImageIcon className="w-4 h-4 mr-2" />
            {decoding ? "Dekódujem..." : "Nahrať z galérie / fotky"}
          </Button>

          <Button variant="ghost" className="w-full" onClick={handleClose}>
            Zrušiť
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
