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
          // Ignore scanning errors (common during scanning)
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
    // Check if it's a URL with token param
    try {
      const url = new URL(input);
      const token = url.searchParams.get('token');
      if (token) return token;
    } catch {
      // Not a URL, treat as raw token
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
    setMessage('Claiming points...');

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

      // Update auth if new session provided
      if (data.sessionId && data.user) {
        setAuth(data.user, data.sessionId);
      }

      setStatus('success');
      setReceipt(data.receipt);
      setMessage(`+${data.receipt.points} points claimed!`);
    } catch (error) {
      setStatus('error');
      setMessage('Connection error. Please try again.');
    }
  };

  // Success screen
  if (status === 'success' && receipt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black p-4">
        <Card className="w-full max-w-md bg-gray-800 border-gray-700">
          <CardContent className="pt-8 text-center">
            <div className="bg-green-900/30 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
              <span className="text-5xl">🎉</span>
            </div>
            <h2 className="text-4xl font-bold text-white mb-2">+{receipt.points}</h2>
            <p className="text-gray-400 mb-6">Points claimed successfully!</p>
            
            <div className="bg-gray-900 rounded-lg p-4 mb-6 text-left">
              <div className="flex justify-between mb-2">
                <span className="text-gray-500">Location</span>
                <span className="text-white">{receipt.shopName}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-500">Time</span>
                <span className="text-white">{new Date(receipt.timestamp).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">New Balance</span>
                <span className="text-white font-bold">{receipt.newBalance} pts</span>
              </div>
            </div>

            <Button 
              onClick={() => setLocation('/app')}
              className="w-full bg-white text-black hover:bg-gray-100"
            >
              Back to Wallet
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error screen
  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black p-4">
        <Card className="w-full max-w-md bg-gray-800 border-gray-700">
          <CardContent className="pt-8 text-center">
            <div className="bg-red-900/30 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
              <span className="text-5xl">❌</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Claim Failed</h2>
            <p className="text-gray-400 mb-6">{message}</p>
            
            <div className="flex gap-3">
              <Button 
                variant="outline"
                onClick={() => {
                  setStatus('idle');
                  setMessage('');
                  setManualCode('');
                }}
                className="flex-1 border-gray-600 text-white"
              >
                Try Again
              </Button>
              <Button 
                onClick={() => setLocation('/app')}
                className="flex-1 bg-white text-black hover:bg-gray-100"
              >
                Back to Wallet
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading screen
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black p-4">
        <Card className="w-full max-w-md bg-gray-800 border-gray-700">
          <CardContent className="pt-8 text-center">
            <Loader2 className="h-16 w-16 text-white mx-auto mb-6 animate-spin" />
            <h2 className="text-xl font-bold text-white">{message}</h2>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black">
      {/* Header */}
      <div className="bg-black text-white p-4 flex items-center gap-4 border-b border-gray-800">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setLocation('/app')}
          className="text-white hover:bg-gray-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-bold text-lg">Claim Points</h1>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-lg">
        {/* Mode Toggle */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={mode === 'scan' ? 'default' : 'outline'}
            onClick={() => setMode('scan')}
            className={mode === 'scan' ? 'bg-white text-black flex-1' : 'flex-1 border-gray-600 text-white'}
          >
            <Camera className="h-4 w-4 mr-2" />
            Scan QR
          </Button>
          <Button
            variant={mode === 'manual' ? 'default' : 'outline'}
            onClick={() => setMode('manual')}
            className={mode === 'manual' ? 'bg-white text-black flex-1' : 'flex-1 border-gray-600 text-white'}
          >
            <Keyboard className="h-4 w-4 mr-2" />
            Enter Code
          </Button>
        </div>

        {mode === 'scan' ? (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white text-center">Point Camera at QR Code</CardTitle>
            </CardHeader>
            <CardContent>
              <div id="qr-reader" ref={containerRef} className="rounded-lg overflow-hidden" />
              <p className="text-gray-400 text-sm text-center mt-4">
                Scan the QR code displayed on the LITTR Screen Pro
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white text-center">Enter Claim Code</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <Input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Paste your claim code or URL"
                  className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                  data-testid="input-manual-code"
                />
                <Button 
                  type="submit" 
                  className="w-full bg-white text-black hover:bg-gray-100"
                  disabled={!manualCode.trim()}
                  data-testid="button-claim-manual"
                >
                  Claim Points
                </Button>
              </form>
              <p className="text-gray-400 text-sm text-center mt-4">
                Enter the code shown on your receipt or paste the full URL
              </p>
            </CardContent>
          </Card>
        )}

        {/* Help Text */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm">
            Need help? <a href="/faq" className="text-white underline">Visit FAQ</a>
          </p>
        </div>
      </div>
    </div>
  );
}
