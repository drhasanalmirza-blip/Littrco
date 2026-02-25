import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useStore, apiRequest } from "@/lib/store";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  Edit2,
  Loader2,
  Plus,
  Shield,
  Timer,
  X,
  Zap,
  Info,
} from "lucide-react";

interface ShopInfo {
  shopId: number;
  shopName: string;
  binId: number;
  binName: string;
}

interface VeriScanItem {
  id: number;
  imageUrl: string;
  aiBrand: string | null;
  aiSubtype: string | null;
  aiFlavor: string | null;
  aiConfidence: number | null;
  finalBrand: string | null;
  finalSubtype: string | null;
  finalFlavor: string | null;
  confirmedAt: string | null;
  modifier: string | null;
}

type FlowStep = "landing" | "tips" | "capture" | "review" | "queue" | "armed";

export default function VeriScanPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { user } = useStore();

  const [step, setStep] = useState<FlowStep>("landing");
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState("");

  const [sessionId, setSessionId] = useState<number | null>(null);
  const [items, setItems] = useState<VeriScanItem[]>([]);
  const [currentItem, setCurrentItem] = useState<VeriScanItem | null>(null);

  const [editBrand, setEditBrand] = useState("");
  const [editSubtype, setEditSubtype] = useState("");
  const [editFlavor, setEditFlavor] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [arming, setArming] = useState(false);
  const [armed, setArmed] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [skipTips, setSkipTips] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [manualBinId, setManualBinId] = useState("");
  const [manualShopId, setManualShopId] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const binId = params.get("binId");
    const shopId = params.get("shopId");
    const sig = params.get("sig");

    if (binId && shopId) {
      validateQR(binId, shopId, sig || "");
    }
  }, [searchString]);

  useEffect(() => {
    if (!armed || !expiresAt) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [armed, expiresAt]);

  const validateQR = async (binId: string, shopId: string, sig: string) => {
    setValidating(true);
    setValidationError("");
    try {
      const res = await fetch(`/api/veriscan?binId=${binId}&shopId=${shopId}&sig=${encodeURIComponent(sig)}`);
      const data = await res.json();
      if (!res.ok) {
        setValidationError(data.error || "Invalid QR code");
        return;
      }
      setShopInfo({
        shopId: parseInt(shopId),
        shopName: data.shopName || `Shop #${shopId}`,
        binId: parseInt(binId),
        binName: data.binName || `Bin #${binId}`,
      });
    } catch {
      setValidationError("Connection error. Please try again.");
    } finally {
      setValidating(false);
    }
  };

  const handleManualSelect = () => {
    if (!manualBinId || !manualShopId) return;
    setShopInfo({
      shopId: parseInt(manualShopId),
      shopName: `Shop #${manualShopId}`,
      binId: parseInt(manualBinId),
      binName: `Bin #${manualBinId}`,
    });
  };

  const startVeriScan = async () => {
    const hasSeenTips = localStorage.getItem("veriscan-tips-seen");
    if (!hasSeenTips && !skipTips) {
      setStep("tips");
      return;
    }
    await startSession();
  };

  const startSession = async () => {
    if (!shopInfo) return;
    try {
      const res = await apiRequest("/api/veriscan/session/start", {
        method: "POST",
        body: JSON.stringify({
          binId: shopInfo.binId,
          shopId: shopInfo.shopId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setValidationError(data.error || "Failed to start session");
        return;
      }
      setSessionId(data.sessionId || data.id);
      setStep("capture");
      startCamera();
    } catch {
      setValidationError("Connection error");
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setValidationError("Camera access denied. Please allow camera access to use VeriScan.");
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedImage(dataUrl);
    uploadItem(dataUrl);
  };

  const uploadItem = async (imageData: string) => {
    if (!sessionId) return;
    setUploading(true);
    try {
      const res = await apiRequest(`/api/veriscan/session/${sessionId}/items`, {
        method: "POST",
        body: JSON.stringify({ imageUrl: imageData }),
      });
      const data = await res.json();
      if (!res.ok) {
        setValidationError(data.error || "Upload failed");
        setUploading(false);
        return;
      }
      const item: VeriScanItem = data.item || data;
      setCurrentItem(item);
      setEditBrand(item.aiBrand || item.finalBrand || "");
      setEditSubtype(item.aiSubtype || item.finalSubtype || "");
      setEditFlavor(item.aiFlavor || item.finalFlavor || "");
      setStep("review");
    } catch {
      setValidationError("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const confirmItem = async () => {
    if (!sessionId || !currentItem) return;
    setUploading(true);
    try {
      const res = await apiRequest(
        `/api/veriscan/session/${sessionId}/items/${currentItem.id}/confirm`,
        {
          method: "POST",
          body: JSON.stringify({
            finalBrand: editBrand || null,
            finalSubtype: editSubtype || null,
            finalFlavor: editFlavor || null,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setValidationError(data.error || "Confirmation failed");
        return;
      }
      const confirmed = data.item || { ...currentItem, finalBrand: editBrand, finalSubtype: editSubtype, finalFlavor: editFlavor, confirmedAt: new Date().toISOString() };
      setItems((prev) => [...prev, confirmed]);
      setCurrentItem(null);
      setCapturedImage(null);
      setIsEditing(false);
      setStep("queue");
    } catch {
      setValidationError("Confirmation failed");
    } finally {
      setUploading(false);
    }
  };

  const addAnother = () => {
    setCapturedImage(null);
    setCurrentItem(null);
    setStep("capture");
    startCamera();
  };

  const armBin = async () => {
    if (!sessionId || !shopInfo) return;
    setArming(true);
    try {
      const expiry = new Date(Date.now() + 5 * 60 * 1000);
      const res = await apiRequest(`/api/veriscan/session/${sessionId}/arm`, {
        method: "POST",
        body: JSON.stringify({
          expiresAt: expiry.toISOString(),
          expectedItemCount: items.length,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setValidationError(data.error || "Failed to arm bin");
        return;
      }
      setExpiresAt(expiry);
      setArmed(true);
      setCountdown(300);
      setStep("armed");
      stopCamera();
    } catch {
      setValidationError("Failed to arm bin");
    } finally {
      setArming(false);
    }
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (step === "landing") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
        <div className="p-4 flex items-center gap-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="text-gray-600 dark:text-gray-400"
            data-testid="button-back-home"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-bold text-lg text-gray-900 dark:text-gray-100">VeriScan</h1>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-md">
          <div className="text-center mb-8">
            <div className="bg-green-100 dark:bg-green-900/30 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
              <Shield className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2" data-testid="text-veriscan-title">
              VeriScan
            </h2>
            <p className="text-gray-500 dark:text-gray-400" data-testid="text-veriscan-subtitle">
              Pre-scan your items for 2x batteries bonus
            </p>
          </div>

          {validating && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-green-600" />
              <p className="text-gray-500 mt-2">Validating QR code...</p>
            </div>
          )}

          {validationError && (
            <Card className="mb-6 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
              <CardContent className="pt-4">
                <p className="text-red-600 dark:text-red-400 text-sm text-center" data-testid="text-validation-error">
                  {validationError}
                </p>
              </CardContent>
            </Card>
          )}

          {shopInfo ? (
            <Card className="mb-6 shadow-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
              <CardContent className="pt-6">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 mb-4 border border-green-100 dark:border-green-800">
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium mb-1">Location</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100" data-testid="text-shop-name">
                    {shopInfo.shopName}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400" data-testid="text-bin-name">
                    {shopInfo.binName}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            !validating && (
              <Card className="mb-6 shadow-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-gray-100 text-base">Select Location</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="Shop ID"
                    value={manualShopId}
                    onChange={(e) => setManualShopId(e.target.value)}
                    type="number"
                    className="littr-input"
                    data-testid="input-shop-id"
                  />
                  <Input
                    placeholder="Bin ID"
                    value={manualBinId}
                    onChange={(e) => setManualBinId(e.target.value)}
                    type="number"
                    className="littr-input"
                    data-testid="input-bin-id"
                  />
                  <Button
                    onClick={handleManualSelect}
                    disabled={!manualBinId || !manualShopId}
                    className="w-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200"
                    data-testid="button-select-location"
                  >
                    Select
                  </Button>
                </CardContent>
              </Card>
            )
          )}

          <div className="space-y-3">
            <Button
              onClick={startVeriScan}
              disabled={!shopInfo || validating}
              className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700 text-white shadow-lg"
              data-testid="button-start-veriscan"
            >
              <Shield className="h-5 w-5 mr-2" />
              VeriScan
            </Button>

            <Button
              variant="outline"
              onClick={() => setLocation("/app/register")}
              className="w-full h-12 text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
              data-testid="button-new-recycler"
            >
              New Recycler? Sign up here
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "tips") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardContent className="pt-8">
            <div className="text-center mb-6">
              <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Info className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2" data-testid="text-tips-title">
                How VeriScan Works
              </h2>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex gap-3">
                <div className="bg-green-100 dark:bg-green-900/30 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-700 dark:text-green-400 font-bold text-sm">1</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">Take a photo</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Snap a picture of each vape before dropping it in</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="bg-green-100 dark:bg-green-900/30 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-700 dark:text-green-400 font-bold text-sm">2</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">Confirm details</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">AI will identify the brand — review and confirm</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="bg-green-100 dark:bg-green-900/30 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-700 dark:text-green-400 font-bold text-sm">3</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">Arm & drop</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Arm the bin, then drop your items within the time window</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Zap className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">Earn 2x batteries!</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">VeriScan-confirmed drops earn double points</p>
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={skipTips}
                onChange={(e) => setSkipTips(e.target.checked)}
                className="rounded border-gray-300"
                data-testid="checkbox-skip-tips"
              />
              <span className="text-sm text-gray-500 dark:text-gray-400">Don't show this again</span>
            </label>

            <Button
              onClick={() => {
                if (skipTips) localStorage.setItem("veriscan-tips-seen", "true");
                startSession();
              }}
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold"
              data-testid="button-got-it"
            >
              Got it, let's go!
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "capture") {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        <div className="p-4 flex items-center justify-between bg-black/80 z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              stopCamera();
              if (items.length > 0) {
                setStep("queue");
              } else {
                setStep("landing");
              }
            }}
            className="text-white hover:bg-white/10"
            data-testid="button-back-capture"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="text-white font-medium">Scan Item</span>
          <div className="w-10" />
        </div>

        <div className="flex-1 relative flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover absolute inset-0"
          />
          <canvas ref={canvasRef} className="hidden" />

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 border-2 border-white/50 rounded-2xl" />
          </div>

          {uploading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-12 w-12 text-white animate-spin mx-auto mb-3" />
                <p className="text-white font-medium">Analyzing...</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-black/80 flex items-center justify-center">
          <button
            onClick={capturePhoto}
            disabled={uploading}
            className="w-20 h-20 rounded-full border-4 border-white bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors flex items-center justify-center disabled:opacity-50"
            data-testid="button-capture-photo"
          >
            <Camera className="h-8 w-8 text-white" />
          </button>
        </div>

        {validationError && (
          <div className="absolute bottom-28 left-4 right-4">
            <Card className="border-red-500 bg-red-950/90">
              <CardContent className="py-3">
                <p className="text-red-300 text-sm text-center">{validationError}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setValidationError("")}
                  className="w-full mt-1 text-red-400"
                >
                  Dismiss
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  if (step === "review" && currentItem) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
        <div className="p-4 flex items-center gap-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCurrentItem(null);
              setCapturedImage(null);
              setStep("capture");
              startCamera();
            }}
            className="text-gray-600 dark:text-gray-400"
            data-testid="button-back-review"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-bold text-lg text-gray-900 dark:text-gray-100">Review Item</h1>
        </div>

        <div className="container mx-auto px-4 py-6 max-w-md">
          {capturedImage && (
            <div className="rounded-xl overflow-hidden mb-6 shadow-lg">
              <img src={capturedImage} alt="Captured item" className="w-full" data-testid="img-captured-item" />
            </div>
          )}

          <Card className="shadow-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 mb-6">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-gray-900 dark:text-gray-100">AI Classification</CardTitle>
                {currentItem.aiConfidence !== null && (
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      (currentItem.aiConfidence || 0) > 0.7
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : (currentItem.aiConfidence || 0) > 0.4
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                    data-testid="text-ai-confidence"
                  >
                    {Math.round((currentItem.aiConfidence || 0) * 100)}% confidence
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Brand</label>
                    <Input
                      value={editBrand}
                      onChange={(e) => setEditBrand(e.target.value)}
                      placeholder="Brand name"
                      className="littr-input"
                      data-testid="input-edit-brand"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Subtype</label>
                    <Input
                      value={editSubtype}
                      onChange={(e) => setEditSubtype(e.target.value)}
                      placeholder="Subtype / model"
                      className="littr-input"
                      data-testid="input-edit-subtype"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Flavor</label>
                    <Input
                      value={editFlavor}
                      onChange={(e) => setEditFlavor(e.target.value)}
                      placeholder="Flavor"
                      className="littr-input"
                      data-testid="input-edit-flavor"
                    />
                  </div>
                  <Button
                    onClick={() => setIsEditing(false)}
                    className="w-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                    data-testid="button-done-editing"
                  >
                    Done
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Brand</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100" data-testid="text-brand-value">
                      {editBrand || "Unknown"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Subtype</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100" data-testid="text-subtype-value">
                      {editSubtype || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Flavor</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100" data-testid="text-flavor-value">
                      {editFlavor || "—"}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                    className="w-full mt-2 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                    data-testid="button-edit-classification"
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit Classification
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Button
            onClick={confirmItem}
            disabled={uploading}
            className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700 text-white shadow-lg"
            data-testid="button-confirm-item"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <Check className="h-5 w-5 mr-2" />
            )}
            Confirm & Add to Queue
          </Button>
        </div>
      </div>
    );
  }

  if (step === "queue") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
        <div className="p-4 flex items-center gap-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep("landing")}
            className="text-gray-600 dark:text-gray-400"
            data-testid="button-back-queue"
          >
            <X className="h-5 w-5" />
          </Button>
          <h1 className="font-bold text-lg text-gray-900 dark:text-gray-100">VeriScan Queue</h1>
          <span className="ml-auto bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-bold px-3 py-1 rounded-full" data-testid="text-item-count">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="container mx-auto px-4 py-6 max-w-md">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 mb-6">
            <div className="flex gap-3">
              <Zap className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-300 text-sm">2x Bonus Active</p>
                <p className="text-yellow-600 dark:text-yellow-400 text-xs mt-0.5">
                  VeriScan items earn double batteries!
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            {items.map((item, idx) => (
              <Card
                key={item.id || idx}
                className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800"
                data-testid={`card-item-${idx}`}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 dark:bg-green-900/30 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                      <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {item.finalBrand || item.aiBrand || "Unknown Brand"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {[item.finalSubtype || item.aiSubtype, item.finalFlavor || item.aiFlavor]
                          .filter(Boolean)
                          .join(" · ") || "No details"}
                      </p>
                    </div>
                    <span className="text-green-600 dark:text-green-400 font-bold text-sm">2x</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-3">
            <Button
              onClick={addAnother}
              variant="outline"
              className="w-full h-12 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
              data-testid="button-add-another"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Another Item
            </Button>

            <Button
              onClick={armBin}
              disabled={arming || items.length === 0}
              className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700 text-white shadow-lg"
              data-testid="button-arm-bin"
            >
              {arming ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Shield className="h-5 w-5 mr-2" />
              )}
              Arm Bin — Drop {items.length} Item{items.length !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "armed") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-green-100 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl bg-white dark:bg-gray-900 border-green-200 dark:border-green-800">
          <CardContent className="pt-8 text-center">
            <div className="bg-green-100 dark:bg-green-900/30 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
              <Shield className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2" data-testid="text-armed-title">
              Bin Armed!
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Drop your {items.length} item{items.length !== 1 ? "s" : ""} in the bin now
            </p>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Timer className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Time remaining</span>
              </div>
              <p
                className={`text-4xl font-mono font-bold ${
                  countdown > 60
                    ? "text-green-600 dark:text-green-400"
                    : countdown > 30
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-red-600 dark:text-red-400"
                }`}
                data-testid="text-countdown"
              >
                {formatCountdown(countdown)}
              </p>
            </div>

            <div className="space-y-2 mb-6">
              {items.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="flex items-center gap-2 text-sm bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2"
                  data-testid={`text-armed-item-${idx}`}
                >
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300 truncate">
                    {item.finalBrand || item.aiBrand || "Unknown"}{" "}
                    {item.finalSubtype || item.aiSubtype ? `— ${item.finalSubtype || item.aiSubtype}` : ""}
                  </span>
                  <span className="ml-auto text-green-600 dark:text-green-400 font-bold">2x</span>
                </div>
              ))}
            </div>

            <Button
              onClick={() => setLocation(user ? "/app" : "/")}
              variant="outline"
              className="w-full border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
              data-testid="button-done"
            >
              Done
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
