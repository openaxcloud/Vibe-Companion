import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Send, 
  Bot, 
  User, 
  Settings, 
  Plus, 
  Search,
  Sparkles,
  MessageSquare,
  Clock,
  Star
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messages: Message[];
}

export default function SolarTechAIChatApp() {
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: '1',
      title: 'Solar Panel Efficiency Analysis',
      lastMessage: 'Based on your location and energy usage...',
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      messages: [
        {
          id: '1',
          content: 'What\'s the best solar panel configuration for a 2000 sq ft home?',
          sender: 'user',
          timestamp: new Date(Date.now() - 1000 * 60 * 35)
        },
        {
          id: '2',
          content: 'Based on your location and energy usage, I recommend a 6-8kW system with high-efficiency monocrystalline panels. This would typically require 18-24 panels depending on wattage. The system would generate approximately 8,000-12,000 kWh annually.',
          sender: 'ai',
          timestamp: new Date(Date.now() - 1000 * 60 * 30)
        }
      ]
    },
    {
      id: '2',
      title: 'Cost-Benefit Analysis',
      lastMessage: 'The ROI calculation shows...',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      messages: []
    }
  ]);

  const [activeConversation, setActiveConversation] = useState<string>('1');
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation]);

  const getCurrentConversation = () => {
    return conversations.find(conv => conv.id === activeConversation);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const currentConv = getCurrentConversation();
    if (!currentConv) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };

    // Add user message
    setConversations(prev => prev.map(conv => 
      conv.id === activeConversation 
        ? { ...conv, messages: [...conv.messages, userMessage] }
        : conv
    ));

    setInputMessage('');
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: generateAIResponse(inputMessage),
        sender: 'ai',
        timestamp: new Date()
      };

      setConversations(prev => prev.map(conv => 
        conv.id === activeConversation 
          ? { 
              ...conv, 
              messages: [...conv.messages, aiMessage],
              lastMessage: aiMessage.content.substring(0, 50) + '...'
            }
          : conv
      ));

      setIsLoading(false);
      toast({
        title: "Response Generated",
        description: "AI has provided a detailed analysis.",
      });
    }, 2000);
  };

  const generateAIResponse = (userInput: string): string => {
    const responses = [
      "Based on current solar technology and market trends, here's my analysis...",
      "Let me calculate the optimal solution for your specific requirements...",
      "Considering factors like location, budget, and energy needs...",
      "The latest solar panel efficiency ratings suggest...",
      "For maximum cost savings and environmental impact..."
    ];
    return responses[Math.floor(Math.random() * responses.length)] + 
           " This would result in significant energy savings and environmental benefits over the system's 25-year lifespan.";
  };

  const createNewConversation = () => {
    const newConv: Conversation = {
      id: Date.now().toString(),
      title: 'New Solar Consultation',
      lastMessage: '',
      timestamp: new Date(),
      messages: []
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveConversation(newConv.id);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - Conversations */}
      <div className="w-80 border-r bg-card">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              SolarTech AI
            </h2>
            <Button size="sm" onClick={createNewConversation}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search conversations..." className="pl-10" />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            {conversations.map((conversation) => (
              <Card
                key={conversation.id}
                className={`mb-2 cursor-pointer transition-colors ${
                  activeConversation === conversation.id ? 'border-primary' : ''
                }`}
                onClick={() => setActiveConversation(conversation.id)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-[13px] mb-1">{conversation.title}</h3>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {conversation.lastMessage || 'Start a new conversation...'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[11px] text-muted-foreground">
                        {formatTime(conversation.timestamp)}
                      </span>
                      {conversation.messages.length > 0 && (
                        <Badge variant="secondary" className="text-[11px]">
                          {conversation.messages.length}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">{getCurrentConversation()?.title}</h3>
                <p className="text-[13px] text-muted-foreground">Solar Energy Consultant AI</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[11px]">
                <Star className="h-3 w-3 mr-1" />
                Premium AI
              </Badge>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {getCurrentConversation()?.messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.sender === 'ai' && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div className={`max-w-[70%] ${message.sender === 'user' ? 'order-first' : ''}`}>
                  <Card className={message.sender === 'user' ? 'bg-primary text-primary-foreground' : ''}>
                    <CardContent className="p-3">
                      <p className="text-[13px] whitespace-pre-wrap">{message.content}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Clock className="h-3 w-3 opacity-60" />
                        <span className="text-[11px] opacity-60">{formatTime(message.timestamp)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {message.sender === 'user' && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                      <span className="text-[13px]">AI is analyzing...</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t bg-card p-4">
          <div className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask about solar panels, costs, installation..."
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={isLoading}
            />
            <Button onClick={handleSendMessage} disabled={isLoading || !inputMessage.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Get expert advice on solar energy solutions, cost analysis, and installation guidance.
          </p>
        </div>
      </div>
    </div>
  );
}