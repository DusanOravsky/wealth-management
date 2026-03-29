"use client";
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode } from "lucide-react";

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
    const date = rawDate ? rawDate.slice(0, 10) : today;
    return { amount, description, date };
  } catch {
    // Use raw text as description
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  function stopCamera() {
    cancelAnimationFrame(animRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }

    setError(null);

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setActive(true);

        function doScan() {
          const v = videoRef.current;
          const c = canvasRef.current;
          if (!v || !c) return;
          if (v.readyState < v.HAVE_ENOUGH_DATA) {
            animRef.current = requestAnimationFrame(doScan);
            return;
          }
          c.width = v.videoWidth;
          c.height = v.videoHeight;
          const ctx = c.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(v, 0, 0);
          const imageData = ctx.getImageData(0, 0, c.width, c.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });
          if (code) {
            stopCamera();
            onScanned(parseQR(code.data));
            onClose();
          } else {
            animRef.current = requestAnimationFrame(doScan);
          }
        }
        animRef.current = requestAnimationFrame(doScan);
      } catch {
        setError("Kamera nie je dostupná. Skontroluj povolenia prehliadača.");
      }
    }

    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
          {error ? (
            <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive text-center">
              {error}
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              {active && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-3/4 h-3/4 relative">
                    <div className="absolute top-0 left-0 w-7 h-7 border-t-[3px] border-l-[3px] border-primary rounded-tl-md" />
                    <div className="absolute top-0 right-0 w-7 h-7 border-t-[3px] border-r-[3px] border-primary rounded-tr-md" />
                    <div className="absolute bottom-0 left-0 w-7 h-7 border-b-[3px] border-l-[3px] border-primary rounded-bl-md" />
                    <div className="absolute bottom-0 right-0 w-7 h-7 border-b-[3px] border-r-[3px] border-primary rounded-br-md" />
                  </div>
                </div>
              )}
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
          <p className="text-xs text-muted-foreground text-center">
            Namier kameru na QR kód bločku — automaticky naskenuje
          </p>
          <Button variant="outline" className="w-full" onClick={handleClose}>
            Zrušiť
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
