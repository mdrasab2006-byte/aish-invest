import React, { useState } from 'react';
import { Bot, Send, Loader2, Mail } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function AskAIAssistantSection({ emailAddress }: { emailAddress: string }) {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setResponse('');
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

      const aiResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      const textResponse = aiResponse.text || "I'm sorry, I couldn't process that request right now.";
      setResponse(textResponse);

      // Save query to database optionally
      try {
        await addDoc(collection(db, 'aiQueries'), {
          question: userMessage,
          response: textResponse,
          userId: auth.currentUser?.uid || 'anonymous',
          timestamp: serverTimestamp()
        });
      } catch (dbError) {
        console.error('Failed to save query to DB', dbError);
      }
    } catch (error) {
      console.error('AI Error:', error);
      setResponse('Sorry, I am having trouble connecting right now. Please try again later or contact us via email.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section id="ask-ai" className="py-24 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 text-secondary font-bold tracking-wider uppercase text-sm mb-4">
            <div className="w-8 h-1 bg-secondary rounded-full"></div>
            Ask Our Insurance Assistant
            <div className="w-8 h-1 bg-secondary rounded-full"></div>
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold text-primary mb-6">
            Get instant answers to your insurance questions
          </h2>
        </div>

        <div className="bg-blue-50 rounded-3xl p-8 md:p-12 shadow-lg border border-blue-100">
          <form onSubmit={handleSubmit} className="relative mb-8">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about insurance, claims, or plans..."
              className="w-full pl-6 pr-32 py-5 rounded-2xl border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all text-lg shadow-sm"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-2 bottom-2 bg-primary text-white px-6 rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              <span className="hidden sm:inline">Ask Now</span>
            </button>
          </form>

          {(isLoading || response) && (
            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                  <Bot className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  {isLoading ? (
                    <div className="flex items-center gap-3 h-12 text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="font-medium animate-pulse">Thinking...</span>
                    </div>
                  ) : (
                    <div className="prose prose-slate max-w-none">
                      <p className="whitespace-pre-wrap text-slate-700 leading-relaxed">{response}</p>
                      
                      <div className="mt-8 pt-6 border-t border-slate-100">
                        <p className="text-sm text-slate-500 mb-4 font-medium">
                          Need personalized help? Contact us via email.
                        </p>
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${emailAddress}&su=Insurance Inquiry`, "_blank");
                          }}
                          className="inline-flex items-center gap-2 bg-secondary text-white px-6 py-3 rounded-xl font-bold hover:bg-secondary/90 transition-colors shadow-md shadow-secondary/20 cursor-pointer"
                        >
                          <Mail className="w-4 h-4" /> Contact Now
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
