import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatMessage, ChatRequest, sendChatRequest } from '../utils/api';

interface NillionLLMProps {
  onClose: () => void;
}

export function NillionLLM({ onClose }: NillionLLMProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'system', content: 'You are a helpful assistant powered by Nillion secure computing.' }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userInput.trim()) return;
    
    // Add user message to chat
    const userMessage: ChatMessage = { role: 'user', content: userInput };
    const newMessages: ChatMessage[] = [...messages, userMessage];
    
    setMessages(newMessages);
    setUserInput('');
    setIsLoading(true);
    
    try {
      const request: ChatRequest = {
        messages: newMessages
      };
      
      const response = await sendChatRequest(request);
      
      // Add assistant response to chat
      setMessages([...newMessages, response]);
    } catch (error) {
      console.error('Error sending chat request:', error);
      const errorMessage: ChatMessage = { 
        role: 'assistant', 
        content: 'Sorry, there was an error processing your request. Please try again later.'
      };
      setMessages([...newMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="zk-verification-modal tee-zone-modal">
      <div className="modal-header">
        <div className="modal-title">
          <img 
            src="https://avatars.githubusercontent.com/u/99333377?s=280&v=4" 
            alt="Nillion Logo" 
            className="nillion-logo" 
          />
          <h2>{t('nillionLLM.title')}</h2>
        </div>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="modal-content">
        <div className="chat-container">
          <div className="chat-messages">
            {messages.map((message, index) => (
              message.role !== 'system' && (
                <div 
                  key={index} 
                  className={`chat-message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
                >
                  <div className="message-bubble">
                    {message.content}
                  </div>
                </div>
              )
            ))}
            {isLoading && (
              <div className="chat-message assistant-message">
                <div className="message-bubble loading">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
              </div>
            )}
          </div>
          
          <form className="chat-input-form" onSubmit={handleSubmit}>
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder={t('nillionLLM.inputPlaceholder')}
              disabled={isLoading}
              className="chat-input"
            />
            <button 
              type="submit" 
              disabled={isLoading || !userInput.trim()}
              className="send-button tee-button"
            >
              {isLoading ? t('nillionLLM.processing') : t('nillionLLM.send')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
