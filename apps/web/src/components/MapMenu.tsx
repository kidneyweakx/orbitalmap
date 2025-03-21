import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import mapboxgl from 'mapbox-gl';
import { Reward, generateRewardsAroundLocation } from '../utils/rewardGenerator';
import { ThemeMode } from '../App';
import { ZKLocationProofCard } from './ZKLocationProofCard';
import { encryptLocationData } from '../utils/privacyUtils'; // Import encryption utility

interface Spot {
  id: string;
  name: string;
  coordinates: [number, number];
  description?: string;
  emoji: string; // 改成emoji而不是imageUrl
  tags: string[]; // Add tags field
  hasVisitProof?: boolean; // New field to track if user has proven visit
  encryptedId?: string; // Add encrypted ID field
  isEncrypted: boolean; // Track encryption status
}

// Available tag options
export const SPOT_TAGS = ['food', 'photo', 'nature', 'shopping', 'culture', 'other'];

// 可用的emoji选项
export const SPOT_EMOJIS = [
  '🏞️', '🗻', '🌋', '🏝️', '🏖️', '🏜️', '🌄', '🌅', '🌇', '🌉', '🌆', '🌃',
  '🏙️', '🌁', '🗼', '🏰', '🏯', '🏛️', '⛩️', '🕌', '🕍', '⛪', '🏢', '🏣',
  '🏤', '🏥', '🏦', '🏨', '🏩', '🏪', '🏫', '🍽️', '🍵', '☕', '🧋', '🥤',
  '🍵', '🍹', '🍷', '🍸', '🍺', '🏊', '🎭', '🎪', '🎨', '🎬', '🎯', '🎣',
  '🎮', '⚽', '🏀', '🏈', '⚾', '🥎', '🏐', '🏓', '🎾', '🥾', '🚲', '🏍️',
  '🚗', '🚉', '✈️', '🚢', '⛵', '🛥️', '🚁', '🚠', '🎡', '🎢', '🎠', '🏔️'
];

interface MapMenuProps {
  map: mapboxgl.Map | null;
  clickedPosition: [number, number] | null;
  onClearClickedPosition: () => void;
  rewards: Reward[];
  setRewards: React.Dispatch<React.SetStateAction<Reward[]>>;
  theme: ThemeMode;
  onShowAnalytics?: (location: { name: string, coordinates: [number, number] }) => void;
  onTogglePrivacyHeatmap?: (isVisible: boolean) => void;
}

