'use client'

import React, { useEffect, useState, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface MapCommand {
  moveCamera: boolean
  targetLocation: { longitude: number; latitude: number } | null
  addMarkers: Array<{
    id: string
    longitude: number
    latitude: number
    type: string
    name: string
  }>
  removeMarkers: string[]
  toggleLayers: Array<{
    id: string
    visible: boolean
  }>
  zoomLevel: number | null
  rawResponse: string
}

export default function MapboxLLMComponent() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markers = useRef<{[key: string]: mapboxgl.Marker}>({})
  
  const [mapLoaded, setMapLoaded] = useState(false)
  const [userLocation, setUserLocation] = useState<{
    longitude: number
    latitude: number
  } | null>(null)
  const [userQuery, setUserQuery] = useState('')
  const [processing, setProcessing] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'system',
      content: '歡迎使用智能地圖助手！你可以詢問我關於地圖的任何問題，例如尋找特定地點、推薦附近景點等。'
    }
  ])

  // Initialize map when component mounts
  useEffect(() => {
    if (map.current) return // initialize map only once
    
    if (!mapContainer.current) return // wait for container
    
    // Replace with your Mapbox token
    mapboxgl.accessToken = 'YOUR_MAPBOX_TOKEN'
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [121.5654, 25.0330], // Default to Taipei
      zoom: 12
    })
    
    map.current.on('load', () => {
      setMapLoaded(true)
      
      // Get user's location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
          const { longitude, latitude } = position.coords
          setUserLocation({ longitude, latitude })
          
          // Add user marker
          if (map.current) {
            map.current.flyTo({
              center: [longitude, latitude],
              zoom: 14,
              essential: true
            })
            
            // Add user location marker
            const userMarker = new mapboxgl.Marker({ color: '#0078FF' })
              .setLngLat([longitude, latitude])
              .addTo(map.current)
            
            markers.current['user'] = userMarker
          }
        })
      }
    })

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  // Process user query
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!userQuery.trim() || processing) return
    
    const query = userQuery.trim()
    setUserQuery('')
    setProcessing(true)
    
    // Add user message to chat
    const newUserMessage: Message = { role: 'user', content: query }
    setMessages(prev => [...prev, newUserMessage])

    try {
      // Get current map data
      const mapData = {
        markers: Object.entries(markers.current).map(([id, marker]) => {
          const lngLat = marker.getLngLat()
          return {
            id,
            longitude: lngLat.lng,
            latitude: lngLat.lat,
            type: id === 'user' ? 'user' : 'poi'
          }
        }),
        // You could add more map data here, like visible layers, bounds, etc.
      }

      // Call the serverless API
      const response = await fetch('/api/serverless/user/mapbox-interaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          mapData,
          userLocation
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get a response')
      }

      const data = await response.json()
      const { response: assistantResponse, commands } = data
      
      // Add assistant response to chat
      const newAssistantMessage: Message = { 
        role: 'assistant', 
        content: assistantResponse 
      }
      setMessages(prev => [...prev, newAssistantMessage])
      
      // Execute map commands
      handleMapCommands(commands)
    } catch (error) {
      console.error('Error processing query:', error)
      
      // Add error message to chat
      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: '抱歉，處理您的請求時出現錯誤。請稍後再試。' 
        }
      ])
    } finally {
      setProcessing(false)
    }
  }

  // Handle commands returned from the API
  const handleMapCommands = (commands: MapCommand) => {
    if (!map.current || !mapLoaded) return
    
    // Move the camera if requested
    if (commands.moveCamera && commands.targetLocation) {
      const { longitude, latitude } = commands.targetLocation
      map.current.flyTo({
        center: [longitude, latitude],
        zoom: commands.zoomLevel || map.current.getZoom(),
        essential: true
      })
    } else if (commands.zoomLevel) {
      // Just update zoom if that's the only thing requested
      map.current.zoomTo(commands.zoomLevel)
    }
    
    // Add markers
    commands.addMarkers.forEach(marker => {
      const { id, longitude, latitude, type, name } = marker
      
      // Create a new marker
      const newMarker = new mapboxgl.Marker({ 
        color: type === 'poi' ? '#FF4D00' : 
               type === 'recommendation' ? '#00C853' : '#888888'
      })
        .setLngLat([longitude, latitude])
        .setPopup(new mapboxgl.Popup().setHTML(`<h3>${name}</h3>`))
        .addTo(map.current!)
      
      // Store marker reference
      markers.current[id] = newMarker
    })
    
    // Remove markers
    commands.removeMarkers.forEach(id => {
      if (markers.current[id] && id !== 'user') {
        markers.current[id].remove()
        delete markers.current[id]
      }
    })
    
    // Toggle layers
    commands.toggleLayers.forEach(layer => {
      const { id, visible } = layer
      if (map.current?.getLayer(id)) {
        map.current.setLayoutProperty(
          id,
          'visibility',
          visible ? 'visible' : 'none'
        )
      }
    })
  }

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Map Container */}
      <div 
        ref={mapContainer} 
        className="flex-1 w-full"
      />
      
      {/* Chat Interface */}
      <div className="bg-gray-100 p-4 shadow-inner max-h-96 overflow-y-auto">
        <div className="space-y-4 mb-4">
          {messages.map((msg, i) => (
            <div 
              key={i} 
              className={`p-3 rounded-lg max-w-3/4 ${
                msg.role === 'assistant' 
                  ? 'bg-blue-100 ml-auto' 
                  : msg.role === 'user'
                  ? 'bg-gray-300'
                  : 'bg-gray-200 text-sm italic'
              }`}
            >
              {msg.content}
            </div>
          ))}
          {processing && (
            <div className="bg-blue-100 p-3 rounded-lg animate-pulse">
              正在處理...
            </div>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="詢問關於地圖或位置的問題..."
            className="flex-1 px-4 py-2 rounded-full border focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={processing}
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded-full hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-700 disabled:opacity-50"
            disabled={!userQuery.trim() || processing}
          >
            發送
          </button>
        </form>
      </div>
    </div>
  )
} 