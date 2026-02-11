import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Camera, Keyboard, Loader2 } from "lucide-react";
import { useStore, apiRequest } from "@/lib/store";
import { Html5QrcodeScanner } from "html5-qrcode";

export default function ScanPage() {
  const [, setLocation] = useLocation();
  const { user, setAuth } = useStore();
  const [mode, setMode] = useState<'scan' | 'manual'>('scan');
  const [manualCode, setManualCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [receipt, setReceipt] = useState<any>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode === 'scan' && containerRef.current && !scannerRef.current) {
      scannerRef.current = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );

      scannerRef.current.render(
        (decodedText) => {
          handleQrScan(decodedText);
        },
        (error) => {
        }
      );
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [mode]);

  const extractToken = (input: string): string => {
    try {
      const url = new URL(input);
      const token = url.searchParams.get('token');
      if (token) return token;
    } catch {
    }
    return input;
  };

  const handleQrScan = async (scannedData: string) => {
    if (status === 'loading') return;
    
    const token = extractToken(scannedData);
    await claimToken(token);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    
    const token = extractToken(manualCode.trim());
    await claimToken(token);
  };

  const claimToken = async (token: string) => {
    setStatus('loading');
    setMessage('Claiming batteries...');

    try {
      const res = await apiRequest('/api/v1/claim', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || 'Claim failed');
        return;
      }

      if (data.sessionId && data.user) {
        setAuth(data.user, data.sessionId);
      }

      setStatus('success');
      setReceipt(data.receipt);
      setMessage(`+${data.receipt.points} batteries claimed!`);
    } catch (error) {
      setStatus('error');
      setMessage('Connection error. Please try again.');
    }
  };

  if (status === 'success' && receipt) {
    return (
      <div className="littr-dashboard flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl ring-1 ring-black/5 dark:ring-white/5 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardContent className="pt-8 text-center">
            <div className="bg-green-50 dark:bg-green-950 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
              <span className="text-5xl">🎉</span>
            </div>
            <h2 className="text-4xl font-extrabold text-gray-900 dark:text-gray-100 mb-2">+{receipt.points}</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 font-medium">Batteries claimed!</p>
            
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-6 text-left border border-gray-100 dark:border-gray-700">
              <div className="flex justify-between mb-2">
                <span className="text-gray-400 text-sm">Location</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium text-sm">{receipt.shopName}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-400 text-sm">Time</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium text-sm">{new Date(receipt.timestamp).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 text-sm">New Balance</span>
                <span className="text-gray-900 dark:text-gray-100 font-bold text-sm">{receipt.newBalance} batteries</span>
              </div>
            </div>

            <Button 
              onClick={() => setLocation('/app')}
              className="littr-btn littr-btn-primary w-full"
            >
              Back to Wallet
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="littr-dashboard flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl ring-1 ring-black/5 dark:ring-white/5 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardContent className="pt-8 text-center">
            <div className="bg-red-50 dark:bg-red-950 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
              <span className="text-5xl">❌</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Claim Failed</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">{message}</p>
            
            <div className="flex gap-3">
              <Button 
                variant="outline"
                onClick={() => {
                  setStatus('idle');
                  setMessage('');
                  setManualCode('');
                }}
                className="flex-1 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Try Again
              </Button>
              <Button 
                onClick={() => setLocation('/app')}
                className="flex-1 littr-btn-primary"
              >
                Back to Wallet
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="littr-dashboard flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl ring-1 ring-black/5 dark:ring-white/5 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardContent className="pt-8 text-center">
            <Loader2 className="h-16 w-16 text-gray-900 dark:text-gray-100 mx-auto mb-6 animate-spin" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{message}</h2>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="littr-dashboard">
      <div className="littr-nav p-4 flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setLocation('/app')}
          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-bold text-lg text-gray-900 dark:text-gray-100">Claim Batteries</h1>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-lg">
        <div className="flex gap-2 mb-6">
          <Button
            variant={mode === 'scan' ? 'default' : 'outline'}
            onClick={() => setMode('scan')}
            className={mode === 'scan' ? 'littr-btn-primary flex-1' : 'flex-1 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800'}
          >
            <Camera className="h-4 w-4 mr-2" />
            Scan QR
          </Button>
          <Button
            variant={mode === 'manual' ? 'default' : 'outline'}
            onClick={() => setMode('manual')}
            className={mode === 'manual' ? 'littr-btn-primary flex-1' : 'flex-1 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800'}
          >
            <Keyboard className="h-4 w-4 mr-2" />
            Enter Code
          </Button>
        </div>

        {mode === 'scan' ? (
          <Card className="shadow-lg ring-1 ring-black/5 dark:ring-white/5 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-gray-100 text-center">Point Camera at QR Code</CardTitle>
            </CardHeader>
            <CardContent>
              <div id="qr-reader" ref={containerRef} className="rounded-lg overflow-hidden" />
              <p className="text-gray-500 dark:text-gray-400 text-sm text-center mt-4">
                Scan the QR code displayed on the LITTR bin
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-lg ring-1 ring-black/5 dark:ring-white/5 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-gray-100 text-center">Enter Claim Code</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <Input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Paste your claim code or URL"
                  className="littr-input w-full"
                  data-testid="input-manual-code"
                />
                <Button 
                  type="submit" 
                  className="w-full littr-btn littr-btn-primary"
                  disabled={!manualCode.trim()}
                  data-testid="button-claim-manual"
                >
                  Claim Batteries
                </Button>
              </form>
              <p className="text-gray-500 dark:text-gray-400 text-sm text-center mt-4">
                Enter the code shown on your receipt or paste the full URL
              </p>
            </CardContent>
          </Card>
        )}

        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm">
            Need help? <a href="/faq" className="text-gray-900 dark:text-gray-100 font-semibold underline">Visit FAQ</a>
          </p>
        </div>
      </div>
    </div>
  );
}