export function MapMenu({ map, clickedPosition, onClearClickedPosition, rewards, setRewards, theme, onShowAnalytics, onTogglePrivacyHeatmap }: MapMenuProps) {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [isAddingSpot, setIsAddingSpot] = useState(false);
  const [newSpotName, setNewSpotName] = useState('');
  const [newSpotDescription, setNewSpotDescription] = useState('');
  const [newSpotEmoji, setNewSpotEmoji] = useState('🏞️'); // 默认emoji
  const [newSpotTags, setNewSpotTags] = useState<string[]>(['other']); // Default tag
  const [addSpotPosition, setAddSpotPosition] = useState<[number, number] | null>(null);
  const [isMenuCollapsed, setIsMenuCollapsed] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const markersRef = useRef<{ [id: string]: mapboxgl.Marker }>({});
  const tempMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [showRewardInfo, setShowRewardInfo] = useState(false);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [showZKProofCard, setShowZKProofCard] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(true); // Default to privacy mode on
  // Keep state variable for when heatmap functionality is restored
  const [showPrivacyHeatmap, setShowPrivacyHeatmap] = useState(false);
  const [showHeatmapTooltip, setShowHeatmapTooltip] = useState(false);
  const [showPrivacyTooltip, setShowPrivacyTooltip] = useState(false);
  const [encryptedCoordinateId, setEncryptedCoordinateId] = useState<string>("");
  
  // Effect to handle map clicks
  useEffect(() => {
    if (!map || !clickedPosition) return;
    
    // Clear previous temp marker if exists
    if (tempMarkerRef.current) {
      tempMarkerRef.current.remove();
      tempMarkerRef.current = null;
    }
    
    // Create a temporary marker at the clicked position
    tempMarkerRef.current = new mapboxgl.Marker({ color: '#ff0000' })
      .setLngLat(clickedPosition)
      .addTo(map);
    
    // Set position for new spot and open the form
    setAddSpotPosition(clickedPosition);
    setIsAddingSpot(true);
    setIsMenuCollapsed(false); // Expand menu when adding spot
  }, [clickedPosition, map]);

  // Load saved spots from localStorage
  useEffect(() => {
    const savedSpots = localStorage.getItem('mapSpots');
    if (savedSpots) {
      try {
        const parsedSpots = JSON.parse(savedSpots);
        
        // Handle migration of old spots data without encryption fields
        const updatedSpots = parsedSpots.map((spot: {
          id: string;
          name: string;
          coordinates: [number, number];
          description?: string;
          imageUrl?: string;
          emoji?: string;
          tags?: string[];
          hasVisitProof?: boolean;
          encryptedId?: string;
          isEncrypted?: boolean;
        }) => {
          // Add encryption fields if they don't exist
          if (!Object.prototype.hasOwnProperty.call(spot, 'isEncrypted')) {
            return { 
              ...spot, 
              tags: spot.tags || ['other'],
              isEncrypted: false,
              encryptedId: ""
            };
          }
          
          // Add emoji field if it doesn't exist or convert imageUrl to emoji
          if (!Object.prototype.hasOwnProperty.call(spot, 'emoji')) {
            const randomIndex = Math.floor(Math.random() * SPOT_EMOJIS.length);
            return {
              ...spot,
              emoji: SPOT_EMOJIS[randomIndex], // Use random emoji from list
              tags: spot.tags || ['other'],
              isEncrypted: spot.isEncrypted || false,
              encryptedId: spot.encryptedId || ""
            };
          }
          
          return spot;
        });
        
        setSpots(updatedSpots);
      } catch (e) {
        console.error('Error loading saved spots:', e);
      }
    }
  }, []);

  // Save spots to localStorage when they change
  useEffect(() => {
    localStorage.setItem('mapSpots', JSON.stringify(spots));
  }, [spots]);

  useEffect(() => {
    if (!map) return;

    const handleMove = () => {
      const center = map.getCenter();
      setCoordinates([Number(center.lng.toFixed(6)), Number(center.lat.toFixed(6))]);
    };

    map.on('moveend', handleMove);
    handleMove(); // Initial coordinates

    return () => {
      map.off('moveend', handleMove);
    };
  }, [map]);

  // Update markers when spots, map or language changes
  useEffect(() => {
    if (!map) return;

    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    // Filter spots by tag if activeTag is set
    const filteredSpots = activeTag 
      ? spots.filter(spot => spot.tags.includes(activeTag))
      : spots;

    // Add new markers
    filteredSpots.forEach(spot => {
      // Create popup content based on privacy mode
      const popupContent = `
        <h3>${spot.name}</h3>
        <p>${spot.description || t('mapMenu.noDescription')}</p>
        <div class="spot-tags-popup">
          ${spot.tags.map(tag => `<span class="spot-tag-badge">${t(`tags.${tag}`)}</span>`).join(' ')}
        </div>
        ${spot.isEncrypted ? 
          `<div class="encrypted-location-info">
            <div class="encrypted-badge">
              <span class="encrypted-icon">🔒</span> ${t('privacy.encryptedLocation')}
            </div>
            <div class="encrypted-id-display">
              <span class="tee-id-label">${t('privacy.teeId')}:</span>
              <span class="tee-id-value">${spot.encryptedId?.substring(0, 12)}...${spot.encryptedId?.substring(spot.encryptedId.length - 8)}</span>
            </div>
          </div>` : 
          `<div class="location-coordinates">
            <span>${t('privacy.coordinates')}: ${spot.coordinates[1].toFixed(6)}, ${spot.coordinates[0].toFixed(6)}</span>
          </div>`
        }
        <div class="reward-info-popup">
          <p>${t('mapMenu.rewardsNearby')}: ${countRewardsForSpot(spot.id)}</p>
        </div>
        <button class="visit-proof-button" data-spot-id="${spot.id}" style="
          background-color: #4CAF50;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 10px;
          width: 100%;
        ">
          ${spot.hasVisitProof ? t('mapMenu.viewVisitProof') : t('mapMenu.createVisitProof')}
        </button>`;
      
      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(popupContent);

      // Use gold color for markers with proofs, blue for regular, and purple for encrypted
      const markerColor = spot.hasVisitProof ? '#FFD700' : (spot.isEncrypted ? '#9c27b0' : '#0066cc');
      
      const marker = new mapboxgl.Marker({ color: markerColor })
        .setLngLat(spot.coordinates)
        .setPopup(popup)
        .addTo(map);

      markersRef.current[spot.id] = marker;
      
      // Add event listener to the popup after it's added to the DOM
      popup.on('open', () => {
        setTimeout(() => {
          const proofButton = document.querySelector(`.visit-proof-button[data-spot-id="${spot.id}"]`);
          if (proofButton) {
            proofButton.addEventListener('click', () => {
              handleShowZKProof(spot);
            });
          }
        }, 10);
      });
    });

    return () => {
      Object.values(markersRef.current).forEach(marker => marker.remove());
    };
  }, [map, spots, t, i18n.language, rewards, activeTag, privacyMode]);

  // Count rewards linked to a specific spot
  const countRewardsForSpot = (spotId: string): number => {
    return rewards.filter(reward => reward.linkedSpotId === spotId).length;
  };

  const handleSearch = async () => {
    if (!map || !searchQuery) return;

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${mapboxgl.accessToken}`
      );
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        map.flyTo({
          center: [lng, lat],
          zoom: 12
        });
      }
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const handleAddSpot = async () => {
    if (!map || !newSpotName) return;

    const spotCoordinates = addSpotPosition || 
      (coordinates ? coordinates : [map.getCenter().lng, map.getCenter().lat]);

    const newSpotId = Date.now().toString();
    
    // Generate encrypted ID for the spot using privacy utils
    let encryptedId = "";
    let isEncrypted = false;
    
    if (privacyMode) {
      try {
        // Encrypt coordinates for private spots
        encryptedId = await encryptLocationData(
          spotCoordinates[1], // latitude
          spotCoordinates[0], // longitude
          newSpotId // use spot id as a salt
        );
        isEncrypted = true;
      } catch (error) {
        console.error("Failed to encrypt location:", error);
        // Continue without encryption if it fails
      }
    }
    
    const newSpot: Spot = {
      id: newSpotId,
      name: newSpotName,
      coordinates: [
        Number(spotCoordinates[0].toFixed(6)), 
        Number(spotCoordinates[1].toFixed(6))
      ],
      description: newSpotDescription,
      emoji: newSpotEmoji,
      tags: newSpotTags,
      isEncrypted: isEncrypted,
      encryptedId: encryptedId
    };

    setSpots([...spots, newSpot]);
    
    // Generate rewards around the new spot
    const newRewards = generateRewardsAroundLocation(
      [
        Number(spotCoordinates[0].toFixed(6)), 
        Number(spotCoordinates[1].toFixed(6))
      ],
      0.01,
      Math.floor(Math.random() * 5) + 3, // 3-7 rewards
      newSpotId
    );
    setRewards(prevRewards => [...prevRewards, ...newRewards]);
    
    setIsAddingSpot(false);
    setNewSpotName('');
    setNewSpotDescription('');
    setNewSpotEmoji('🏞️');
    setNewSpotTags(['other']);
    setAddSpotPosition(null);
    
    // Remove temp marker and clear clicked position
    if (tempMarkerRef.current) {
      tempMarkerRef.current.remove();
      tempMarkerRef.current = null;
    }
    onClearClickedPosition();
  };

  const handleCancelAddSpot = () => {
    setIsAddingSpot(false);
    setNewSpotName('');
    setNewSpotDescription('');
    setNewSpotEmoji('🏞️');
    setNewSpotTags(['other']);
    setAddSpotPosition(null);
    
    // Remove temp marker and clear clicked position
    if (tempMarkerRef.current) {
      tempMarkerRef.current.remove();
      tempMarkerRef.current = null;
    }
    onClearClickedPosition();
  };

  const handleSpotClick = (coordinates: [number, number]) => {
    if (!map) return;
    
    map.flyTo({
      center: coordinates,
      zoom: 14
    });
  };

  const handleDeleteSpot = (id: string) => {
    // Delete the spot
    setSpots(spots.filter(spot => spot.id !== id));
    
    // Delete associated rewards
    setRewards(rewards.filter(reward => reward.linkedSpotId !== id));
  };

  const handleGetCurrentLocation = () => {
    if (!map) return;
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation: [number, number] = [position.coords.longitude, position.coords.latitude];
          
          map.flyTo({
            center: userLocation,
            zoom: 14
          });
          
          if (isAddingSpot) {
            // Clear previous temp marker if exists
            if (tempMarkerRef.current) {
              tempMarkerRef.current.remove();
              tempMarkerRef.current = null;
            }
            
            // Create a temporary marker at the user location
            tempMarkerRef.current = new mapboxgl.Marker({ color: '#ff0000' })
              .setLngLat(userLocation)
              .addTo(map);
            
            // Set position for new spot
            setAddSpotPosition(userLocation);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          alert(t('mapMenu.locationError'));
        }
      );
    } else {
      alert(t('mapMenu.geolocationNotSupported'));
    }
  };

  const handleCollectReward = (rewardId: string) => {
    setRewards(prevRewards => prevRewards.map(reward => 
      reward.id === rewardId ? { ...reward, isVisible: false } : reward
    ));
    setSelectedReward(null);
    setShowRewardInfo(false);
  };

  // Toggle tag selection for adding spot or filtering
  const handleTagToggle = (tag: string) => {
    // For browsing, filter the spots by tag
    setActiveTag(activeTag === tag ? null : tag);
  };
  
  // Toggle privacy mode for location encryption
  const handleTogglePrivacyMode = () => {
    setPrivacyMode(!privacyMode);
  };
  
  // Get filtered spots based on active tag
  const filteredSpots = activeTag 
    ? spots.filter(spot => spot.tags.includes(activeTag))
    : spots;

  // Show ZK proof card for the selected spot
  const handleShowZKProof = (spot: Spot) => {
    setSelectedSpot(spot);
    setShowZKProofCard(true);
  };
  
  // Handle successful proof generation
  const handleProofGenerated = (isValid: boolean) => {
    if (isValid && selectedSpot) {
      // Update spot to mark it as having a visit proof
      setSpots(prev => 
        prev.map(spot => 
          spot.id === selectedSpot.id 
            ? { ...spot, hasVisitProof: true } 
            : spot
        )
      );
      
      // Close the ZK proof card after a short delay
      setTimeout(() => {
        setShowZKProofCard(false);
        setSelectedSpot(null);
      }, 2000);
    }
  };

  const handleToggleHeatmap = () => {
    // Re-enable heatmap functionality
    const newState = !showPrivacyHeatmap;
    setShowPrivacyHeatmap(newState);
    if (onTogglePrivacyHeatmap) {
      onTogglePrivacyHeatmap(newState);
    }
  };

  // 更新当前位置的加密ID
  useEffect(() => {
    if (coordinates && privacyMode) {
      const updateEncryptedId = async () => {
        try {
          const encId = await encryptLocationData(
            coordinates[1],
            coordinates[0],
            "loc-id"
          );
          setEncryptedCoordinateId(encId.substring(0, 10) + "...");
        } catch (error) {
          console.error("Failed to encrypt coordinates:", error);
          setEncryptedCoordinateId("[加密错误]");
        }
      };
      
      updateEncryptedId();
    }
  }, [coordinates, privacyMode]);

  return (
    <>
      <div className={`map-menu ${theme === 'dark' ? 'dark-theme' : ''} ${isMenuCollapsed ? 'collapsed' : ''}`}>
        <div className="menu-content">
          <div className="search-section">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('mapMenu.searchPlaceholder')}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch}>{t('mapMenu.searchButton')}</button>
          </div>

          <div className="location-controls">
            <button className="current-location-btn" onClick={handleGetCurrentLocation}>
              {t('mapMenu.getCurrentLocation')}
            </button>
            <p className="coordinates-display">
              {t('mapMenu.coordinates')}: {coordinates && privacyMode ? 
                `${t('privacy.teeId')}: ${encryptedCoordinateId}` : 
                coordinates ? `${coordinates[0]}, ${coordinates[1]}` : "..."}
            </p>
            <div className="privacy-toggle"
                 onMouseEnter={() => setShowPrivacyTooltip(true)}
                 onMouseLeave={() => setShowPrivacyTooltip(false)}>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={privacyMode} 
                  onChange={handleTogglePrivacyMode}
                />
                <span className="slider round"></span>
              </label>
              <span className="privacy-label">
                {privacyMode ? (
                  <span><span className="lock-icon">🔒</span> {t('privacy.enabled')}</span>
                ) : (
                  <span><span className="unlock-icon">🔓</span> {t('privacy.disabled')}</span>
                )}
              </span>
              
              {showPrivacyTooltip && privacyMode && (
                <div className="privacy-tooltip">
                  <p>{t('privacy.locationEncryptionNotice')}</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="rewards-info-section">
            <h3>{t('mapMenu.rewardsInfo')}</h3>
            <p>{t('mapMenu.rewardsExplanation')}</p>
            <div className="reward-types">
              <div className="reward-type">
                <span className="reward-emoji">🔥</span> {t('mapMenu.highValueReward')}
              </div>
              <div className="reward-type">
                <span className="reward-emoji">⭐️</span> {t('mapMenu.mediumValueReward')}
              </div>
              <div className="reward-type">
                <span className="reward-emoji">🍀</span> {t('mapMenu.lowValueReward')}
              </div>
            </div>
            
            {onTogglePrivacyHeatmap && (
              <div className="privacy-heatmap-card" 
                   onMouseEnter={() => setShowHeatmapTooltip(true)}
                   onMouseLeave={() => setShowHeatmapTooltip(false)}>
                <button 
                  className={`heatmap-toggle-btn ${showPrivacyHeatmap ? 'active' : ''}`}
                  onClick={handleToggleHeatmap}
                >
                  <span className="heatmap-icon">🔒</span>
                  {showPrivacyHeatmap ? t('privacy.hideHeatmap') : t('privacy.showHeatmap')}
                </button>
                
                {showHeatmapTooltip && (
                  <div className="privacy-tooltip">
                    <p>
                      <span className="privacy-icon">🔒</span>
                      This heatmap shows areas of activity without revealing individual GPS data. All analytics are computed within the TEE.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="spots-section">
            <div className="spots-header">
              <h3>{t('mapMenu.privateSpots')}</h3>
              <button onClick={() => !isAddingSpot && setIsAddingSpot(true)}>{t('mapMenu.addSpot')}</button>
            </div>

            {/* Tags for filtering */}
            <div className="tags-filter">
              <button 
                key="all" 
                className={`tag-filter-btn ${activeTag === null ? 'active' : ''}`}
                onClick={() => setActiveTag(null)}
              >
                {t('tags.all')}
              </button>
              {SPOT_TAGS.map(tag => (
                <button 
                  key={tag} 
                  className={`tag-filter-btn ${activeTag === tag ? 'active' : ''}`}
                  onClick={() => handleTagToggle(tag)}
                >
                  {t(`tags.${tag}`)}
                </button>
              ))}
            </div>

            {isAddingSpot && (
              <div className="add-spot-form">
                <input
                  type="text"
                  value={newSpotName}
                  onChange={(e) => setNewSpotName(e.target.value)}
                  placeholder={t('mapMenu.spotNamePlaceholder')}
                />
                <textarea
                  value={newSpotDescription}
                  onChange={(e) => setNewSpotDescription(e.target.value)}
                  placeholder={t('mapMenu.spotDescriptionPlaceholder')}
                />
                
                {/* Emoji selection */}
                <div className="emoji-selection">
                  <label>{t('mapMenu.selectEmoji')}:</label>
                  <div className="emoji-options">
                    {SPOT_EMOJIS.map(emoji => (
                      <button 
                        key={emoji} 
                        type="button"
                        className={`emoji-btn ${newSpotEmoji === emoji ? 'selected' : ''}`}
                        onClick={() => setNewSpotEmoji(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="selected-coordinates">
                  <p>
                    {t('mapMenu.selectedLocation')}: 
                    {addSpotPosition ? (
                      privacyMode ? 
                        ` ${t('privacy.encryptedCoordinates')}` : 
                        ` ${addSpotPosition[0].toFixed(6)}, ${addSpotPosition[1].toFixed(6)}`
                    ) : (
                      t('mapMenu.noLocationSelected')
                    )}
                  </p>
                </div>
                
                <div className="add-spot-buttons">
                  <button onClick={handleAddSpot} disabled={!newSpotName}>{t('mapMenu.saveSpot')}</button>
                  <button onClick={handleCancelAddSpot}>{t('mapMenu.cancel')}</button>
                </div>
              </div>
            )}

            <div className="spot-cards">
              {filteredSpots.length === 0 ? (
                <p className="no-spots">{activeTag ? t('mapMenu.noSpotsWithTag') : t('mapMenu.noSpots')}</p>
              ) : (
                filteredSpots.map(spot => (
                  <div key={spot.id} className={`spot-card ${spot.isEncrypted ? 'encrypted-spot' : ''}`}>
                    <div className="spot-emoji">
                      <span className="emoji-display">{spot.emoji}</span>
                      {spot.isEncrypted && (
                        <div className="encrypted-badge">
                          <span className="encrypted-icon">🔒</span>
                        </div>
                      )}
                    </div>
                    <div className="spot-content">
                      <h4>{spot.name}</h4>
                      <div className="spot-tags">
                        {spot.tags.map(tag => (
                          <span key={tag} className="tag-badge">{t(`tags.${tag}`)}</span>
                        ))}
                      </div>
                      <p>{spot.description || t('mapMenu.noDescription')}</p>
                      
                      {/* Show encrypted ID or coordinates based on privacy mode */}
                      {spot.isEncrypted ? (
                        <div className="encrypted-location-info">
                          <p className="tee-id">
                            <span className="tee-id-label">{t('privacy.teeId')}:</span> 
                            <span className="tee-id-value">{spot.encryptedId?.substring(0, 8)}...{spot.encryptedId?.substring(spot.encryptedId?.length - 6)}</span>
                          </p>
                        </div>
                      ) : (
                        <p className="coordinates-info">
                          {t('privacy.coordinates')}: {spot.coordinates[1].toFixed(6)}, {spot.coordinates[0].toFixed(6)}
                        </p>
                      )}
                      
                      <p className="spot-rewards-count">
                        {t('mapMenu.rewardsNearby')}: {countRewardsForSpot(spot.id)}
                      </p>
                      <div className="spot-actions">
                        <button onClick={() => handleSpotClick(spot.coordinates)}>{t('mapMenu.viewOnMap')}</button>
                        {onShowAnalytics && (
                          <button 
                            onClick={() => onShowAnalytics({ name: spot.name, coordinates: spot.coordinates })}
                            className="analytics-btn"
                          >
                            {t('mapMenu.viewAnalytics')}
                          </button>
                        )}
                        <button onClick={() => handleDeleteSpot(spot.id)} className="delete-btn">{t('mapMenu.delete')}</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        {showRewardInfo && selectedReward && (
          <div className={`reward-info-modal ${theme === 'dark' ? 'dark-theme' : ''}`}>
            <h3>{t('mapMenu.rewardFound')}</h3>
            <div className="reward-emoji-large">{selectedReward.emoji}</div>
            <p>{t('mapMenu.rewardDescription')}</p>
            <button onClick={() => handleCollectReward(selectedReward.id)}>{t('mapMenu.collectReward')}</button>
            <button onClick={() => setShowRewardInfo(false)}>{t('mapMenu.closeReward')}</button>
          </div>
        )}
        
        {/* ZK Location Proof Card */}
        {showZKProofCard && selectedSpot && (
          <div className="zk-proof-container">
            <ZKLocationProofCard
              locationName={selectedSpot.name}
              locationCoordinates={selectedSpot.coordinates}
              onProofGenerated={handleProofGenerated}
            />
            <button 
              className="close-proof-card"
              onClick={() => setShowZKProofCard(false)}
              style={{
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                marginTop: '10px'
              }}
            >
              {t('common.close')}
            </button>
          </div>
        )}
      </div>
    </>
  );
} 