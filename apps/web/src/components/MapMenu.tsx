import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import mapboxgl from 'mapbox-gl';
import { ThemeMode } from '../App';
import { Reward, generateRewardsAroundLocation } from '../utils/rewardGenerator';
import { ZKLocationProofCard } from './ZKLocationProofCard';
import { encryptLocationData } from '../utils/privacyUtils'; // Import encryption utility
import { registerPOI } from '../utils/contractUtils';
import { useWallets } from '@privy-io/react-auth';

interface Spot {
  id: string;
  name: string;
  coordinates: [number, number];
  description?: string;
  emoji: string; // Emoji instead of imageUrl
  tags: string[]; // Add tags field
  hasVisitProof?: boolean; // New field to track if user has proven visit
  encryptedId?: string; // Add encrypted ID field
  isEncrypted: boolean; // Track encryption status
}

// Available tag options
export const SPOT_TAGS = ['food', 'photo', 'nature', 'shopping', 'culture', 'other'];

// Available emoji options
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
  const { wallets } = useWallets();
  
  // Get embedded wallet for transactions
  const embeddedWallet = wallets?.find(wallet => wallet.walletClientType === 'privy');
  
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [isAddingSpot, setIsAddingSpot] = useState(false);
  const [newSpotName, setNewSpotName] = useState('');
  const [newSpotDescription, setNewSpotDescription] = useState('');
  const [newSpotEmoji, setNewSpotEmoji] = useState('🏞️'); // Default emoji
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
  // Keep privacyMode for compatibility with spot encryption features
  const [privacyMode] = useState(true); // Default to privacy mode on
  // Keep state variable for when heatmap functionality is restored
  const [showPrivacyHeatmap, setShowPrivacyHeatmap] = useState(false);
  const [showHeatmapTooltip, setShowHeatmapTooltip] = useState(false);
  
  // Add the active tab state - only spots and rewards now
  const [activeTab, setActiveTab] = useState<'spots' | 'rewards'>('spots');

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
  const handleProofGenerated = async (isValid: boolean) => {
    if (isValid && selectedSpot) {
      try {
        // First register the POI on the blockchain
        if (embeddedWallet) {
          const provider = await embeddedWallet.getEthereumProvider();
          
          // Switch to Sepolia for L1 contract
          try {
            const sepoliaChainId = 11155111;
            await embeddedWallet.switchChain(sepoliaChainId);
          } catch (err) {
            console.error("Error switching to Sepolia:", err);
          }
          
          // Random price between 0.001 and 0.01 ETH for demo
          const subscriptionPrice = (Math.random() * 0.009 + 0.001).toFixed(4);
          
          // Register the POI with the selected spot data
          const result = await registerPOI(
            provider,
            selectedSpot.name,
            selectedSpot.coordinates[1], // lat
            selectedSpot.coordinates[0], // lng
            "0.01", // stake amount
            true, // requires subscription
            subscriptionPrice
          );
          
          if (result.success) {
            console.log(`POI registered successfully with ID: ${result.poiId}`);
            alert(t('mapMenu.poiRegisteredSuccess', { poiId: result.poiId }));
          } else {
            console.error("Failed to register POI:", result.error);
            alert(t('mapMenu.poiRegistrationFailed'));
          }
        }
      } catch (error) {
        console.error("Error during POI registration:", error);
      }
      
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

  // Handle tab change - updated for only spots and rewards
  const handleTabChange = (tab: 'spots' | 'rewards') => {
    setActiveTab(tab);
  };

  return (
    <>
      <div className={`map-menu ${theme === 'dark' ? 'dark-theme' : ''} ${isMenuCollapsed ? 'collapsed' : ''}`}>
        <div className="menu-header">
          <h2>{t('mapMenu.title')}</h2>
        </div>
        
        <div className="menu-content">
          <div className="menu-tabs">
            <button 
              className={activeTab === 'spots' ? 'active' : ''} 
              onClick={() => handleTabChange('spots')}
            >
              {t('mapMenu.spotsTab')}
            </button>
            <button 
              className={activeTab === 'rewards' ? 'active' : ''} 
              onClick={() => handleTabChange('rewards')}
            >
              {t('mapMenu.rewardsTab')}
            </button>
          </div>
          
          {/* Existing content for spots tab */}
          {activeTab === 'spots' && (
            <div className="spots-section">
              <div className="spots-header">
                <h3>{t('mapMenu.privateSpots')}</h3>
                <button onClick={() => !isAddingSpot && setIsAddingSpot(true)}>
                  {t('mapMenu.addSpot')}
                </button>
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
                    <button 
                      onClick={handleAddSpot} 
                      disabled={!newSpotName}
                      className="save-button"
                    >
                      {t('mapMenu.saveSpot')}
                    </button>
                    <button 
                      onClick={handleCancelAddSpot}
                      className="cancel-button"
                    >
                      {t('mapMenu.cancel')}
                    </button>
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
                        <p className="spot-description">{spot.description || t('mapMenu.noDescription')}</p>
                        
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
                          <button 
                            onClick={() => handleSpotClick(spot.coordinates)}
                            className="view-button"
                          >
                            {t('mapMenu.viewOnMap')}
                          </button>
                          {onShowAnalytics && (
                            <button 
                              onClick={() => onShowAnalytics({ name: spot.name, coordinates: spot.coordinates })}
                              className="analytics-button"
                            >
                              {t('mapMenu.viewAnalytics')}
                            </button>
                          )}
                          <button 
                            onClick={() => handleDeleteSpot(spot.id)} 
                            className="delete-button"
                          >
                            {t('mapMenu.delete')}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          
          {/* Existing content for rewards tab */}
          {activeTab === 'rewards' && (
            <div className="rewards-info-section">
              <h3>{t('mapMenu.rewardsInfo')}</h3>
              <p>{t('mapMenu.rewardsExplanation')}</p>
              <div className="reward-types">
                <div className="reward-type">
                  <span className="reward-emoji">💎</span> {t('mapMenu.highValueReward')}
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
                        {t('privacy.heatmapTooltip')}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        
        {showRewardInfo && selectedReward && (
          <div className={`reward-info-modal ${theme === 'dark' ? 'dark-theme' : ''}`}>
            <h3>{t('mapMenu.rewardFound')}</h3>
            <div className="reward-emoji-large">{selectedReward.emoji}</div>
            <p>{t('mapMenu.rewardDescription')}</p>
            <div className="reward-action-buttons">
              <button 
                onClick={() => handleCollectReward(selectedReward.id)}
                className="collect-button"
              >
                {t('mapMenu.collectReward')}
              </button>
              <button 
                onClick={() => setShowRewardInfo(false)}
                className="close-button"
              >
                {t('mapMenu.closeReward')}
              </button>
            </div>
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
            >
              {t('common.close')}
            </button>
          </div>
        )}
      </div>
    </>
  );
} 