import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Loader2, Mail } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hi! I am your AI Insurance Advisor. How can I help you today? (e.g., "Which insurance plan is best for me?")'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleOpenChat = (e: CustomEvent) => {
      setIsOpen(true);
      if (e.detail && e.detail.plan) {
        const planName = e.detail.plan;
        setInput(`Tell me about ${planName}`);
      }
    };
    window.addEventListener('open-ai-chat', handleOpenChat as EventListener);
    return () => window.removeEventListener('open-ai-chat', handleOpenChat as EventListener);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const userName = auth.currentUser?.displayName || 'Friend';

      const prompt = `
You are a smart, professional, and helpful insurance advisor for "Aish Mohammad Siddiqui", an insurance agent in Kanpur Nagar.
Your goal is to provide basic guidance, simple and clear explanations, and plan suggestions.
You can answer any type of questions including LIC plans, claims, health, bike, car insurance, mutual funds, and general guidance.

CRITICAL INSTRUCTION - LANGUAGE BEHAVIOR:
- Detect the user's language automatically from their query.
- Respond ONLY in that detected language.
- DO NOT mention the language name.
- DO NOT mix languages.
- DO NOT translate.

CRITICAL INSTRUCTION - RESPONSE STYLE:
- Start with the user's name: "Hi ${userName},"
- Provide a short explanation.
- Provide key benefits.
- Provide a simple suggestion.
- Keep your answers short, practical, and easy to understand.
- Do not provide exact quotes or legally binding advice.

User Query: ${userMessage}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      const aiResponse = response.text || "I'm sorry, I couldn't process that request right now.";

      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: aiResponse }]);

      // Save query to database optionally
      try {
        await addDoc(collection(db, 'aiQueries'), {
          question: userMessage,
          response: aiResponse,
          userId: auth.currentUser?.uid || 'anonymous',
          timestamp: serverTimestamp()
        });
      } catch (dbError) {
        // Ignore DB errors for AI queries to ensure chat still works
        console.error('Failed to save query to DB', dbError);
      }
    } catch (error) {
      console.error('AI Error:', error);
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'assistant', 
        content: 'Sorry, I am having trouble connecting right now. Please try again later or contact us via email.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-40 bg-primary hover:bg-primary/90 text-white w-16 h-16 rounded-full flex items-center justify-center shadow-2xl shadow-primary/40 transition-transform hover:scale-110 hover:-translate-y-1 ${isOpen ? 'hidden' : 'flex'}`}
        aria-label="Open AI Assistant"
      >
        <MessageSquare className="w-8 h-8" />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[90vw] max-w-[400px] h-[600px] max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 flex flex-col">
          {/* Header */}
          <div className="bg-primary text-white p-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold">AI Insurance Advisor</h3>
                <p className="text-xs text-blue-200">Online | Fast & Helpful</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-secondary text-white' : 'bg-primary text-white'}`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div 
                  className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                    msg.role === 'user' 
                      ? 'bg-secondary text-white rounded-tr-none' 
                      : 'bg-white text-slate-800 shadow-sm border border-slate-100 rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.role === 'assistant' && msg.id !== '1' && (
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <p className="text-xs text-slate-500 mb-2 font-medium">
                        Need personalized help? Contact us via email.
                      </p>
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          window.open("https://mail.google.com/mail/?view=cm&fs=1&to=aish8512@gmail.com&su=Insurance Inquiry", "_blank");
                        }}
                        className="inline-flex items-center gap-1.5 bg-secondary text-white px-3 py-1.5 rounded-lg font-bold hover:bg-secondary/90 transition-colors shadow-sm text-xs cursor-pointer"
                      >
                        <Mail className="w-3 h-3" /> Contact Now
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 flex-row">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white text-slate-800 shadow-sm border border-slate-100 p-3 rounded-2xl rounded-tl-none flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-slate-500">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Disclaimer */}
          <div className="bg-slate-100 p-2 text-center shrink-0 border-t border-slate-200">
            <p className="text-[10px] text-slate-500">
              This is general guidance. For personalized advice, please contact via email.
            </p>
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-slate-200 shrink-0">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about insurance plans..."
                className="flex-1 px-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-secondary focus:ring-2 focus:ring-secondary/20 rounded-xl outline-none transition-all text-sm"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
