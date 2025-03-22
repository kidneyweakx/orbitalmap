import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import mapboxgl from 'mapbox-gl';
import { generatePrivacyHeatmap } from '../utils/privacyUtils';

interface PrivacyHeatmapLayerProps {
  map: mapboxgl.Map | null;
  isVisible: boolean;
}

/**
 * A component that adds a privacy-preserving heatmap layer to the map.
 * The heatmap data is generated in the TEE, ensuring user privacy.
 */
export function PrivacyHeatmapLayer({ map, isVisible }: PrivacyHeatmapLayerProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [hasHeatmapSource, setHasHeatmapSource] = useState(false);

  // Initialize the heatmap layer when the map is ready
  useEffect(() => {
    if (!map) return;

    // Check if heatmap source already exists
    const hasSource = map.getSource('privacy-heatmap');
    setHasHeatmapSource(!!hasSource);

    if (!hasSource) {
      // Add the heatmap source if it doesn't exist
      map.addSource('privacy-heatmap', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // Add the heatmap layer
      map.addLayer({
        id: 'privacy-heatmap-layer',
        type: 'heatmap',
        source: 'privacy-heatmap',
        minzoom: 1,
        paint: {
          // Increase weight based on point intensity
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['get', 'value'],
            0, 0.1,
            3, 1
          ],
          // Increase intensity as zoom level increases
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 1,
            9, 3
          ],
          // Assign color values based on density
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(33,102,172,0)',
            0.2, 'rgb(103,169,207)',
            0.4, 'rgb(209,229,240)',
            0.6, 'rgb(253,219,199)',
            0.8, 'rgb(239,138,98)',
            1, 'rgb(178,24,43)'
          ],
          // Adjust radius based on zoom level
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 2,
            9, 20
          ],
          // Decrease opacity to zero at higher zoom levels
          'heatmap-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7, 1,
            9, 0.5
          ]
        }
      });

      setHasHeatmapSource(true);
    }

    // Set initial visibility based on isVisible prop
    updateLayerVisibility(isVisible);

    return () => {
      // Clean up is optional as the map might be reused
      // If needed, the layer can be removed with:
      // if (map.getLayer('privacy-heatmap-layer')) {
      //   map.removeLayer('privacy-heatmap-layer');
      // }
      // if (map.getSource('privacy-heatmap')) {
      //   map.removeSource('privacy-heatmap');
      // }
    };
  }, [map]);

  // Update heatmap data when the map view changes
  useEffect(() => {
    if (!map || !isVisible || !hasHeatmapSource) return;

    // Add an event listener for when the map finishes moving
    const handleMoveEnd = async () => {
      if (!map) return;
      
      // Get current map bounds
      const bounds = map.getBounds();
      if (!bounds) {
        console.error('Map bounds are not available');
        return;
      }
      
      // Show loading indicator
      setIsLoading(true);
      
      try {
        // Generate privacy-preserving heatmap data from TEE
        const heatmapData = await generatePrivacyHeatmap({
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest()
        });
        
        // Update the heatmap source data
        const source = map.getSource('privacy-heatmap');
        if (source) {
          (source as mapboxgl.GeoJSONSource).setData(heatmapData);
        }
      } catch (error) {
        console.error('Failed to generate privacy heatmap data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Register event listener
    map.on('moveend', handleMoveEnd);
    
    // Initial data load
    handleMoveEnd();

    return () => {
      // Remove event listener when component unmounts
      map.off('moveend', handleMoveEnd);
    };
  }, [map, isVisible, hasHeatmapSource]);

  // Update layer visibility when isVisible changes
  useEffect(() => {
    updateLayerVisibility(isVisible);
  }, [isVisible]);

  // Helper function to update layer visibility
  const updateLayerVisibility = (visible: boolean) => {
    if (!map || !hasHeatmapSource) return;
    
    const visibility = visible ? 'visible' : 'none';
    
    if (map.getLayer('privacy-heatmap-layer')) {
      map.setLayoutProperty('privacy-heatmap-layer', 'visibility', visibility);
    }
  };

  // Render a loading indicator or info message
  return isVisible ? (
    <div className="privacy-heatmap-info">
      {isLoading && (
        <div className="privacy-heatmap-loading">
          <div className="loading-spinner"></div>
          <p>{t('privacy.heatmapLoading')}</p>
        </div>
      )}
      <div className="privacy-heatmap-legend">
        <div className="legend-title">{t('privacy.heatmapPrivacyTitle')}</div>
        <div className="legend-description">{t('privacy.heatmapPrivacyDescription')}</div>
        <div className="legend-colors">
          <div className="color-scale">
            <div className="color-low"></div>
            <div className="color-medium"></div>
            <div className="color-high"></div>
          </div>
          <div className="legend-labels">
            <span>Low</span>
            <span>Medium</span>
            <span>High</span>
          </div>
        </div>
      </div>
    </div>
  ) : null;
} 