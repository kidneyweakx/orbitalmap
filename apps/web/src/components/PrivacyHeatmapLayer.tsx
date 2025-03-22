import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { generatePrivacyHeatmap } from '../utils/privacyUtils';

interface PrivacyHeatmapLayerProps {
  map: mapboxgl.Map | null;
  isVisible: boolean;
}

/**
 * A component that adds a privacy-preserving heatmap layer to the map.
 * Using Mapbox's native heatmap layer for better performance and stability.
 */
export function PrivacyHeatmapLayer({ map, isVisible }: PrivacyHeatmapLayerProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [layerInitialized, setLayerInitialized] = useState(false);
  
  console.log('[DEBUG] PrivacyHeatmapLayer render - map:', !!map, 'isVisible:', isVisible, 'layerInitialized:', layerInitialized);
  
  // Initialize the heatmap source and layer when the map is ready
  useEffect(() => {
    if (!map) {
      console.log('[DEBUG] Map not available, skipping initialization');
      return;
    }

    // Create a reference to map that TypeScript knows is not null
    const mapInstance = map;

    // Check if map is fully loaded
    console.log('[DEBUG] Map loaded state:', mapInstance.loaded());
    
    // If map is not loaded, wait for it to load
    if (!mapInstance.loaded()) {
      console.log('[DEBUG] Map not fully loaded, waiting for load event');
      
      const handleLoad = () => {
        console.log('[DEBUG] Map load event fired, proceeding with heatmap initialization');
        initializeHeatmap();
        mapInstance.off('load', handleLoad);
      };
      
      mapInstance.on('load', handleLoad);
      return;
    }
    
    // Otherwise initialize immediately
    initializeHeatmap();
    
    function initializeHeatmap() {
      // Double check map is still available
      if (!mapInstance) {
        console.log('[DEBUG] Map no longer available, skipping initialization');
        return;
      }
      
      console.log('[DEBUG] Initializing heatmap - checking for existing source');
      
      try {
        // Create the heatmap source and layer only once
        const hasSource = mapInstance.getSource('privacy-heatmap');
        console.log('[DEBUG] Existing source check result:', !!hasSource);
        
        if (!hasSource) {
          console.log('[DEBUG] Adding new GeoJSON source: privacy-heatmap');
          // Add empty GeoJSON source first
          mapInstance.addSource('privacy-heatmap', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: []
            }
          });
          console.log('[DEBUG] Source added successfully, now checking for layer');

          // Once source is added, add the heatmap layer
          const hasLayer = mapInstance.getLayer('privacy-heatmap-layer');
          console.log('[DEBUG] Existing layer check result:', !!hasLayer);
          
          if (!hasLayer) {
            console.log('[DEBUG] Adding new heatmap layer: privacy-heatmap-layer');
            mapInstance.addLayer({
              id: 'privacy-heatmap-layer',
              type: 'heatmap',
              source: 'privacy-heatmap',
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
            
            // Extra debugging to check if layer was actually added
            const style = mapInstance.getStyle();
            const layers = style?.layers || [];
            const layerIds = layers.map(layer => layer.id);
            console.log('[DEBUG] All map layers after adding heatmap:', layerIds);
            console.log('[DEBUG] Is privacy-heatmap-layer in layers?', layerIds.includes('privacy-heatmap-layer'));

            console.log('[DEBUG] Layer added successfully');
            
            // Set initial visibility
            console.log('[DEBUG] Setting initial visibility:', isVisible ? 'visible' : 'none');
            mapInstance.setLayoutProperty(
              'privacy-heatmap-layer',
              'visibility',
              isVisible ? 'visible' : 'none'
            );
            
            setLayerInitialized(true);
            console.log('[DEBUG] Layer initialization complete');
          } else {
            console.log('[DEBUG] Layer already exists, skipping creation');
            setLayerInitialized(true);
          }
        } else {
          console.log('[DEBUG] Source already exists, using existing source/layer');
          setLayerInitialized(true);
        }
      } catch (error) {
        console.error('[DEBUG] Error initializing heatmap:', error);
      }
    }

    // Cleanup function
    return () => {
      console.log('[DEBUG] Cleanup function called');
      // We don't actually remove the layer on unmount as it might be reused
    };
  }, [map, isVisible]);

  // Update heatmap data when the map moves and visibility changes
  useEffect(() => {
    if (!map) {
      console.log('[DEBUG] Map not available, skipping data update');
      return;
    }
    
    if (!isVisible) {
      console.log('[DEBUG] Layer not visible, skipping data update');
      return;
    }
    
    if (!layerInitialized) {
      console.log('[DEBUG] Layer not initialized, skipping data update');
      return;
    }

    console.log('[DEBUG] Setting up moveend handler for data updates');
    
    // Add a moveend event listener to update data when the map is moved
    const handleMoveEnd = async () => {
      console.log('[DEBUG] moveend event triggered, updating heatmap data');
      try {
        setIsLoading(true);
        
        // Get current map bounds
        const bounds = map.getBounds();
        console.log('[DEBUG] Current map bounds:', bounds);
        
        // Check that bounds are not null before proceeding
        if (!bounds) {
          console.error('[DEBUG] Map bounds are not available');
          setIsLoading(false);
          return;
        }
        
        // Generate heatmap data based on current bounds
        console.log('[DEBUG] Generating heatmap data for current bounds');
        const heatmapData = await generatePrivacyHeatmap({
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest()
        });
        console.log('[DEBUG] Heatmap data generated:', 
          heatmapData.type, 
          'with', 
          heatmapData.features.length, 
          'points'
        );
        
        // Make sure source exists before updating
        const source = map.getSource('privacy-heatmap');
        console.log('[DEBUG] Found heatmap source:', !!source);
        
        if (source && 'setData' in source) {
          console.log('[DEBUG] Updating source data with', heatmapData.features.length, 'points');
          // This explicit type check ensures TypeScript knows this is a GeoJSONSource
          (source as mapboxgl.GeoJSONSource).setData(heatmapData);
          console.log('[DEBUG] Source data updated successfully');
        } else {
          console.error('[DEBUG] Source not found or not a GeoJSONSource');
        }
      } catch (error) {
        console.error('[DEBUG] Failed to update heatmap:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Register the event listener
    console.log('[DEBUG] Registering moveend event listener');
    map.on('moveend', handleMoveEnd);
    
    // Initial data load
    console.log('[DEBUG] Performing initial data load');
    handleMoveEnd();
    
    return () => {
      console.log('[DEBUG] Removing moveend event listener');
      map.off('moveend', handleMoveEnd);
    };
  }, [map, isVisible, layerInitialized]);

  // Update layer visibility when isVisible changes
  useEffect(() => {
    if (!map) {
      console.log('[DEBUG] Map not available, skipping visibility update');
      return;
    }
    
    if (!layerInitialized) {
      console.log('[DEBUG] Layer not initialized, skipping visibility update');
      return;
    }
    
    console.log('[DEBUG] Visibility changed to', isVisible ? 'visible' : 'none');
    
    try {
      const hasLayer = map.getLayer('privacy-heatmap-layer');
      console.log('[DEBUG] Layer exists check result:', !!hasLayer);
      
      if (hasLayer) {
        console.log('[DEBUG] Updating layer visibility to', isVisible ? 'visible' : 'none');
        map.setLayoutProperty(
          'privacy-heatmap-layer',
          'visibility',
          isVisible ? 'visible' : 'none'
        );
        console.log('[DEBUG] Layer visibility updated successfully');
      } else {
        console.error('[DEBUG] Layer not found for visibility update');
      }
    } catch (error) {
      console.error('[DEBUG] Error updating layer visibility:', error);
    }
  }, [isVisible, map, layerInitialized]);
  
  // Render loading indicator
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