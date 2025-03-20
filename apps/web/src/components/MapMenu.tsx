import { useState, useEffect } from 'react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [isAddingSpot, setIsAddingSpot] = useState(false);
  const [newSpotName, setNewSpotName] = useState('');
  const [newSpotDescription, setNewSpotDescription] = useState('');

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

  return (
    <div className="map-menu">
      <div className="search-section">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜尋地點..."
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button onClick={handleSearch}>搜尋</button>
      </div>

      <div className="coordinates-section">
        <p>座標: {coordinates ? `${coordinates[0]}, ${coordinates[1]}` : '載入中...'}</p>
      </div>

      <div className="spots-section">
        <div className="spots-header">
          <h3>私密景點列表</h3>
          <button onClick={() => setIsAddingSpot(true)}>新增景點</button>
        </div>

        {isAddingSpot && (
          <div className="add-spot-form">
            <input
              type="text"
              value={newSpotName}
              onChange={(e) => setNewSpotName(e.target.value)}
              placeholder="景點名稱"
            />
            <textarea
              value={newSpotDescription}
              onChange={(e) => setNewSpotDescription(e.target.value)}
              placeholder="景點描述 (選填)"
            />
            <div className="form-buttons">
              <button onClick={handleAddSpot}>儲存</button>
              <button onClick={() => setIsAddingSpot(false)}>取消</button>
            </div>
          </div>
        )}

        <div className="spots-list">
          {spots.map((spot) => (
            <div key={spot.id} className="spot-item">
              <h4>{spot.name}</h4>
              <p>{spot.coordinates[0]}, {spot.coordinates[1]}</p>
              {spot.description && <p className="description">{spot.description}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 