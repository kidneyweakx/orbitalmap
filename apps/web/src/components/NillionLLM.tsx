import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface NillionLLMProps {
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function NillionLLM({ onClose }: NillionLLMProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to the bottom of the chat when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim()) return;
    
    // Add user message
    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    
    // Clear input and show loading
    setInput('');
    setIsLoading(true);
    
    try {
      // In a real implementation, this would call the Nillion API
      // For demo purposes, we'll simulate a response
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Create a relevant response based on the input
      let responseContent = '';
      const lowercaseInput = input.toLowerCase();
      
      if (lowercaseInput.includes('hello') || lowercaseInput.includes('hi')) {
        responseContent = 'Hello! I am a secure LLM running in a Trusted Execution Environment. How can I help you today?';
      } else if (lowercaseInput.includes('nillion') || lowercaseInput.includes('tee')) {
        responseContent = 'Nillion provides confidential computing infrastructure to protect your data while it\'s being processed. Our technology enables privacy-preserving AI inference with LLMs.';
      } else if (lowercaseInput.includes('privacy') || lowercaseInput.includes('secure')) {
        responseContent = 'When using this LLM, your messages are processed within a Trusted Execution Environment (TEE), which means even the service provider cannot see your data. This ensures your conversations remain private and confidential.';
      } else if (lowercaseInput.includes('map') || lowercaseInput.includes('location')) {
        responseContent = "OrbitalMap allows you to explore and interact with locations while preserving your privacy. The integration with Nillion's TEE ensures that your location data remains confidential even when processed.";
      } else {
        responseContent = 'I\'m processing your request securely in a TEE environment. Your data privacy is protected throughout this interaction. For more specific information about Nillion\'s privacy-preserving technologies, please ask!';
      }
      
      // Add assistant message
      const assistantMessage: Message = { role: 'assistant', content: responseContent };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error getting response:', error);
      
      // Add error message
      const errorMessage: Message = { 
        role: 'assistant', 
        content: 'Sorry, there was an error processing your request. Please try again.' 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="zk-verification-modal tee-zone-modal">
      <div className="tee-modal-container">
        <div className="tee-modal-header">
          <div className="tee-modal-title">
            <span role="img" aria-label="chat">💬</span> {t('nillionLLM.title', 'Nillion LLM Chat')}
          </div>
          <button className="tee-close-button" onClick={onClose}>&times;</button>
        </div>

        <div className="chat-container">
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="assistant-message">
                <div className="message-bubble">
                  {t('nillionLLM.welcomeMessage', 'Welcome to Nillion LLM! Your messages are processed securely in a Trusted Execution Environment. How can I help you today?')}
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <div 
                  key={index} 
                  className={message.role === 'user' ? 'user-message' : 'assistant-message'}
                >
                  <div className="message-bubble">
                    {message.content}
                  </div>
                </div>
              ))
            )}
            
            {isLoading && (
              <div className="assistant-message">
                <div className="message-bubble loading">
                  <div className="dot"></div>
                  <div className="dot"></div>
                  <div className="dot"></div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
          
          <form onSubmit={handleSubmit} className="chat-input-form">
            <input
              type="text"
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('nillionLLM.inputPlaceholder', 'Type a message...')}
              disabled={isLoading}
            />
            <button 
              type="submit" 
              className="send-button tee-button"
              disabled={isLoading || !input.trim()}
            >
              {isLoading 
                ? t('nillionLLM.processing', 'Processing...') 
                : t('nillionLLM.send', 'Send')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
