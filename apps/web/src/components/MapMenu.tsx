import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import mapboxgl from 'mapbox-gl';

interface Spot {
  id: string;
  name: string;
  coordinates: [number, number];
  description?: string;
  imageUrl?: string;
}

interface MapMenuProps {
  map: mapboxgl.Map | null;
  clickedPosition: [number, number] | null;
  onClearClickedPosition: () => void;
}

export function MapMenu({ map, clickedPosition, onClearClickedPosition }: MapMenuProps) {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [isAddingSpot, setIsAddingSpot] = useState(false);
  const [newSpotName, setNewSpotName] = useState('');
  const [newSpotDescription, setNewSpotDescription] = useState('');
  const [newSpotImageUrl, setNewSpotImageUrl] = useState('');
  const [addSpotPosition, setAddSpotPosition] = useState<[number, number] | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const markersRef = useRef<{ [id: string]: mapboxgl.Marker }>({});
  const tempMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    
  }, [clickedPosition, map]);

  // Load saved spots from localStorage
  useEffect(() => {
    const savedSpots = localStorage.getItem('mapSpots');
    if (savedSpots) {
      try {
        setSpots(JSON.parse(savedSpots));
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

    // Add new markers
    spots.forEach(spot => {
      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
        `<h3>${spot.name}</h3>
        <p>${spot.description || t('mapMenu.noDescription')}</p>`
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
  }, [map, spots, t, i18n.language]);

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
    
    const newSpot: Spot = {
      id: Date.now().toString(),
      name: newSpotName,
      coordinates: [
        Number(spotCoordinates[0].toFixed(6)), 
        Number(spotCoordinates[1].toFixed(6))
      ],
      description: newSpotDescription,
      imageUrl: newSpotImageUrl || 'https://via.placeholder.com/150?text=Spot'
    };

    setSpots([...spots, newSpot]);
    setIsAddingSpot(false);
    setNewSpotName('');
    setNewSpotDescription('');
    setNewSpotImageUrl('');
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
    setSpots(spots.filter(spot => spot.id !== id));
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

  return (
    <div className="map-menu">
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

      <div className="spots-section">
        <div className="spots-header">
          <h3>{t('mapMenu.privateSpots')}</h3>
          <button onClick={() => !isAddingSpot && setIsAddingSpot(true)}>{t('mapMenu.addSpot')}</button>
        </div>

        {isAddingSpot && (
          <div className="add-spot-form">
            {addSpotPosition && (
              <p className="selected-coordinates">
                {t('mapMenu.selectedLocation')}: {addSpotPosition[0].toFixed(6)}, {addSpotPosition[1].toFixed(6)}
              </p>
            )}
            <div className="image-upload-section">
              <div className="image-preview">
                {newSpotImageUrl ? (
                  <img src={newSpotImageUrl} alt="Spot preview" />
                ) : (
                  <div className="image-placeholder">
                    <span>{t('mapMenu.imagePlaceholder')}</span>
                  </div>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                ref={fileInputRef}
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
            <div className="form-buttons">
              <button onClick={handleAddSpot}>{t('mapMenu.save')}</button>
              <button onClick={handleCancelAddSpot}>{t('mapMenu.cancel')}</button>
            </div>
          </div>
        )}

        <div className="spots-list">
          {spots.length === 0 ? (
            <p className="no-spots">{t('mapMenu.noSpots')}</p>
          ) : (
            spots.map((spot) => (
              <div key={spot.id} className="spot-card">
                <div className="spot-image">
                  <img src={spot.imageUrl || 'https://via.placeholder.com/150?text=Spot'} alt={spot.name} />
                </div>
                <div className="spot-content">
                  <div className="spot-header">
                    <h4>{spot.name}</h4>
                  </div>
                  {spot.description && <p className="description">{spot.description}</p>}
                  <div className="spot-actions">
                    <button 
                      className="navigate-button" 
                      onClick={() => handleSpotClick(spot.coordinates)}
                    >
                      {t('mapMenu.navigateHere')}
                    </button>
                    <button 
                      className="delete-spot" 
                      onClick={() => handleDeleteSpot(spot.id)}
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
    </div>
  );
} 