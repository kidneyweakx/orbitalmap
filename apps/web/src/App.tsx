import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import './App.css'
import { Reward } from './utils/rewardGenerator'
import { rewardsToHeatmapFormat } from './utils/mapUtils'
import { fetchMapRewards } from './utils/api'
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
      const newRewards = await fetchMapRewards(boundsObj, 10);
      setRewards(newRewards);
    } catch (error) {
      console.error('Failed to fetch map rewards:', error);
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
      if (reward.isVisible && (reward.value === 'high' || reward.value === 'medium')) {
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

  return (
    <div className="app-container">
      <Navbar 
        toggleTheme={toggleTheme}
        currentTheme={themeMode}
      />
      <div ref={mapContainer} className="map-container" />
      {!showLocationModal && (
        <MapMenu 
          map={map.current} 
          clickedPosition={clickedPosition}
          onClearClickedPosition={handleClearClickedPosition}
          rewards={rewards}
          setRewards={setRewards}
          theme={themeMode}
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
