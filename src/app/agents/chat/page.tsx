"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Bot, User } from "lucide-react";

interface Agent {
  agent_id: string;
  name: string;
  role: string;
  model: string;
}

interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  agent?: string;
  timestamp: Date;
}

const AGENTS: Agent[] = [
  { agent_id: "brooks", name: "Frederick Brooks", role: "Orchestrator", model: "GLM-5" },
  { agent_id: "knuth", name: "Donald Knuth", role: "Deep Worker", model: "GPT-5.4-mini" },
  { agent_id: "turing", name: "Alan Turing", role: "Architecture", model: "GPT-5.4-mini" },
  { agent_id: "berners-lee", name: "Tim Berners-Lee", role: "Curator", model: "Kimi 2.5" },
  { agent_id: "hopper", name: "Grace Hopper", role: "Explorer", model: "Gemma 4" },
  { agent_id: "cerf", name: "Vint Cerf", role: "Context Manager", model: "GLM-5" },
  { agent_id: "torvalds", name: "Linus Torvalds", role: "Code Generator", model: "GPT-5.4-mini" },
  { agent_id: "liskov", name: "Barbara Liskov", role: "Analyst", model: "Kimi 2.5" },
  { agent_id: "dijkstra", name: "Edsger Dijkstra", role: "Reviewer", model: "GLM-5" },
  { agent_id: "hinton", name: "Geoffrey Hinton", role: "Vision", model: "Kimi 2.5" },
];

export default function AgentChat() {
  const [selectedAgent, setSelectedAgent] = useState<string>("brooks");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const currentAgent = AGENTS.find(a => a.agent_id === selectedAgent);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Simulate agent response
    setTimeout(() => {
      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "agent",
        content: `[${currentAgent?.name}] Processing your request about "${input.substring(0, 50)}..."`,
        agent: currentAgent?.name,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, agentMessage]);
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Allura Agent Chat</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Agent Selection */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Select Agent</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger>
                <SelectValue placeholder="Choose agent..." />
              </SelectTrigger>
              <SelectContent>
                {AGENTS.map(agent => (
                  <SelectItem key={agent.agent_id} value={agent.agent_id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{agent.name}</span>
                      <span className="text-xs text-muted-foreground">{agent.role}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {currentAgent && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="font-medium">{currentAgent.name}</p>
                <p className="text-sm text-muted-foreground">{currentAgent.role}</p>
                <p className="text-xs text-muted-foreground mt-1">Model: {currentAgent.model}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              Chat with {currentAgent?.name || "Agent"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] border rounded-lg p-4 mb-4">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Start a conversation with {currentAgent?.name}</p>
                  <p className="text-sm mt-2">They can help with {currentAgent?.role.toLowerCase()}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map(message => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                    >
                      <Avatar className={message.role === "user" ? "bg-primary" : "bg-secondary"}>
                        <AvatarFallback>
                          {message.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        {message.agent && (
                          <p className="text-xs font-medium mb-1 opacity-70">{message.agent}</p>
                        )}
                        <p className="text-sm">{message.content}</p>
                        <p className="text-xs opacity-50 mt-1">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex gap-3">
                      <Avatar className="bg-secondary">
                        <AvatarFallback><Bot className="w-4 h-4" /></AvatarFallback>
                      </Avatar>
                      <div className="bg-muted p-3 rounded-lg">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-foreground rounded-full animate-bounce" />
                          <span className="w-2 h-2 bg-foreground rounded-full animate-bounce delay-100" />
                          <span className="w-2 h-2 bg-foreground rounded-full animate-bounce delay-200" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            <div className="flex gap-2">
              <Textarea
                placeholder={`Ask ${currentAgent?.name} about ${currentAgent?.role.toLowerCase()}...`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className="flex-1"
                rows={2}
              />
              <Button onClick={handleSend} disabled={isLoading || !input.trim()} className="px-4">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
