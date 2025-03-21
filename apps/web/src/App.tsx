import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import './App.css'
import { Reward, RewardValue, generateMapRewards, rewardsToHeatmapFormat, findRewardsNearLocation } from './utils/rewardGenerator'
import { MapMenu } from './components/MapMenu'
import { Navbar } from './components/Navbar'

// Create theme context
export type ThemeMode = 'dark' | 'light';

function App() {
  const { t, i18n } = useTranslation()
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
        showNearbyRewardIndicators( nearby);
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
      console.error('Geolocation is not supported by this browser.')
      initializeMap(defaultCenter)
      setShowLocationModal(false)
    }
  }

  const handleUseDefaultLocation = () => {
    initializeMap(defaultCenter)
    setShowLocationModal(false)
  }

  // Reset clicked position
  const handleClearClickedPosition = () => {
    setClickedPosition(null);
  }

  useEffect(() => {
    // Map will be initialized after user chooses location option
    return () => {
      map.current?.remove()
    }
  }, [])

  // Show indicators for nearby rewards
  const showNearbyRewardIndicators = ( nearby: Reward[]) => {
    
    // Clean up previous indicators
    cleanupIndicators();
    
    if (!map.current) return;
    
    // Create indicators for each nearby reward
    nearby.forEach(reward => {
      // Create indicator element
      const indicator = document.createElement('div');
      
      // Set class based on reward value
      let valueClass = 'medium';
      if (reward.value === RewardValue.High) valueClass = 'high';
      if (reward.value === RewardValue.Low) valueClass = 'low';
      
      indicator.className = `reward-indicator ${valueClass}`;
      document.body.appendChild(indicator);
      
      // Convert reward coordinates to pixel position
      const point = map.current!.project(reward.coordinates);
      
      // Position the indicator
      indicator.style.left = `${point.x}px`;
      indicator.style.top = `${point.y}px`;
      
      // Store reference to the element
      indicatorsRef.current.push(indicator);
    });
  };
  
  // Clean up reward indicators
  const cleanupIndicators = () => {
    // Remove all indicator elements
    indicatorsRef.current.forEach(indicator => {
      if (indicator.parentNode) {
        document.body.removeChild(indicator);
      }
    });
    
    // Clear the array
    indicatorsRef.current = [];
  };

  // Add hover effect detection
  useEffect(() => {
    if (map.current) {
      map.current.on('mousemove', (e) => {
        if (!showHoverEffects) return;
        
        const { lng, lat } = e.lngLat;
        hoveredPositionRef.current = [lng, lat];
        
        // Show the hover marker at the mouse position
        updateHoverMarker([lng, lat]);
        
        // Check for rewards around the hovered position
        if (rewards.length > 0) {
          const nearby = findRewardsNearLocation([lng, lat], rewards, 0.2);
          updateRewardsTooltip([lng, lat], nearby);
        }
      });
    }
  }, [showHoverEffects, rewards]);
  
  // Create and initialize hover UI elements
  useEffect(() => {
    // Create the hover marker element if it doesn't exist
    if (!hoverMarkerRef.current) {
      const hoverMarker = document.createElement('div');
      hoverMarker.className = 'hover-marker';
      hoverMarker.style.opacity = '0';
      document.body.appendChild(hoverMarker);
      hoverMarkerRef.current = hoverMarker;
    }
    
    // Create the tooltip element if it doesn't exist
    if (!tooltipRef.current) {
      const tooltip = document.createElement('div');
      tooltip.className = 'nearby-rewards-tooltip';
      tooltip.style.opacity = '0';
      document.body.appendChild(tooltip);
      tooltipRef.current = tooltip;
    }
    
    // Update visibility based on showHoverEffects
    if (hoverMarkerRef.current) {
      hoverMarkerRef.current.style.opacity = showHoverEffects ? '1' : '0';
    }
    
    // Clean up on unmount
    return () => {
      if (hoverMarkerRef.current) {
        document.body.removeChild(hoverMarkerRef.current);
        hoverMarkerRef.current = null;
      }
      
      if (tooltipRef.current) {
        document.body.removeChild(tooltipRef.current);
        tooltipRef.current = null;
      }
      
      cleanupIndicators();
    };
  }, [showHoverEffects]);
  
  // Update hover marker position
  const updateHoverMarker = (position: [number, number]) => {
    if (!map.current || !hoverMarkerRef.current) return;
    
    // Convert the geographical position to pixel coordinates
    const point = map.current.project(position);
    
    // Update the hover marker position
    hoverMarkerRef.current.style.left = `${point.x}px`;
    hoverMarkerRef.current.style.top = `${point.y}px`;
  };
  
  // Update tooltip with nearby rewards count
  const updateRewardsTooltip = (position: [number, number], nearby: Reward[]) => {
    if (!map.current || !tooltipRef.current) return;
    
    // Convert the geographical position to pixel coordinates
    const point = map.current.project(position);
    
    // Position the tooltip above the hover point
    tooltipRef.current.style.left = `${point.x}px`;
    tooltipRef.current.style.top = `${point.y - 40}px`;
    
    // Update the tooltip content
    if (nearby.length > 0) {
      tooltipRef.current.textContent = t('mapMenu.nearbyRewardsFound', { count: nearby.length });
      tooltipRef.current.style.opacity = '1';
    } else {
      tooltipRef.current.style.opacity = '0';
    }
  };

  return (
    <div className={`app-container ${themeMode === 'dark' ? 'dark-theme' : ''}`}>
      <Navbar 
        toggleTheme={toggleTheme}
        currentTheme={themeMode}
        showHoverEffects={showHoverEffects}
        setShowHoverEffects={setShowHoverEffects}
      />
      <div ref={mapContainer} className="map-container" />
      {!showLocationModal && (
        <MapMenu 
          map={map.current} 
          clickedPosition={clickedPosition}
          onClearClickedPosition={handleClearClickedPosition}
          rewards={rewards}
          setRewards={setRewards}
          theme={themeMode as ThemeMode}
        />
      )}
      
      {showLocationModal && (
        <div className="location-modal-overlay">
          <div className={`location-modal ${themeMode === 'dark' ? 'dark-theme' : ''}`}>
            <h2>{t('locationModal.title')}</h2>
            <p>{t('locationModal.prompt')}</p>
            <div className="location-buttons">
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
    </div>
  )
}

export default App
