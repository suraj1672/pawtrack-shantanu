import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bot, Send, User, Dog, Loader2 } from 'lucide-react';
import type { ChatMessage, Dog as DogType } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useLiveSensors } from '@/hooks/useLiveSensors';
import {
  createChatConversation,
  fetchDogsByNgo,
  fetchMedicalHistory,
  fetchMedicalRecords,
  fetchVitalHistory,
  saveChatMessage,
} from '@/lib/api';
import { askDogAssistant } from '@/lib/gemini';

const Chatbot = () => {
  const { user, userNGO } = useAuth();
  const { findReading } = useLiveSensors();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [dogs, setDogs] = useState<DogType[]>([]);
  const [selectedDogId, setSelectedDogId] = useState<string>('none');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hello! I'm your AI Dog Health Assistant. Select a dog to include its live collar readings and stored vital/medical history in my answers.",
      timestamp: new Date(),
    },
  ]);

  useEffect(() => {
    if (!userNGO?.id) return;
    fetchDogsByNgo(userNGO.id).then(setDogs).catch(console.error);
  }, [userNGO?.id]);

  useEffect(() => {
    if (!user?.id) return;
    createChatConversation(user.id, selectedDogId === 'none' ? null : selectedDogId)
      .then(conv => setConversationId(conv.id))
      .catch(console.error);
  }, [user?.id, selectedDogId]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      if (conversationId) {
        await saveChatMessage(conversationId, 'user', text).catch(() => undefined);
      }

      const dog = dogs.find(d => d.id === selectedDogId) || null;
      const [history, vitals, records] = dog
        ? await Promise.all([
            fetchMedicalHistory(dog.id),
            fetchVitalHistory(dog.id, 14),
            fetchMedicalRecords(dog.id),
          ])
        : [[], [], []];

      const liveReading = dog
        ? findReading(dog.deviceId, dog.id, dog.name)
        : null;

      const reply = await askDogAssistant(text, {
        dog,
        history,
        vitals,
        records,
        liveReading,
        hasAlert: dog?.hasAlert,
        alertMessage: dog?.alertMessage,
      });

      const botMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMsg]);

      if (conversationId) {
        await saveChatMessage(conversationId, 'assistant', reply).catch(() => undefined);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, I had trouble answering that. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <Dog className="h-16 w-16 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold">AI Dog Health Assistant</h1>
          <p className="text-muted-foreground">
            Powered by live collar data and stored vital & medical history
          </p>
        </div>

        <div className="mb-4 max-w-sm mx-auto">
          <Select value={selectedDogId} onValueChange={setSelectedDogId}>
            <SelectTrigger>
              <SelectValue placeholder="Optional: focus on a dog" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">General advice</SelectItem>
              {dogs.map(d => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name} {d.hasAlert ? '⚠️' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card className="h-[600px] flex flex-col">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] p-3 rounded-lg whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.role === 'user' && (
                    <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}

              {sending && (
                <div className="flex gap-3" aria-live="polite" aria-label="Assistant is typing">
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="bg-muted px-4 py-3 rounded-lg flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/70 animate-bounce" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <CardContent className="border-t p-4">
            <div className="flex gap-2">
              <Input
                placeholder="Ask about dog health..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                disabled={sending}
              />
              <Button onClick={handleSend} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Chatbot;
