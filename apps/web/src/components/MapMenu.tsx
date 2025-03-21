import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import mapboxgl from 'mapbox-gl';
import { Reward, generateRewardsAroundLocation } from '../utils/rewardGenerator';
import { ThemeMode } from '../App';

interface Spot {
  id: string;
  name: string;
  coordinates: [number, number];
  description?: string;
  imageUrl?: string;
  tags: string[]; // Add tags field
}

// Available tag options
export const SPOT_TAGS = ['food', 'photo', 'nature', 'shopping', 'culture', 'other'];

interface MapMenuProps {
  map: mapboxgl.Map | null;
  clickedPosition: [number, number] | null;
  onClearClickedPosition: () => void;
  rewards: Reward[];
  setRewards: React.Dispatch<React.SetStateAction<Reward[]>>;
  theme: ThemeMode;
}

export function MapMenu({ map, clickedPosition, onClearClickedPosition, rewards, setRewards, theme }: MapMenuProps) {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [isAddingSpot, setIsAddingSpot] = useState(false);
  const [newSpotName, setNewSpotName] = useState('');
  const [newSpotDescription, setNewSpotDescription] = useState('');
  const [newSpotImageUrl, setNewSpotImageUrl] = useState('');
  const [newSpotTags, setNewSpotTags] = useState<string[]>(['other']); // Default tag
  const [addSpotPosition, setAddSpotPosition] = useState<[number, number] | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isMenuCollapsed, setIsMenuCollapsed] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const markersRef = useRef<{ [id: string]: mapboxgl.Marker }>({});
  const tempMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showRewardInfo, setShowRewardInfo] = useState(false);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  
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
        
        // Handle migration of old spots data without tags
        const updatedSpots = parsedSpots.map((spot: Omit<Spot, 'tags'> & { tags?: string[] }) => {
          if (!spot.tags) {
            return { ...spot, tags: ['other'] };
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
      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
        `<h3>${spot.name}</h3>
        <p>${spot.description || t('mapMenu.noDescription')}</p>
        <div class="spot-tags-popup">
          ${spot.tags.map(tag => `<span class="spot-tag-badge">${t(`tags.${tag}`)}</span>`).join(' ')}
        </div>
        <div class="reward-info-popup">
          <p>${t('mapMenu.rewardsNearby')}: ${countRewardsForSpot(spot.id)}</p>
        </div>`
      );

      const marker = new mapboxgl.Marker({ color: '#0066cc' })
        .setLngLat(spot.coordinates)
        .setPopup(popup)
        .addTo(map);

      markersRef.current[spot.id] = marker;
    });

    return () => {
      Object.values(markersRef.current).forEach(marker => marker.remove());
    };
  }, [map, spots, t, i18n.language, rewards, activeTag]);

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

  const handleAddSpot = () => {
    if (!map || !newSpotName) return;

    const spotCoordinates = addSpotPosition || 
      (coordinates ? coordinates : [map.getCenter().lng, map.getCenter().lat]);
    
    const newSpotId = Date.now().toString();
    
    const newSpot: Spot = {
      id: newSpotId,
      name: newSpotName,
      coordinates: [
        Number(spotCoordinates[0].toFixed(6)), 
        Number(spotCoordinates[1].toFixed(6))
      ],
      description: newSpotDescription,
      imageUrl: newSpotImageUrl || 'https://via.placeholder.com/150?text=Spot',
      tags: newSpotTags
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
    setNewSpotImageUrl('');
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
    setNewSpotImageUrl('');
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

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    setIsUploading(true);
    
    try {
      // For demonstration purposes, we'll use a mock upload instead of an actual ImgBB upload
      // In a real application, you would use the API key from environment variables
      // const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY;
      
      // Simulate uploading delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generate a temporary local URL for the uploaded image
      const imageUrl = URL.createObjectURL(file);
      setNewSpotImageUrl(imageUrl);
      
      // In a real application, you would use actual image hosting:
      /*
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      
      if (data.success) {
        setNewSpotImageUrl(data.data.url);
      } else {
        console.error('Upload failed:', data);
        alert(t('mapMenu.uploadError'));
      }
      */
    } catch (error) {
      console.error('Error processing image:', error);
      alert(t('mapMenu.uploadError'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleCollectReward = (rewardId: string) => {
    setRewards(prevRewards => prevRewards.map(reward => 
      reward.id === rewardId ? { ...reward, isVisible: false } : reward
    ));
    setSelectedReward(null);
    setShowRewardInfo(false);
  };

  const handleTagToggle = (tag: string) => {
    if (isAddingSpot) {
      // If adding a spot, toggle the tag selection
      setNewSpotTags(prevTags => {
        if (prevTags.includes(tag)) {
          // Don't remove if it's the last tag
          if (prevTags.length === 1) return prevTags;
          return prevTags.filter(t => t !== tag);
        } else {
          return [...prevTags, tag];
        }
      });
    } else {
      // If browsing, filter the spots by tag
      setActiveTag(activeTag === tag ? null : tag);
    }
  };
  
  // Get filtered spots based on active tag
  const filteredSpots = activeTag 
    ? spots.filter(spot => spot.tags.includes(activeTag))
    : spots;

  return (
    <>
      {/* Hamburger menu button */}
      <div 
        className={`hamburger-menu ${!isMenuCollapsed ? 'active' : ''}`} 
        onClick={() => setIsMenuCollapsed(!isMenuCollapsed)}
      >
        <span></span>
        <span></span>
        <span></span>
      </div>
      
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
            <p className="coordinates-display">{t('mapMenu.coordinates')}: {coordinates ? `${coordinates[0]}, ${coordinates[1]}` : '...'}</p>
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
          </div>

          <div className="spots-section">
            <div className="spots-header">
              <h3>{t('mapMenu.privateSpots')}</h3>
              <button onClick={() => !isAddingSpot && setIsAddingSpot(true)}>{t('mapMenu.addSpot')}</button>
            </div>

            {/* Tags for filtering */}
            <div className="tags-filter">
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
                
                {/* Tags selection for new spot */}
                <div className="tags-selection">
                  <label>{t('mapMenu.selectTags')}:</label>
                  <div className="tags-options">
                    {SPOT_TAGS.map(tag => (
                      <button 
                        key={tag} 
                        type="button"
                        className={`tag-btn ${newSpotTags.includes(tag) ? 'selected' : ''}`}
                        onClick={() => handleTagToggle(tag)}
                      >
                        {t(`tags.${tag}`)}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="image-upload-section">
                  <div className="image-preview">
                    {newSpotImageUrl && (
                      <img src={newSpotImageUrl} alt="Preview" />
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                  <button 
                    className="upload-image-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? t('mapMenu.uploading') : t('mapMenu.uploadImage')}
                  </button>
                </div>
                
                <div className="selected-coordinates">
                  <p>{t('mapMenu.selectedLocation')}: {addSpotPosition ? `${addSpotPosition[0].toFixed(6)}, ${addSpotPosition[1].toFixed(6)}` : t('mapMenu.noLocationSelected')}</p>
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
                  <div key={spot.id} className="spot-card">
                    <div className="spot-image">
                      <img src={spot.imageUrl} alt={spot.name} />
                    </div>
                    <div className="spot-content">
                      <h4>{spot.name}</h4>
                      <div className="spot-tags">
                        {spot.tags.map(tag => (
                          <span key={tag} className="tag-badge">{t(`tags.${tag}`)}</span>
                        ))}
                      </div>
                      <p>{spot.description || t('mapMenu.noDescription')}</p>
                      <p className="spot-rewards-count">
                        {t('mapMenu.rewardsNearby')}: {countRewardsForSpot(spot.id)}
                      </p>
                      <div className="spot-actions">
                        <button onClick={() => handleSpotClick(spot.coordinates)}>{t('mapMenu.viewOnMap')}</button>
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
      </div>
    </>
  );
} 