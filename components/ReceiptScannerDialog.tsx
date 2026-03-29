"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, X } from "lucide-react";

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

interface Props {
  open: boolean;
  onClose: () => void;
  onScanned: (receipt: ParsedReceipt) => void;
}

export function ReceiptScannerDialog({ open, onClose, onScanned }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const stopScanning = useCallback(() => {
    if (controlsRef.current) {
      try { controlsRef.current.stop(); } catch { /* ignore */ }
      controlsRef.current = null;
    }
    setReady(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stopScanning();
      setError(null);
      return;
    }

    let cancelled = false;

    const startScanning = async () => {
      // Wait a tick for the dialog/video to mount
      await new Promise((r) => setTimeout(r, 150));
      if (cancelled || !videoRef.current) return;

      setError(null);

      try {
        const reader = new BrowserMultiFormatReader();

        const controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          videoRef.current,
          (result, err) => {
            if (cancelled) return;
            if (result) {
              cancelled = true;
              stopScanning();
              onScanned(parseCode(result.getText()));
              onClose();
              return;
            }
            // err fires every frame when no code is found — only log non-NotFoundException
            if (err && !err.message?.includes("NotFoundException")) {
              console.warn("Scanner:", err.message);
            }
          }
        );

        if (cancelled) {
          controls.stop();
        } else {
          controlsRef.current = controls;
          setReady(true);
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes("Permission") || msg.includes("NotAllowed")) {
            setError("Prístup ku kamere bol zamietnutý. Povoľ kameru v nastaveniach prehliadača.");
          } else if (msg.includes("NotFound") || msg.includes("DevicesNotFound")) {
            setError("Kamera nebola nájdená.");
          } else {
            setError("Kameru sa nepodarilo spustiť. Skús obnoviť stránku.");
          }
        }
      }
    };

    startScanning();

    return () => {
      cancelled = true;
      stopScanning();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleClose() {
    stopScanning();
    setError(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden gap-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            Skenovať bloček
          </DialogTitle>
        </DialogHeader>

        {/* Camera viewport */}
        <div className="relative bg-black w-full" style={{ aspectRatio: "4/3" }}>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {/* Scan frame overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-56 h-56">
              {/* Corner brackets */}
              <span className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl" />
              <span className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr" />
              <span className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl" />
              <span className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white rounded-br" />
              {/* Scan line animation */}
              {ready && (
                <span className="absolute left-2 right-2 h-0.5 bg-green-400/80 animate-[scanline_2s_ease-in-out_infinite]"
                  style={{ top: "50%" }} />
              )}
            </div>
          </div>
          {/* Loading overlay */}
          {!ready && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <p className="text-white text-sm">Spúšťam kameru...</p>
            </div>
          )}
        </div>

        <div className="px-4 py-3 space-y-2">
          {error ? (
            <p className="text-xs text-destructive text-center">{error}</p>
          ) : (
            <p className="text-xs text-muted-foreground text-center">
              Namierte kameru na QR kód alebo čiarový kód (EAN‑13, Code128, e‑Kasa…)
            </p>
          )}
          <Button variant="ghost" className="w-full" onClick={handleClose}>
            <X className="w-4 h-4 mr-2" />
            Zrušiť
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
