import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { useState } from "react";
import { useLocation } from "wouter";

export function Login({ type }: { type: 'admin' | 'staff' | 'partner' }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const login = useStore((state) => state.login);
  const [, setLocation] = useLocation();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock login - any non-empty credential works for demo
    if (username && password) {
      login(type);
      setLocation(`/${type}/dashboard`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 capitalize text-center">{type} Login</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <Label>Username</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <Label>Password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full">Sign In</Button>
        </form>
      </div>
    </div>
  );
}
