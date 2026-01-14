import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Send, Inbox, MailOpen, Archive, Clock, CheckCircle, ExternalLink } from "lucide-react";
import { apiRequest } from "@/lib/store";
import type { QueryClient } from "@tanstack/react-query";

interface Mailbox {
  id: number;
  userId: string;
  emailAddress: string;
  displayName: string;
  isActive: boolean;
  unreadCount?: number;
}

interface InternalMessage {
  id: number;
  fromMailboxId: number;
  toMailboxId: number | null;
  toExternal: string | null;
  subject: string;
  body: string;
  isRead: boolean;
  isArchived: boolean;
  isOutbound: boolean;
  sentAt: string;
  fromMailbox?: Mailbox;
  toMailbox?: Mailbox | null;
}

interface InboxPortalProps {
  myMailbox: Mailbox;
  inboxMessages: InternalMessage[];
  sentMessages: InternalMessage[];
  mailboxes: Mailbox[];
  queryClient: QueryClient;
}

export function InboxPortal({ myMailbox, inboxMessages, sentMessages, mailboxes, queryClient }: InboxPortalProps) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [viewingMessage, setViewingMessage] = useState<InternalMessage | null>(null);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const sendMessage = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('/api/inbox/send', {
        method: 'POST',
        body: JSON.stringify({ to, subject, body }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to send');
      }
      return res.json();
    },
    onSuccess: () => {
      setStatus('sent');
      queryClient.invalidateQueries({ queryKey: ['inboxMessages'] });
      queryClient.invalidateQueries({ queryKey: ['sentMessages'] });
      queryClient.invalidateQueries({ queryKey: ['myMailbox'] });
      setTimeout(() => {
        setStatus('idle');
        setComposeOpen(false);
        setTo('');
        setSubject('');
        setBody('');
      }, 1500);
    },
    onError: () => {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    },
  });

  const archiveMessage = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest(`/api/inbox/messages/${id}/archive`, {
        method: 'PATCH',
      });
      if (!res.ok) throw new Error('Failed to archive');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inboxMessages'] });
      queryClient.invalidateQueries({ queryKey: ['myMailbox'] });
      setViewingMessage(null);
    },
  });

  const viewMessage = async (msg: InternalMessage) => {
    setViewingMessage(msg);
    if (!msg.isRead && !msg.isOutbound) {
      const res = await apiRequest(`/api/inbox/messages/${msg.id}`);
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['inboxMessages'] });
        queryClient.invalidateQueries({ queryKey: ['myMailbox'] });
      }
    }
  };

  const handleSend = () => {
    if (!to || !subject || !body) return;
    setStatus('sending');
    sendMessage.mutate();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (date >= today) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="h-5 w-5" />
                {myMailbox.displayName}'s Inbox
              </CardTitle>
              <CardDescription>{myMailbox.emailAddress}</CardDescription>
            </div>
            <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-compose">
                  <Send className="h-4 w-4 mr-2" />
                  Compose
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>New Message</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="compose-to">To</Label>
                    <div className="flex gap-2">
                      <Select onValueChange={(v) => setTo(v)}>
                        <SelectTrigger className="flex-1" data-testid="select-compose-to">
                          <SelectValue placeholder="Select recipient or type email" />
                        </SelectTrigger>
                        <SelectContent>
                          {mailboxes.filter(m => m.id !== myMailbox.id).map(m => (
                            <SelectItem key={m.id} value={m.emailAddress}>
                              {m.displayName} ({m.emailAddress})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input 
                      className="mt-2"
                      placeholder="Or type any email address..." 
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      data-testid="input-compose-to"
                    />
                  </div>
                  <div>
                    <Label htmlFor="compose-subject">Subject</Label>
                    <Input 
                      id="compose-subject"
                      placeholder="Email subject..." 
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      data-testid="input-compose-subject"
                    />
                  </div>
                  <div>
                    <Label htmlFor="compose-body">Message</Label>
                    <Textarea 
                      id="compose-body"
                      placeholder="Write your message here..." 
                      rows={8}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      className="resize-none"
                      data-testid="input-compose-body"
                    />
                  </div>
                  <Button 
                    onClick={handleSend}
                    disabled={!to || !subject || !body || status === 'sending'}
                    className="w-full"
                    data-testid="button-send-message"
                  >
                    {status === 'sending' ? (
                      <>Sending...</>
                    ) : status === 'sent' ? (
                      <><CheckCircle className="h-4 w-4 mr-2" /> Sent!</>
                    ) : status === 'error' ? (
                      <>Failed to send</>
                    ) : (
                      <><Send className="h-4 w-4 mr-2" /> Send Message</>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="inbox">
              <TabsList className="w-full">
                <TabsTrigger value="inbox" className="flex-1">
                  <Inbox className="h-4 w-4 mr-2" />
                  Inbox ({inboxMessages.length})
                </TabsTrigger>
                <TabsTrigger value="sent" className="flex-1">
                  <Send className="h-4 w-4 mr-2" />
                  Sent ({sentMessages.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="inbox" className="mt-4">
                {inboxMessages.length === 0 ? (
                  <div className="text-center py-12">
                    <MailOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No messages yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {inboxMessages.map((msg) => (
                      <div 
                        key={msg.id}
                        className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                          msg.isRead 
                            ? 'border-gray-700 hover:border-gray-500 bg-transparent' 
                            : 'border-blue-500/50 bg-blue-900/10 hover:bg-blue-900/20'
                        }`}
                        onClick={() => viewMessage(msg)}
                        data-testid={`message-${msg.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {!msg.isRead && (
                                <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                              )}
                              <span className="font-medium text-sm truncate">
                                {msg.fromMailbox?.displayName || 'Unknown'}
                              </span>
                              <span className="text-xs text-gray-500 flex-shrink-0">
                                <Clock className="h-3 w-3 inline mr-1" />
                                {formatDate(msg.sentAt)}
                              </span>
                            </div>
                            <p className="font-medium text-sm mt-1 truncate">{msg.subject}</p>
                            <p className="text-xs text-gray-500 truncate">{msg.body}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="sent" className="mt-4">
                {sentMessages.length === 0 ? (
                  <div className="text-center py-12">
                    <Send className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No sent messages</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sentMessages.map((msg) => (
                      <div 
                        key={msg.id}
                        className="p-4 rounded-lg border border-gray-700 hover:border-gray-500 cursor-pointer"
                        onClick={() => setViewingMessage(msg)}
                        data-testid={`sent-message-${msg.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">To:</span>
                              <span className="font-medium text-sm truncate">
                                {msg.toMailbox?.displayName || msg.toExternal || 'Unknown'}
                              </span>
                              {msg.toExternal && (
                                <ExternalLink className="h-3 w-3 text-gray-400" />
                              )}
                              <span className="text-xs text-gray-500 flex-shrink-0">
                                {formatDate(msg.sentAt)}
                              </span>
                            </div>
                            <p className="font-medium text-sm mt-1 truncate">{msg.subject}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div>
        {viewingMessage ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{viewingMessage.subject}</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setViewingMessage(null)}
                  data-testid="button-close-message"
                >
                  &times;
                </Button>
              </div>
              <CardDescription>
                {viewingMessage.isOutbound ? (
                  <>To: {viewingMessage.toMailbox?.displayName || viewingMessage.toExternal}</>
                ) : (
                  <>From: {viewingMessage.fromMailbox?.displayName || 'Unknown'}</>
                )}
                <br />
                {new Date(viewingMessage.sentAt).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm prose-invert max-w-none">
                <p className="whitespace-pre-wrap text-sm">{viewingMessage.body}</p>
              </div>
              {!viewingMessage.isOutbound && (
                <div className="mt-6 pt-4 border-t border-gray-700 flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setTo(viewingMessage.fromMailbox?.emailAddress || '');
                      setSubject(`Re: ${viewingMessage.subject}`);
                      setComposeOpen(true);
                    }}
                    data-testid="button-reply"
                  >
                    Reply
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-gray-400"
                    onClick={() => archiveMessage.mutate(viewingMessage.id)}
                    disabled={archiveMessage.isPending}
                    data-testid="button-archive"
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Archive
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Mail className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Select a message to read</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
