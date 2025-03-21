import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import './App.css'
import { Reward, RewardValue, generateMapRewards, rewardsToHeatmapFormat, findRewardsNearLocation } from './utils/rewardGenerator'
import { MapMenu } from './components/MapMenu'
import { Navbar } from './components/Navbar'
import { Login } from './components/Login'
import { useAuth } from './providers/AuthContext'

// Create theme context
export type ThemeMode = 'dark' | 'light';

function App() {
  const { t, i18n } = useTranslation()
  const { isAuthenticated, isLoading } = useAuth()
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [showLocationModal, setShowLocationModal] = useState(true)
  const [clickedPosition, setClickedPosition] = useState<[number, number] | null>(null)
  const [rewards, setRewards] = useState<Reward[]>([])
  const rewardMarkersRef = useRef<{ [id: string]: mapboxgl.Marker }>({})
  
  // Theme state, default to dark
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark')
  
  // New state for nearby rewards and hover effects
  const hoverMarkerRef = useRef<HTMLDivElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const indicatorsRef = useRef<HTMLDivElement[]>([])
  const hoveredPositionRef = useRef<[number, number] | null>(null)
  const [showHoverEffects, setShowHoverEffects] = useState(false)
  
  // Effect to initialize the map after successful login
  useEffect(() => {
    if (isAuthenticated && showLocationModal) {
      // Don't initialize map yet, wait for location selection
      console.log("Authenticated, showing location modal");
    }
  }, [isAuthenticated, showLocationModal]);
  
  // When theme changes, set body class name
  useEffect(() => {
    document.body.className = themeMode === 'dark' ? 'dark-theme' : 'light-theme';
    
    // Load theme-related map style
    if (map.current) {
      const style = themeMode === 'dark' 
        ? 'mapbox://styles/mapbox/dark-v11' 
        : 'mapbox://styles/mapbox/streets-v12';
      map.current.setStyle(style);
    }
  }, [themeMode]);
  
  // Check theme setting from localStorage on app initialization
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as ThemeMode;
    if (savedTheme) {
      setThemeMode(savedTheme);
    }
  }, []);

  // Function to toggle theme mode
  const toggleTheme = () => {
    const newTheme = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(newTheme);
    localStorage.setItem('theme', newTheme);
  };
  
  // Debug i18n
  useEffect(() => {
    console.log('Current language:', i18n.language);
    console.log('Available languages:', i18n.languages);
    console.log('Translation test:', t('locationModal.title'));
  }, [i18n, t]);
  
  // Japan coordinates (Tokyo)
  const defaultCenter: [number, number] = [139.6503, 35.6762]

  const initializeMap = (center: [number, number]) => {
    if (!mapContainer.current) return

    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: themeMode === 'dark' 
        ? 'mapbox://styles/mapbox/dark-v11' 
        : 'mapbox://styles/mapbox/streets-v12',
      center: center,
      zoom: 9
    })

    // Add map click event handler
    map.current.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      setClickedPosition([lng, lat]);
      
      // Check for nearby rewards at the clicked position
      if (rewards.length > 0) {
        const nearby = findRewardsNearLocation([lng, lat], rewards, 0.2);
        showNearbyRewardIndicators(nearby);
      }
    });

    // Add heatmap layer when map loads
    map.current.on('load', () => {
      initializeHeatmap();
      generateInitialRewards();
    });
  }

  // Initialize heatmap layer
  const initializeHeatmap = () => {
    if (!map.current) return;
    
    // Add an empty GeoJSON source for the heatmap
    map.current.addSource('rewards-heat', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });
    
    // Add heatmap layer
    map.current.addLayer({
      id: 'rewards-heat',
      type: 'heatmap',
      source: 'rewards-heat',
      paint: {
        // Increase weight based on reward value (1-3)
        'heatmap-weight': [
          'interpolate',
          ['linear'],
          ['get', 'value'],
          1, 0.3, // Low value
          2, 0.6, // Medium value
          3, 1.0  // High value
        ],
        // Increase intensity as zoom level increases
        'heatmap-intensity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8, 0.5,
          15, 1.5
        ],
        // Color gradient from green to red
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0, 'rgba(0, 255, 0, 0)', 
          0.2, 'rgba(0, 255, 0, 0.4)',
          0.4, 'rgba(255, 255, 0, 0.5)',
          0.6, 'rgba(255, 165, 0, 0.6)',
          0.8, 'rgba(255, 0, 0, 0.7)',
          1, 'rgba(255, 0, 0, 0.8)'
        ],
        // Adjust radius based on zoom level
        'heatmap-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8, 10,
          12, 20,
          15, 30
        ],
        // Decrease opacity as zoom increases for better visualization
        'heatmap-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8, 0.7,
          15, 0.3
        ]
      }
    });
  };

  // Generate initial rewards based on map bounds
  const generateInitialRewards = async () => {
    if (!map.current) return;
    
    const bounds = map.current.getBounds();
    if (!bounds) return;
    
    const boundsObj = {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest()
    };
    
    try {
      // Use local generation instead of API
      const newRewards = generateMapRewards(boundsObj, 50);
      setRewards(newRewards);
    } catch (error) {
      console.error('Failed to generate map rewards:', error);
    }
  };

  // Update heatmap and reward markers when rewards change
  useEffect(() => {
    if (!map.current || rewards.length === 0) return;

    // Update heatmap data
    const heatmapData = rewardsToHeatmapFormat(rewards);
    (map.current.getSource('rewards-heat') as mapboxgl.GeoJSONSource)?.setData(heatmapData);
    
    // Clear existing reward markers
    Object.values(rewardMarkersRef.current).forEach(marker => marker.remove());
    rewardMarkersRef.current = {};
    
    // Add reward markers (emoji)
    rewards.forEach(reward => {
      // Only show high and medium value rewards as markers to avoid cluttering
      if (reward.isVisible && (reward.value === RewardValue.High || reward.value === RewardValue.Medium)) {
        const marker = new mapboxgl.Marker({
          element: createRewardMarkerElement(reward.emoji)
        })
          .setLngLat(reward.coordinates)
          .addTo(map.current!);
        
        rewardMarkersRef.current[reward.id] = marker;
      }
    });
    
    return () => {
      // Clean up markers when component unmounts
      Object.values(rewardMarkersRef.current).forEach(marker => marker.remove());
    };
  }, [rewards]);

  // Create custom marker element for rewards
  const createRewardMarkerElement = (emoji: string) => {
    const el = document.createElement('div');
    el.className = 'reward-marker';
    el.textContent = emoji;
    el.style.fontSize = '24px';
    el.style.cursor = 'pointer';
    return el;
  };

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation: [number, number] = [position.coords.longitude, position.coords.latitude]
          initializeMap(userLocation)
          setShowLocationModal(false)
        },
        (error) => {
          console.error('Error getting location:', error)
          initializeMap(defaultCenter)
          setShowLocationModal(false)
        }
      )
    } else {
      console.error('Geolocation is not supported by this browser')
      initializeMap(defaultCenter)
      setShowLocationModal(false)
    }
  }

  const handleUseDefaultLocation = () => {
    initializeMap(defaultCenter)
    setShowLocationModal(false)
  }

  const handleClearClickedPosition = () => {
    setClickedPosition(null);
    cleanupIndicators();
  };

  // Create reward indicators around clicked position
  const showNearbyRewardIndicators = (nearby: Reward[]) => {
    cleanupIndicators();
    
    if (!mapContainer.current || nearby.length === 0) return;
    
    // Create container for indicators if it doesn't exist
    const container = mapContainer.current;
    
    // Create and add indicator elements
    nearby.forEach(reward => {
      if (!map.current) return;
      
      // Convert reward coordinates to pixel coordinates
      const pixelPos = map.current.project(reward.coordinates);
      
      // Create indicator element
      const indicator = document.createElement('div');
      indicator.className = `reward-indicator ${reward.value === RewardValue.High ? 'high' : reward.value === RewardValue.Medium ? 'medium' : 'low'}`;
      indicator.innerHTML = `<div class="reward-emoji">${reward.emoji}</div>`;
      indicator.style.left = `${pixelPos.x}px`;
      indicator.style.top = `${pixelPos.y}px`;
      
      // Add tooltip with reward details
      const tooltip = document.createElement('div');
      tooltip.className = 'reward-tooltip';
      tooltip.innerHTML = `
        <div class="tooltip-header">
          <span class="tooltip-emoji">${reward.emoji}</span>
          <span class="tooltip-name">Reward #${reward.id.substring(0, 6)}</span>
        </div>
        <div class="tooltip-value">
          Value: ${reward.value === RewardValue.High ? 'High' : reward.value === RewardValue.Medium ? 'Medium' : 'Low'}
        </div>
        <div class="tooltip-coords">
          Lat: ${reward.coordinates[1].toFixed(4)}, Lng: ${reward.coordinates[0].toFixed(4)}
        </div>
      `;
      indicator.appendChild(tooltip);
      
      // Add click handler to claim reward
      indicator.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('Claiming reward:', reward);
        // TODO: Implement claiming logic
        
        // Remove the claimed indicator
        indicator.classList.add('claimed');
        setTimeout(() => {
          indicator.remove();
        }, 1000);
      });
      
      // Add to container and track for cleanup
      container.appendChild(indicator);
      indicatorsRef.current.push(indicator);
    });
  };

  // Clean up indicators when clearing or creating new ones
  const cleanupIndicators = () => {
    indicatorsRef.current.forEach(indicator => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    });
    indicatorsRef.current = [];
  };

  // Handle cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupIndicators();
      if (hoverMarkerRef.current && hoverMarkerRef.current.parentNode) {
        hoverMarkerRef.current.parentNode.removeChild(hoverMarkerRef.current);
      }
      if (tooltipRef.current && tooltipRef.current.parentNode) {
        tooltipRef.current.parentNode.removeChild(tooltipRef.current);
      }
    };
  }, []);

  // Handle hover effects visibility state change
  useEffect(() => {
    if (showHoverEffects) {
      if (!map.current || !mapContainer.current) return;
      
      // Create hover marker element
      const marker = document.createElement('div');
      marker.className = 'hover-marker';
      mapContainer.current.appendChild(marker);
      hoverMarkerRef.current = marker;
      
      // Create tooltip element
      const tooltip = document.createElement('div');
      tooltip.className = 'rewards-tooltip';
      tooltip.style.display = 'none';
      mapContainer.current.appendChild(tooltip);
      tooltipRef.current = tooltip;
      
      // Setup mousemove handler on map
      const handleMouseMove = (e: mapboxgl.MapMouseEvent) => {
        if (!map.current) return;
        
        const { lng, lat } = e.lngLat;
        hoveredPositionRef.current = [lng, lat];
        
        // Update marker position
        updateHoverMarker([lng, lat]);
        
        // Check for nearby rewards
        const nearbyRewards = findRewardsNearLocation([lng, lat], rewards, 0.1);
        
        if (nearbyRewards.length > 0) {
          // Show tooltip with rewards info
          updateRewardsTooltip([lng, lat], nearbyRewards);
        } else {
          // Hide tooltip if no rewards nearby
          if (tooltipRef.current) {
            tooltipRef.current.style.display = 'none';
          }
        }
      };
      
      map.current.on('mousemove', handleMouseMove);
      
      return () => {
        map.current?.off('mousemove', handleMouseMove);
        cleanupIndicators();
        
        if (hoverMarkerRef.current && hoverMarkerRef.current.parentNode) {
          hoverMarkerRef.current.parentNode.removeChild(hoverMarkerRef.current);
          hoverMarkerRef.current = null;
        }
        
        if (tooltipRef.current && tooltipRef.current.parentNode) {
          tooltipRef.current.parentNode.removeChild(tooltipRef.current);
          tooltipRef.current = null;
        }
      };
    } else {
      // Cleanup hover effect elements when disabled
      if (hoverMarkerRef.current && hoverMarkerRef.current.parentNode) {
        hoverMarkerRef.current.parentNode.removeChild(hoverMarkerRef.current);
        hoverMarkerRef.current = null;
      }
      
      if (tooltipRef.current && tooltipRef.current.parentNode) {
        tooltipRef.current.parentNode.removeChild(tooltipRef.current);
        tooltipRef.current = null;
      }
    }
  }, [showHoverEffects, rewards]);

  // Update hover marker position
  const updateHoverMarker = (position: [number, number]) => {
    if (!map.current || !hoverMarkerRef.current) return;
    
    const pixelPos = map.current.project(position);
    hoverMarkerRef.current.style.left = `${pixelPos.x}px`;
    hoverMarkerRef.current.style.top = `${pixelPos.y}px`;
  };

  // Update tooltip showing nearby rewards
  const updateRewardsTooltip = (position: [number, number], nearby: Reward[]) => {
    if (!map.current || !tooltipRef.current) return;
    
    const pixelPos = map.current.project(position);
    
    // Position tooltip to the right of the cursor
    tooltipRef.current.style.left = `${pixelPos.x + 15}px`;
    tooltipRef.current.style.top = `${pixelPos.y - 15}px`;
    tooltipRef.current.style.display = 'block';
    
    // Generate HTML content for the tooltip
    let content = '<div class="tooltip-title">Nearby Rewards</div>';
    content += '<div class="tooltip-rewards">';
    
    nearby.forEach(reward => {
      const valueClass = reward.value === RewardValue.High ? 'high' : 
                         reward.value === RewardValue.Medium ? 'medium' : 'low';
      
      content += `
        <div class="tooltip-reward ${valueClass}">
          <span class="reward-emoji">${reward.emoji}</span>
          <span class="reward-name">Reward #${reward.id.substring(0, 6)}</span>
        </div>
      `;
    });
    
    content += '</div>';
    
    tooltipRef.current.innerHTML = content;
  };

  // Only render the map interface when authenticated
  // Otherwise show the login screen
  return (
    <div className="app">
      <Navbar
        toggleTheme={toggleTheme}
        currentTheme={themeMode}
        showHoverEffects={showHoverEffects}
        setShowHoverEffects={setShowHoverEffects}
      />

      {isLoading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>{t('login.loading', 'Loading authentication...')}</p>
        </div>
      ) : isAuthenticated ? (
        <>
          <div ref={mapContainer} className="map-container" />
          
          {showLocationModal && (
            <div className="location-modal">
              <div className="modal-content">
                <h2>{t('locationModal.title')}</h2>
                <p>{t('locationModal.message', t('locationModal.prompt'))}</p>
                <div className="modal-buttons">
                  <button onClick={handleUseCurrentLocation}>
                    {t('locationModal.useCurrentLocation')}
                  </button>
                  <button onClick={handleUseDefaultLocation}>
                    {t('locationModal.useDefaultLocation')}
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {clickedPosition && !showLocationModal && (
            <MapMenu
              map={map.current}
              clickedPosition={clickedPosition}
              onClearClickedPosition={handleClearClickedPosition}
              rewards={rewards}
              setRewards={setRewards}
              theme={themeMode}
            />
          )}
        </>
      ) : (
        <Login 
          onLoginSuccess={() => {
            console.log("Login successful")
            // Keep showing the location modal after login
            setShowLocationModal(true)
          }} 
        />
      )}
    </div>
  )
}

export default App

