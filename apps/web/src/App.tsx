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
import { ExplorationIndicator } from './components/ExplorationIndicator'
import { BadgesModal } from './components/BadgesModal'
import { validateRewardCollection, updateExplorationStats, generateRewardsAroundUser, ExplorationStats } from './utils/RewardSystem'
import { PrivacyHeatmapLayer } from './components/PrivacyHeatmapLayer'
import { LocationAnalyticsModal } from './components/LocationAnalyticsModal'
import { MapChatAssistant } from './components/MapChatAssistant'

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
  
  // New state for exploration stats and badges
  const [explorationStats, setExplorationStats] = useState<ExplorationStats>({
    visitedRewardsCount: 0,
    totalPossibleRewards: 0,
    explorationIndex: 0,
    collectedRewards: []
  })
  const [showBadgesModal, setShowBadgesModal] = useState(false)
  const [hasNewBadges, setHasNewBadges] = useState(false)
  
  // New state for privacy features
  const [showPrivacyHeatmap, setShowPrivacyHeatmap] = useState(false)
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false)
  const [analyticsLocation, setAnalyticsLocation] = useState<{
    name: string;
    coordinates: [number, number];
  } | null>(null)
  
  // MapMenu state
  const [showMapMenu, setShowMapMenu] = useState(false)
  
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
  
  // Function to toggle MapMenu
  const handleToggleMapMenu = () => {
    // 如果已經有選中的位置，關閉菜單並清除選中位置
    if (clickedPosition && showMapMenu) {
      setShowMapMenu(false);
      setClickedPosition(null);
      cleanupIndicators();
    } else {
      // 否則切換菜單狀態
      setShowMapMenu(!showMapMenu);
    }
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
      
      // 如果菜單已經打開且有選中位置，則關閉菜單並清除選中位置
      if (showMapMenu && clickedPosition) {
        setShowMapMenu(false);
        setClickedPosition(null);
        cleanupIndicators();
      } else {
        // 否則設置新的選中位置並打開菜單
        setClickedPosition([lng, lat]);
        setShowMapMenu(true);
        
        // Check for nearby rewards at the clicked position
        if (rewards.length > 0) {
          const nearby = findRewardsNearLocation([lng, lat], rewards, 0.2);
          showNearbyRewardIndicators(nearby);
          
          // If rewards are nearby, trigger reward validation
          if (nearby.length > 0) {
            validateAndCollectReward([lng, lat]);
          }
        }
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
      
      // Initialize exploration stats
      setExplorationStats(prev => ({
        ...prev,
        totalPossibleRewards: newRewards.length
      }));
    } catch (error) {
      console.error('Failed to generate map rewards:', error);
    }
  };

  // Validate and collect rewards when user clicks near one
  const validateAndCollectReward = async (position: [number, number]) => {
    try {
      const result = await validateRewardCollection(position, rewards);
      
      if (result.isValid && result.nearbyRewards.length > 0) {
        // Mark rewards as collected
        const collectedRewardIds = result.nearbyRewards.map(r => r.id);
        
        // Update rewards array to mark collected rewards as invisible
        setRewards(prev => 
          prev.map(reward => 
            collectedRewardIds.includes(reward.id) 
              ? { ...reward, isVisible: false } 
              : reward
          )
        );
        
        // Update exploration stats
        const updatedCollectedRewards = [
          ...explorationStats.collectedRewards,
          ...collectedRewardIds
        ];
        
        const newStats = updateExplorationStats(
          updatedCollectedRewards,
          explorationStats.totalPossibleRewards
        );
        
        setExplorationStats(newStats);
        
        // Check if user earned a new badge
        const oldIndex = explorationStats.explorationIndex;
        const newIndex = newStats.explorationIndex;
        
        // Check specific thresholds for badges (25%, 50%, 75%)
        if (
          (oldIndex < 25 && newIndex >= 25) || 
          (oldIndex < 50 && newIndex >= 50) || 
          (oldIndex < 75 && newIndex >= 75)
        ) {
          setHasNewBadges(true);
        }
        
        // Generate new rewards around the user's position
        if (result.nearbyRewards.length > 0) {
          const newRewards = generateRewardsAroundUser(position, 3);
          setRewards(prev => [...prev, ...newRewards]);
          
          // Update total possible rewards
          setExplorationStats(prev => ({
            ...prev,
            totalPossibleRewards: prev.totalPossibleRewards + newRewards.length
          }));
        }
      }
    } catch (error) {
      console.error('Failed to validate reward:', error);
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

  // Display badges modal
  const handleShowBadgesModal = () => {
    setShowBadgesModal(true);
    setHasNewBadges(false); // Reset new badges flag when viewed
  };
  
  // Close badges modal
  const handleCloseBadgesModal = () => {
    setShowBadgesModal(false);
  };

  // Handle show location analytics
  const handleShowLocationAnalytics = (location: {
    name: string;
    coordinates: [number, number];
  }) => {
    setAnalyticsLocation(location);
    setShowAnalyticsModal(true);
  };

  // Handle close location analytics
  const handleCloseAnalyticsModal = () => {
    setAnalyticsLocation(null);
    setShowAnalyticsModal(false);
  };

  // Privacy heatmap toggle handler
  const handleTogglePrivacyHeatmap = (isVisible: boolean) => {
    console.log('[DEBUG] App - handleTogglePrivacyHeatmap called with isVisible:', isVisible);
    setShowPrivacyHeatmap(isVisible);
  };

  // Debug logging for map and heatmap state
  useEffect(() => {
    console.log('[DEBUG] App state - map:', !!map?.current, 'showPrivacyHeatmap:', showPrivacyHeatmap);
  }, [map, showPrivacyHeatmap]);

  // Only render the map interface when authenticated
  // Otherwise show the login screen
  return (
    <div className="app">
      <Navbar
        toggleTheme={toggleTheme}
        currentTheme={themeMode}
        showHoverEffects={showHoverEffects}
        setShowHoverEffects={setShowHoverEffects}
        onTitleClick={handleToggleMapMenu}
        handleShowBadgesModal={handleShowBadgesModal}
      />

      {/* Map Menu as left sidebar */}
      <div className={`map-menu-sidebar ${showMapMenu ? 'open' : ''}`}>
        {isAuthenticated && (
          <MapMenu
            map={map.current}
            clickedPosition={clickedPosition}
            onClearClickedPosition={handleClearClickedPosition}
            rewards={rewards}
            setRewards={setRewards}
            theme={themeMode}
            onShowAnalytics={handleShowLocationAnalytics}
            onTogglePrivacyHeatmap={handleTogglePrivacyHeatmap}
          />
        )}
      </div>

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
          
          {/* Privacy Heatmap Layer */}
          <PrivacyHeatmapLayer 
            map={map?.current} 
            isVisible={showPrivacyHeatmap} 
          />
          
          {/* Location Analytics Modal */}
          {showAnalyticsModal && analyticsLocation && (
            <LocationAnalyticsModal
              locationName={analyticsLocation.name}
              coordinates={analyticsLocation.coordinates}
              onClose={handleCloseAnalyticsModal}
            />
          )}
          
          {/* Exploration indicator */}
          <ExplorationIndicator 
            stats={explorationStats}
            onShowDetails={handleShowBadgesModal}
            hasBadges={hasNewBadges}
          />
          
          {/* Badges modal */}
          {showBadgesModal && (
            <BadgesModal 
              stats={explorationStats}
              onClose={handleCloseBadgesModal}
            />
          )}
          
          {/* Map Chat Assistant */}
          <MapChatAssistant 
            map={map?.current}
            userLocation={clickedPosition || undefined}
          />
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

