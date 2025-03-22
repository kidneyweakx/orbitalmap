import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import mapboxgl from 'mapbox-gl';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface MapChatAssistantProps {
  map: mapboxgl.Map | null;
  userLocation?: [number, number];
}

interface Recommendation {
  name: string;
  type: string;
  description: string;
  coordinates: [number, number];
}

/**
 * Map Chat Assistant component that provides a chat interface for users to interact with the map
 * and get recommendations for travel and food.
 */
export function MapChatAssistant({ map, userLocation }: MapChatAssistantProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [markersRef, setMarkersRef] = useState<{ [id: string]: mapboxgl.Marker }>({});
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [isFirstOpen, setIsFirstOpen] = useState(true);
  const [exploreMode, setExploreMode] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to the bottom of the chat when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Clean up markers when component unmounts
  useEffect(() => {
    return () => {
      Object.values(markersRef).forEach(marker => marker.remove());
    };
  }, [markersRef]);
  
  // Show notification dot when chat is closed and there's a new message
  useEffect(() => {
    if (messages.length > 0 && !isOpen) {
      setHasNewMessage(true);
    }
  }, [messages, isOpen]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setHasNewMessage(false);
      // Add welcome message on first open
      if (isFirstOpen && messages.length === 0) {
        setIsFirstOpen(false);
      }
    }
  };

  const handleShortcutClick = (query: string, mode?: string) => {
    setInput(query);
    if (mode) {
      setExploreMode(mode);
    }
    handleSubmit(null, query);
  };

  const handleSubmit = async (e: React.FormEvent | null, shortcutQuery?: string) => {
    if (e) e.preventDefault();
    
    const queryText = shortcutQuery || input;
    if (!queryText.trim() || isLoading || !map) return;
    
    // Add user message
    const userMessage: Message = { role: 'user', content: queryText };
    setMessages(prev => [...prev, userMessage]);
    
    // Clear input and show loading
    if (!shortcutQuery) setInput('');
    setIsLoading(true);
    
    try {
      // Get current map bounds to determine area of interest
      const bounds = map.getBounds();
      const currentUserLocation = userLocation || (
        map.getCenter ? [map.getCenter().lng, map.getCenter().lat] : [0, 0]
      );
      
      // Check if bounds exist
      if (!bounds) {
        throw new Error('Map bounds not available');
      }
      
      // Prepare request data
      const requestData = {
        query: queryText,
        userLocation: {
          longitude: currentUserLocation[0],
          latitude: currentUserLocation[1]
        },
        mapData: {
          bounds: {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest()
          }
        },
        exploreMode: exploreMode
      };
      
      // Add analytics for exploration modes
      if (exploreMode) {
        console.log(`Explore mode activated: ${exploreMode}`);
      }
      
      // Make API call to our recommendation endpoint
      const response = await fetch('/api/user/map-interaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to get recommendations');
      }
      
      const data = await response.json();
      
      // Add assistant response
      const assistantMessage: Message = { 
        role: 'assistant', 
        content: data.response || 'Here are some recommendations for you.'
      };
      setMessages(prev => [...prev, assistantMessage]);
      
      // Process and display recommendations
      if (data.points && data.points.length > 0) {
        displayRecommendationsOnMap(data.points);
      }
    } catch (error) {
      console.error('Error getting recommendations:', error);
      
      // Add error message
      const errorMessage: Message = {
        role: 'assistant',
        content: t('mapChat.error', 'Sorry, I encountered an error while processing your request. Please try again.')
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const displayRecommendationsOnMap = (points: Recommendation[]) => {
    if (!map) return;
    
    // Clear existing markers
    Object.values(markersRef).forEach(marker => marker.remove());
    const newMarkers: { [id: string]: mapboxgl.Marker } = {};
    
    // Add route visual if needed (for multi-point recommendations)
    if (points.length > 1 && exploreMode === 'route') {
      addRouteBetweenPoints(points);
    }
    
    // Create new markers
    points.forEach((point, index) => {
      // Create marker element
      const el = document.createElement('div');
      el.className = 'recommendation-marker';
      
      // Choose icon based on recommendation type
      let emoji = '📍';
      if (point.type.toLowerCase().includes('food') || point.type.toLowerCase().includes('restaurant')) {
        emoji = '🍽️';
      } else if (point.type.toLowerCase().includes('attraction')) {
        emoji = '🏛️';
      } else if (point.type.toLowerCase().includes('shopping')) {
        emoji = '🛍️';
      } else if (point.type.toLowerCase().includes('hotel')) {
        emoji = '🏨';
      } else if (point.type.toLowerCase().includes('park')) {
        emoji = '🌳';
      } else if (point.type.toLowerCase().includes('event')) {
        emoji = '🎭';
      } else if (point.type.toLowerCase().includes('hidden')) {
        emoji = '💎';
      }
      
      el.textContent = emoji;
      
      // Add visual indicator for marker number if in route mode
      if (exploreMode === 'route') {
        const numberIndicator = document.createElement('div');
        numberIndicator.className = 'marker-number';
        numberIndicator.textContent = (index + 1).toString();
        el.appendChild(numberIndicator);
      }
      
      // Create popup with content
      const popup = new mapboxgl.Popup({ offset: 25 })
        .setHTML(`
          <div class="recommendation-popup">
            <h3>${point.name}</h3>
            <p class="recommendation-type">${point.type}</p>
            <p>${point.description}</p>
          </div>
        `);
      
      // Add marker to map
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat(point.coordinates)
        .setPopup(popup)
        .addTo(map);
      
      newMarkers[`rec-${index}`] = marker;
    });
    
    setMarkersRef(newMarkers);
    
    // Fit bounds to show all markers
    if (points.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      points.forEach(point => {
        bounds.extend(point.coordinates);
      });
      
      map.fitBounds(bounds, {
        padding: 50,
        maxZoom: 15
      });
    }
  };
  
  // Function to add a visual route between points for route-based recommendations
  const addRouteBetweenPoints = (points: Recommendation[]) => {
    if (!map || points.length < 2) return;
    
    // Remove existing route
    if (map.getSource('route-source')) {
      map.removeLayer('route-line');
      map.removeSource('route-source');
    }
    
    // Create route coordinates
    const routeCoordinates = points.map(point => point.coordinates);
    
    // Add route source and layer
    map.addSource('route-source', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: routeCoordinates
        }
      }
    });
    
    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route-source',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#4338ca',
        'line-width': 3,
        'line-dasharray': [0, 2, 1]
      }
    });
  };

  return (
    <>
      {/* Chat Bubble Button */}
      <div 
        className={`chat-bubble-button ${isOpen ? 'active' : ''}`}
        onClick={toggleChat}
      >
        <div className="chat-bubble-icon">
          <span role="img" aria-label="chat">💬</span>
          {hasNewMessage && !isOpen && <div className="chat-notification-dot"></div>}
        </div>
      </div>
      
      {/* Chat Panel */}
      {isOpen && (
        <div className="chat-panel" ref={chatContainerRef}>
          <div className="chat-header">
            <h3><span className="header-icon">🧭</span> {t('mapChat.title', 'Travel Assistant')}</h3>
            <button className="close-button" onClick={toggleChat}>&times;</button>
          </div>
          
          {/* Enhanced Shortcut Buttons */}
          <div className="shortcut-buttons">
            <button 
              onClick={() => handleShortcutClick(t('mapChat.travelShortcut', 'Recommend top attractions near me'), 'attractions')}
              className="shortcut-button travel"
            >
              <span className="shortcut-icon">🧳</span>
              {t('mapChat.travelButton', 'Travel')}
            </button>
            <button 
              onClick={() => handleShortcutClick(t('mapChat.foodShortcut', 'Find good restaurants nearby'), 'food')}
              className="shortcut-button food"
            >
              <span className="shortcut-icon">🍽️</span>
              {t('mapChat.foodButton', 'Food')}
            </button>
            <button 
              onClick={() => handleShortcutClick('Suggest a perfect day trip itinerary', 'route')}
              className="shortcut-button explore"
            >
              <span className="shortcut-icon">🌟</span>
              {t('mapChat.exploreButton', 'Explore')}
            </button>
            <button 
              onClick={() => handleShortcutClick('Are there any events or festivals happening now?', 'events')}
              className="shortcut-button events"
            >
              <span className="shortcut-icon">🎭</span>
              {t('mapChat.eventsButton', 'Events')}
            </button>
          </div>
          
          {/* Messages Area */}
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="assistant-message">
                <div className="message-bubble">
                  {t('mapChat.welcomeMessage', 'Hello! I can help you find interesting places to visit or eat around you. What would you like to know?')}
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
          
          {/* Input Area */}
          <form onSubmit={handleSubmit} className="chat-input-form">
            <input
              type="text"
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('mapChat.inputPlaceholder', 'Ask about places to visit or eat...')}
              disabled={isLoading}
            />
            <button 
              type="submit" 
              className="send-button"
              disabled={isLoading || !input.trim()}
            >
              {isLoading 
                ? t('mapChat.processing', '...') 
                : <span className="send-icon">➤</span>}
            </button>
          </form>
        </div>
      )}
    </>
  );
} 