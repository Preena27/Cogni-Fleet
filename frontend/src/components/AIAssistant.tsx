import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, MessageSquare, Send, X, Bot, RefreshCw } from 'lucide-react';

interface Message {
  sender: 'user' | 'assistant';
  text: string;
}

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { 
      sender: 'assistant', 
      text: "Hello! I am your CogniFleet AI Assistant. I have live access to the database state.\n\nAsk me queries like:\n- **Which driver is available?**\n- **Which truck needs maintenance?**\n- **Generate today's summary.**" 
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || loading) return;

    const userText = inputText;
    const conversation = messages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text
    }));

    setInputText('');
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userText,
          conversation
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { sender: 'assistant', text: data.response }]);
      } else {
        setMessages(prev => [...prev, { sender: 'assistant', text: "Error: I couldn't reach the AI coordinator. Please check backend API server logs." }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { sender: 'assistant', text: "Network error: Failed to connect to backend server. Ensure FastAPI is running on localhost:8000." }]);
    } finally {
      setLoading(false);
    }
  };

  // Safe Markdown-to-HTML parser fallback
  const parseMarkdown = (text: string) => {
    let html = text;

    // Headers ###
    html = html.replace(/^### (.*$)/gim, '<h4 class="font-bold text-xs uppercase text-primary-500 mt-2 mb-1">$1</h4>');

    // Bold **text**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-800 dark:text-slate-205">$1</strong>');

    // Bullet points - or *
    html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="ml-4 list-disc pl-1">$1</li>');

    // Tables
    if (html.includes('|')) {
      const lines = html.split('\n');
      let tableOpen = false;
      let tableHtml = '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('|')) {
          // Skip divider rows like |---|---|
          if (line.includes('---')) continue;
          
          if (!tableOpen) {
            tableHtml += '<table class="w-full text-left my-2 border-collapse text-[10px]"><tbody class="divide-y border-y dark:border-slate-800">';
            tableOpen = true;
          }
          
          const cells = line.split('|').map(c => c.trim()).filter(c => c !== '');
          tableHtml += '<tr class="hover:bg-slate-105 dark:hover:bg-slate-800/10">';
          cells.forEach(cell => {
            tableHtml += `<td class="py-1.5 px-1">${cell}</td>`;
          });
          tableHtml += '</tr>';
        } else {
          if (tableOpen) {
            tableHtml += '</tbody></table>';
            tableOpen = false;
          }
          tableHtml += line + '\n';
        }
      }
      if (tableOpen) {
        tableHtml += '</tbody></table>';
      }
      html = tableHtml;
    }

    // Line breaks
    html = html.replace(/\n/g, '<br/>');

    return <div dangerouslySetInnerHTML={{ __html: html }} className="flex flex-col gap-1 text-xs text-slate-750 dark:text-slate-350 leading-relaxed font-sans" />;
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Popover Window */}
      {isOpen && (
        <div className="mb-4 w-80 h-[400px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-soft-lg flex flex-col overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-3 text-white flex items-center justify-between shrink-0 shadow-soft-sm">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-white" />
              <div>
                <h3 className="font-bold text-xs font-sans tracking-tight">AI Fleet Assistant</h3>
                <span className="text-[8px] uppercase tracking-wider block opacity-85 -mt-0.5">Online • Direct DB Access</span>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-white opacity-80 hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Chat message box area */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 bg-slate-50/50 dark:bg-slate-950/20">
            {messages.map((msg, idx) => (
              <div 
                key={idx}
                className={`flex gap-2 max-w-[85%] ${
                  msg.sender === 'user' ? 'self-end flex-row-reverse' : 'self-start'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-[9px] ${
                  msg.sender === 'user' ? 'bg-primary-500' : 'bg-indigo-500'
                }`}>
                  {msg.sender === 'user' ? 'U' : 'AI'}
                </div>
                <div className={`p-2.5 rounded-xl text-xs shadow-soft-sm border ${
                  msg.sender === 'user' 
                    ? 'bg-primary-500 border-primary-500 text-white rounded-tr-none' 
                    : 'bg-white dark:bg-slate-850 border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-150 rounded-tl-none'
                }`}>
                  {msg.sender === 'user' ? (
                    <p className="leading-relaxed font-sans">{msg.text}</p>
                  ) : (
                    parseMarkdown(msg.text)
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2 max-w-[85%] self-start animate-pulse">
                <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center shrink-0 text-white font-bold text-[9px]">
                  AI
                </div>
                <div className="p-2.5 rounded-xl text-[10px] bg-white dark:bg-slate-850 border border-slate-100 dark:border-slate-800 text-slate-400 font-semibold flex items-center gap-1.5 rounded-tl-none">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                  Generating database audit...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Form message sender */}
          <form onSubmit={handleSend} className="p-3 border-t bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 flex gap-2 shrink-0">
            <input 
              type="text" placeholder="Query available drivers, stats..."
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg border border-slate-205 dark:border-slate-800 bg-transparent text-xs text-slate-700 dark:text-slate-350 focus:outline-none"
            />
            <button 
              type="submit"
              disabled={!inputText.trim() || loading}
              className="p-2 bg-indigo-600 hover:bg-indigo-750 text-white disabled:bg-slate-205 rounded-lg flex items-center justify-center transition-colors shadow-soft-sm glow-primary"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Floating trigger button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 bg-gradient-to-tr from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105 glow-primary"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5 animate-pulse" />}
      </button>
    </div>
  );
}
