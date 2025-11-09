import React, { useState, useEffect, useRef } from 'react';
import { createChatSession } from '../services/geminiService';
import type { Chat } from '@google/genai';
import type { ChatMessage } from '../types';
import { PaperAirplaneIcon, UserCircleIcon, SparklesIcon, LoaderIcon } from './Icons';
import { useTranslation } from '../contexts/LanguageContext';

interface ChatbotProps {
  landmarkName: string;
}

export const Chatbot: React.FC<ChatbotProps> = ({ landmarkName }) => {
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const initializeChat = async () => {
      setIsLoading(true);

      const systemInstruction = t('chatbotSystemInstruction', { landmarkName });
      const initialMessage = t('chatbotInitialMessage');

      const chatSession = createChatSession(systemInstruction);
      setChat(chatSession);
      
      const response = await chatSession.sendMessage({ message: initialMessage });
      
      setMessages([{ role: 'model', text: response.text }]);
      setIsLoading(false);
    };

    initializeChat();
  }, [landmarkName, t]);

  useEffect(() => {
    if (chatBodyRef.current) {
      // Set the scrollTop to the full scrollHeight to scroll to the bottom.
      // This method confines the scroll to this element and won't affect the window's scroll position.
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !chat || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chat.sendMessage({ message: input });
      const modelMessage: ChatMessage = { role: 'model', text: response.text };
      setMessages(prev => [...prev, modelMessage]);
    } catch (error) {
      console.error("Chatbot error:", error);
      const errorMessage: ChatMessage = { role: 'model', text: t('chatbotError') };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
    const isUser = message.role === 'user';
    return (
      <div className={`flex items-start gap-3 ${isUser ? 'justify-end' : ''}`}>
        {!isUser && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-blue flex items-center justify-center text-white"><SparklesIcon className="w-5 h-5" /></div>}
        <div className={`max-w-xs md:max-w-md p-3 rounded-2xl ${isUser ? 'bg-brand-blue text-white rounded-br-none' : 'bg-gray-100 text-brand-dark dark:bg-gray-700 dark:text-gray-200 rounded-bl-none'}`}>
          <p className="text-sm leading-relaxed">{message.text}</p>
        </div>
        {isUser && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300"><UserCircleIcon className="w-6 h-6" /></div>}
      </div>
    );
  };


  return (
    <div className="flex flex-col h-80 md:h-96 bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
      <div ref={chatBodyRef} className="flex-grow p-4 space-y-4 overflow-y-auto">
        {messages.map((msg, index) => (
          <MessageBubble key={index} message={msg} />
        ))}
        {isLoading && messages.length > 0 && (
          <div className="flex items-start gap-3">
             <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-blue flex items-center justify-center text-white"><SparklesIcon className="w-5 h-5" /></div>
            <div className="max-w-xs md:max-w-md p-3 rounded-2xl bg-gray-100 dark:bg-gray-700 text-brand-dark dark:text-gray-200 rounded-bl-none">
              <LoaderIcon className="w-5 h-5 animate-spin"/>
            </div>
          </div>
        )}
      </div>
      <form onSubmit={handleSend} className="p-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('chatbotPlaceholder')}
          className="flex-grow w-full px-4 py-2 text-sm text-gray-700 dark:text-white bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-brand-blue"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="p-2 text-white bg-brand-blue rounded-full hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-blue disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          aria-label={t('chatbotSendAriaLabel')}
        >
          <PaperAirplaneIcon className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};