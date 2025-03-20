import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import mapboxgl from 'mapbox-gl';

interface Spot {
  id: string;
  name: string;
  coordinates: [number, number];
  description?: string;
}

interface MapMenuProps {
  map: mapboxgl.Map | null;
}

export function MapMenu({ map }: MapMenuProps) {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [isAddingSpot, setIsAddingSpot] = useState(false);
  const [newSpotName, setNewSpotName] = useState('');
  const [newSpotDescription, setNewSpotDescription] = useState('');
  const markersRef = useRef<{ [id: string]: mapboxgl.Marker }>({});

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

    const center = map.getCenter();
    const newSpot: Spot = {
      id: Date.now().toString(),
      name: newSpotName,
      coordinates: [Number(center.lng.toFixed(6)), Number(center.lat.toFixed(6))],
      description: newSpotDescription
    };

    setSpots([...spots, newSpot]);
    setIsAddingSpot(false);
    setNewSpotName('');
    setNewSpotDescription('');
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

      <div className="coordinates-section">
        <p>{t('mapMenu.coordinates')}: {coordinates ? `${coordinates[0]}, ${coordinates[1]}` : '...'}</p>
      </div>

      <div className="spots-section">
        <div className="spots-header">
          <h3>{t('mapMenu.privateSpots')}</h3>
          <button onClick={() => setIsAddingSpot(true)}>{t('mapMenu.addSpot')}</button>
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
            <div className="form-buttons">
              <button onClick={handleAddSpot}>{t('mapMenu.save')}</button>
              <button onClick={() => setIsAddingSpot(false)}>{t('mapMenu.cancel')}</button>
            </div>
          </div>
        )}

        <div className="spots-list">
          {spots.length === 0 ? (
            <p className="no-spots">{t('mapMenu.noSpots')}</p>
          ) : (
            spots.map((spot) => (
              <div key={spot.id} className="spot-item">
                <div className="spot-header">
                  <h4>{spot.name}</h4>
                  <button className="delete-spot" onClick={() => handleDeleteSpot(spot.id)}>
                    {t('mapMenu.delete')}
                  </button>
                </div>
                <p className="spot-coordinates">{spot.coordinates[0]}, {spot.coordinates[1]}</p>
                {spot.description && <p className="description">{spot.description}</p>}
                <button className="navigate-button" onClick={() => handleSpotClick(spot.coordinates)}>
                  {t('mapMenu.navigateHere')}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
} 