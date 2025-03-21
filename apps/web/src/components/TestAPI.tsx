import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  validateReward,
  getTravelRecommendation,
  getExplorationRecommendation,
  getMapboxInteraction,
  TravelRecommendationRequest
} from '../utils/api';

interface TestAPIProps {
  onClose: () => void;
}

enum APIEndpoint {
  TRAVEL_RECOMMENDATION = 'travel_recommendation',
  EXPLORATION_RECOMMENDATION = 'exploration_recommendation',
  MAPBOX_INTERACTION = 'mapbox_interaction',
  VALIDATE_REWARD = 'validate_reward'
}

export function TestAPI({ onClose }: TestAPIProps) {
  const { t } = useTranslation();
  const [selectedEndpoint, setSelectedEndpoint] = useState<APIEndpoint | null>(null);
  const [responseData, setResponseData] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Travel Recommendation form
  const [travelRecommendationForm, setTravelRecommendationForm] = useState<TravelRecommendationRequest>({
    longitude: 121.5654,
    latitude: 25.0330,
    weather: 'sunny',
    interests: ['history', 'food', 'nature'],
    hotspots: [
      {
        name: 'Taipei 101',
        longitude: 121.5654,
        latitude: 25.0330,
        type: 'attraction'
      }
    ]
  });

  // Exploration Recommendation form
  const [exploreForm, setExploreForm] = useState({
    latitude: 25.0330,
    longitude: 121.5654,
    interests: ['history', 'food', 'nature']
  });

  // Mapbox Interaction form
  const [mapboxForm, setMapboxForm] = useState({
    query: 'Show me interesting places in Taipei',
    currentLocation: [121.5654, 25.0330] as [number, number]
  });

  // Validate Reward form
  const [rewardForm, setRewardForm] = useState({
    rewardCoordinates: [121.5654, 25.0330] as [number, number],
    hotspotCoordinates: [121.5657, 25.0332] as [number, number],
    maxDistance: 0.01
  });

  const handleTravelRecommendationSubmit = async () => {
    setIsLoading(true);
    try {
      const response = await getTravelRecommendation(travelRecommendationForm);
      setResponseData(JSON.stringify(response, null, 2));
    } catch (error) {
      console.error('Error getting travel recommendation:', error);
      setResponseData(JSON.stringify({ error: 'Failed to get travel recommendation' }, null, 2));
    } finally {
      setIsLoading(false);
    }
  };

  const handleExplorationRecommendationSubmit = async () => {
    setIsLoading(true);
    try {
      const response = await getExplorationRecommendation(
        exploreForm.latitude,
        exploreForm.longitude,
        exploreForm.interests
      );
      setResponseData(JSON.stringify(response, null, 2));
    } catch (error) {
      console.error('Error getting exploration recommendation:', error);
      setResponseData(JSON.stringify({ error: 'Failed to get exploration recommendation' }, null, 2));
    } finally {
      setIsLoading(false);
    }
  };

  const handleMapboxInteractionSubmit = async () => {
    setIsLoading(true);
    try {
      const response = await getMapboxInteraction(
        mapboxForm.query,
        mapboxForm.currentLocation
      );
      setResponseData(JSON.stringify(response, null, 2));
    } catch (error) {
      console.error('Error getting mapbox interaction:', error);
      setResponseData(JSON.stringify({ error: 'Failed to get mapbox interaction response' }, null, 2));
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidateRewardSubmit = async () => {
    setIsLoading(true);
    try {
      const response = await validateReward(
        rewardForm.rewardCoordinates,
        rewardForm.hotspotCoordinates,
        rewardForm.maxDistance
      );
      setResponseData(JSON.stringify(response, null, 2));
    } catch (error) {
      console.error('Error validating reward:', error);
      setResponseData(JSON.stringify({ error: 'Failed to validate reward' }, null, 2));
    } finally {
      setIsLoading(false);
    }
  };

  const renderEndpointSelector = () => (
    <div className="endpoint-selector tee-features">
      <h3>{t('testAPI.selectEndpoint')}</h3>
      <div className="endpoint-buttons tee-feature-grid">
        <button 
          className={`tee-feature-button ${selectedEndpoint === APIEndpoint.TRAVEL_RECOMMENDATION ? 'selected' : ''}`}
          onClick={() => setSelectedEndpoint(APIEndpoint.TRAVEL_RECOMMENDATION)}
        >
          <span className="emoji">🧭</span>
          {t('testAPI.travelRecommendation')}
        </button>
        <button 
          className={`tee-feature-button ${selectedEndpoint === APIEndpoint.EXPLORATION_RECOMMENDATION ? 'selected' : ''}`}
          onClick={() => setSelectedEndpoint(APIEndpoint.EXPLORATION_RECOMMENDATION)}
        >
          <span className="emoji">🗺️</span>
          {t('testAPI.explorationRecommendation')}
        </button>
        <button 
          className={`tee-feature-button ${selectedEndpoint === APIEndpoint.MAPBOX_INTERACTION ? 'selected' : ''}`}
          onClick={() => setSelectedEndpoint(APIEndpoint.MAPBOX_INTERACTION)}
        >
          <span className="emoji">💬</span>
          {t('testAPI.mapboxInteraction')}
        </button>
        <button 
          className={`tee-feature-button ${selectedEndpoint === APIEndpoint.VALIDATE_REWARD ? 'selected' : ''}`}
          onClick={() => setSelectedEndpoint(APIEndpoint.VALIDATE_REWARD)}
        >
          <span className="emoji">✅</span>
          {t('testAPI.validateReward')}
        </button>
      </div>
    </div>
  );

  const renderTravelRecommendationForm = () => (
    <div className="api-form tee-form">
      <h3 className="form-header">{t('testAPI.travelRecommendationTitle')}</h3>
      <div className="form-row">
        <label>{t('testAPI.latitude')}</label>
        <input
          type="number"
          value={travelRecommendationForm.latitude}
          onChange={(e) => setTravelRecommendationForm({
            ...travelRecommendationForm,
            latitude: parseFloat(e.target.value)
          })}
        />
      </div>
      <div className="form-row">
        <label>{t('testAPI.longitude')}</label>
        <input
          type="number"
          value={travelRecommendationForm.longitude}
          onChange={(e) => setTravelRecommendationForm({
            ...travelRecommendationForm,
            longitude: parseFloat(e.target.value)
          })}
        />
      </div>
      <div className="form-row">
        <label>{t('testAPI.weather')}</label>
        <input
          type="text"
          value={travelRecommendationForm.weather}
          onChange={(e) => setTravelRecommendationForm({
            ...travelRecommendationForm,
            weather: e.target.value
          })}
        />
      </div>
      <div className="form-row">
        <label>{t('testAPI.interests')}</label>
        <input
          type="text"
          value={travelRecommendationForm.interests.join(', ')}
          onChange={(e) => setTravelRecommendationForm({
            ...travelRecommendationForm,
            interests: e.target.value.split(',').map(i => i.trim())
          })}
        />
      </div>
      <button 
        onClick={handleTravelRecommendationSubmit}
        disabled={isLoading}
        className="submit-button tee-button"
      >
        {isLoading ? t('testAPI.processing') : t('testAPI.getRecommendation')}
      </button>
    </div>
  );

  const renderExplorationRecommendationForm = () => (
    <div className="api-form tee-form">
      <h3 className="form-header">{t('testAPI.explorationRecommendationTitle')}</h3>
      <div className="form-row">
        <label>{t('testAPI.latitude')}</label>
        <input
          type="number"
          value={exploreForm.latitude}
          onChange={(e) => setExploreForm({
            ...exploreForm,
            latitude: parseFloat(e.target.value)
          })}
        />
      </div>
      <div className="form-row">
        <label>{t('testAPI.longitude')}</label>
        <input
          type="number"
          value={exploreForm.longitude}
          onChange={(e) => setExploreForm({
            ...exploreForm,
            longitude: parseFloat(e.target.value)
          })}
        />
      </div>
      <div className="form-row">
        <label>{t('testAPI.interests')}</label>
        <input
          type="text"
          value={exploreForm.interests.join(', ')}
          onChange={(e) => setExploreForm({
            ...exploreForm,
            interests: e.target.value.split(',').map(i => i.trim())
          })}
        />
      </div>
      <button 
        onClick={handleExplorationRecommendationSubmit}
        disabled={isLoading}
        className="submit-button tee-button"
      >
        {isLoading ? t('testAPI.processing') : t('testAPI.getRecommendation')}
      </button>
    </div>
  );

  const renderMapboxInteractionForm = () => (
    <div className="api-form tee-form">
      <h3 className="form-header">{t('testAPI.mapboxInteractionTitle')}</h3>
      <div className="form-row">
        <label>{t('testAPI.query')}</label>
        <input
          type="text"
          value={mapboxForm.query}
          onChange={(e) => setMapboxForm({
            ...mapboxForm,
            query: e.target.value
          })}
        />
      </div>
      <div className="form-row">
        <label>{t('testAPI.currentLocation')}</label>
        <div className="location-inputs">
          <input
            type="number"
            value={mapboxForm.currentLocation[0]}
            onChange={(e) => setMapboxForm({
              ...mapboxForm,
              currentLocation: [parseFloat(e.target.value), mapboxForm.currentLocation[1]]
            })}
            placeholder="Longitude"
          />
          <input
            type="number"
            value={mapboxForm.currentLocation[1]}
            onChange={(e) => setMapboxForm({
              ...mapboxForm,
              currentLocation: [mapboxForm.currentLocation[0], parseFloat(e.target.value)]
            })}
            placeholder="Latitude"
          />
        </div>
      </div>
      <button 
        onClick={handleMapboxInteractionSubmit}
        disabled={isLoading}
        className="submit-button tee-button"
      >
        {isLoading ? t('testAPI.processing') : t('testAPI.sendQuery')}
      </button>
    </div>
  );

  const renderValidateRewardForm = () => (
    <div className="api-form tee-form">
      <h3 className="form-header">{t('testAPI.validateRewardTitle')}</h3>
      <div className="form-row">
        <label>{t('testAPI.rewardCoordinates')}</label>
        <div className="location-inputs">
          <input
            type="number"
            value={rewardForm.rewardCoordinates[0]}
            onChange={(e) => setRewardForm({
              ...rewardForm,
              rewardCoordinates: [parseFloat(e.target.value), rewardForm.rewardCoordinates[1]]
            })}
            placeholder="Longitude"
          />
          <input
            type="number"
            value={rewardForm.rewardCoordinates[1]}
            onChange={(e) => setRewardForm({
              ...rewardForm,
              rewardCoordinates: [rewardForm.rewardCoordinates[0], parseFloat(e.target.value)]
            })}
            placeholder="Latitude"
          />
        </div>
      </div>
      <div className="form-row">
        <label>{t('testAPI.hotspotCoordinates')}</label>
        <div className="location-inputs">
          <input
            type="number"
            value={rewardForm.hotspotCoordinates[0]}
            onChange={(e) => setRewardForm({
              ...rewardForm,
              hotspotCoordinates: [parseFloat(e.target.value), rewardForm.hotspotCoordinates[1]]
            })}
            placeholder="Longitude"
          />
          <input
            type="number"
            value={rewardForm.hotspotCoordinates[1]}
            onChange={(e) => setRewardForm({
              ...rewardForm,
              hotspotCoordinates: [rewardForm.hotspotCoordinates[0], parseFloat(e.target.value)]
            })}
            placeholder="Latitude"
          />
        </div>
      </div>
      <div className="form-row">
        <label>{t('testAPI.maxDistance')}</label>
        <input
          type="number"
          value={rewardForm.maxDistance}
          onChange={(e) => setRewardForm({
            ...rewardForm,
            maxDistance: parseFloat(e.target.value)
          })}
          step="0.001"
        />
      </div>
      <button 
        onClick={handleValidateRewardSubmit}
        disabled={isLoading}
        className="submit-button tee-button"
      >
        {isLoading ? t('testAPI.processing') : t('testAPI.validateReward')}
      </button>
    </div>
  );

  const renderSelectedEndpoint = () => {
    switch (selectedEndpoint) {
      case APIEndpoint.TRAVEL_RECOMMENDATION:
        return renderTravelRecommendationForm();
      case APIEndpoint.EXPLORATION_RECOMMENDATION:
        return renderExplorationRecommendationForm();
      case APIEndpoint.MAPBOX_INTERACTION:
        return renderMapboxInteractionForm();
      case APIEndpoint.VALIDATE_REWARD:
        return renderValidateRewardForm();
      default:
        return null;
    }
  };

  return (
    <div className="zk-verification-modal tee-zone-modal">
      <div className="modal-header">
        <div className="modal-title">
          <h2>{t('testAPI.title')}</h2>
        </div>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="modal-content">
        {!selectedEndpoint && renderEndpointSelector()}
        
        {selectedEndpoint && (
          <>
            <button 
              className="back-button"
              onClick={() => {
                setSelectedEndpoint(null);
                setResponseData('');
              }}
            >
              {t('testAPI.back')}
            </button>
            
            <div className="api-test-container tee-form-container">
              <div className="api-form-container">
                {renderSelectedEndpoint()}
              </div>
              
              <div className="api-response-container tee-result">
                <h3>{t('testAPI.response')}</h3>
                <pre className="response-data result-raw-json">
                  {responseData || t('testAPI.noResponse')}
                </pre>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
