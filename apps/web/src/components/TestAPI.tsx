import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface TestAPIProps {
  onClose: () => void;
}

enum APIEndpoint {
  TravelRecommendation = 'travelRecommendation',
  ExplorationRecommendation = 'explorationRecommendation',
  MapboxInteraction = 'mapboxInteraction',
  RewardValidation = 'rewardValidation'
}

interface TravelRecommendationActivity {
  time: string;
  activity: string;
  location: [number, number];
}

interface TravelRecommendationDay {
  day: number;
  activities: TravelRecommendationActivity[];
}

interface Place {
  name: string;
  type?: string;
  coordinates: [number, number];
  rating?: number;
  distance?: string;
}

interface APIResponse {
  status: 'success' | 'error';
  message?: string;
  recommendations?: TravelRecommendationDay[];
  places?: Place[];
  validation?: {
    isValid: boolean;
    rewardValue?: number;
    rewardType?: string;
    message?: string;
  };
}

export function TestAPI({ onClose }: TestAPIProps) {
  const { t } = useTranslation();
  const [selectedEndpoint, setSelectedEndpoint] = useState<APIEndpoint | null>(null);
  const [responseData, setResponseData] = useState<APIResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form states
  const [travelForm, setTravelForm] = useState({
    destination: '',
    days: 3,
    preferences: '',
    withKids: false,
  });
  
  const [explorationForm, setExplorationForm] = useState({
    currentLocation: [0, 0],
    radius: 5,
    categories: '',
    maxResults: 10
  });
  
  const [mapboxForm, setMapboxForm] = useState({
    query: '',
    currentLocation: [0, 0]
  });
  
  const [rewardForm, setRewardForm] = useState({
    rewardId: '',
    claimCode: '',
    userLocation: [0, 0]
  });
  
  const handleTravelRecommendationSubmit = async () => {
    setIsLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setResponseData({
        status: 'success',
        recommendations: [
          {
            day: 1,
            activities: [
              { time: '09:00', activity: 'Visit the Central Park', location: [35.6812, 139.7671] },
              { time: '12:30', activity: 'Lunch at Traditional Restaurant', location: [35.6821, 139.7681] },
              { time: '15:00', activity: 'Explore National Museum', location: [35.6761, 139.7743] }
            ]
          },
          {
            day: 2,
            activities: [
              { time: '10:00', activity: 'Visit Tokyo Tower', location: [35.6586, 139.7454] },
              { time: '13:00', activity: 'Lunch at Seaside Restaurant', location: [35.6545, 139.7432] },
              { time: '16:00', activity: 'Shopping in Ginza', location: [35.6721, 139.7636] }
            ]
          },
          {
            day: 3,
            activities: [
              { time: '09:30', activity: 'Visit Meiji Shrine', location: [35.6764, 139.6993] },
              { time: '12:30', activity: 'Lunch in Harajuku', location: [35.6702, 139.7067] },
              { time: '14:30', activity: 'Explore Asakusa & Senso-ji Temple', location: [35.7147, 139.7966] }
            ]
          }
        ]
      });
    } catch (error) {
      console.error('Error submitting travel recommendation request:', error);
      setResponseData({
        status: 'error',
        message: 'Failed to get travel recommendations. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleExplorationRecommendationSubmit = async () => {
    setIsLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setResponseData({
        status: 'success',
        places: [
          { name: 'Hidden Waterfall', type: 'nature', coordinates: [explorationForm.currentLocation[0] + 0.02, explorationForm.currentLocation[1] + 0.01], rating: 4.8 },
          { name: 'Viewpoint Café', type: 'food', coordinates: [explorationForm.currentLocation[0] - 0.01, explorationForm.currentLocation[1] + 0.03], rating: 4.5 },
          { name: 'Historic Temple', type: 'culture', coordinates: [explorationForm.currentLocation[0] + 0.03, explorationForm.currentLocation[1] - 0.02], rating: 4.7 },
          { name: 'Local Market', type: 'shopping', coordinates: [explorationForm.currentLocation[0] - 0.02, explorationForm.currentLocation[1] - 0.01], rating: 4.3 }
        ]
      });
    } catch (error) {
      console.error('Error submitting exploration recommendation request:', error);
      setResponseData({
        status: 'error',
        message: 'Failed to get exploration recommendations. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleMapboxInteractionSubmit = async () => {
    setIsLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setResponseData({
        status: 'success',
        places: [
          { name: 'Tokyo Tower', coordinates: [139.7454, 35.6586], distance: '1.2 km' },
          { name: 'Meiji Shrine', coordinates: [139.6993, 35.6764], distance: '3.5 km' },
          { name: 'Senso-ji Temple', coordinates: [139.7966, 35.7147], distance: '5.8 km' },
          { name: 'Shibuya Crossing', coordinates: [139.7016, 35.6595], distance: '2.1 km' }
        ]
      });
    } catch (error) {
      console.error('Error submitting mapbox interaction request:', error);
      setResponseData({
        status: 'error',
        message: 'Failed to get places information. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRewardValidationSubmit = async () => {
    setIsLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Randomly generate success or failure for demo purposes
      const isValid = Math.random() > 0.3;
      
      if (isValid) {
        setResponseData({
          status: 'success',
          validation: {
            isValid: true,
            rewardValue: Math.floor(Math.random() * 100) + 50,
            rewardType: 'points',
            message: 'Reward successfully validated and claimed!'
          }
        });
      } else {
        setResponseData({
          status: 'success',
          validation: {
            isValid: false,
            message: 'Invalid reward code or the reward has already been claimed.'
          }
        });
      }
    } catch (error) {
      console.error('Error submitting reward validation request:', error);
      setResponseData({
        status: 'error',
        message: 'Failed to validate reward. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const renderTravelRecommendationForm = () => (
    <div className="api-form">
      <h3>{t('testAPI.travelRecommendationTitle', 'Travel Recommendations')}</h3>
      <div className="form-group">
        <label>{t('testAPI.destination')}</label>
        <input
          type="text"
          value={travelForm.destination}
          onChange={(e) => setTravelForm({
            ...travelForm,
            destination: e.target.value
          })}
          placeholder={t('testAPI.destinationPlaceholder', 'e.g. Tokyo, Japan')}
          className="form-control"
        />
      </div>
      <div className="form-group">
        <label>{t('testAPI.days')}</label>
        <input
          type="number"
          value={travelForm.days}
          onChange={(e) => setTravelForm({
            ...travelForm,
            days: parseInt(e.target.value) || 1
          })}
          min="1"
          max="14"
          className="form-control"
        />
      </div>
      <div className="form-group">
        <label>{t('testAPI.preferences')}</label>
        <input
          type="text"
          value={travelForm.preferences}
          onChange={(e) => setTravelForm({
            ...travelForm,
            preferences: e.target.value
          })}
          placeholder={t('testAPI.preferencesPlaceholder', 'e.g. nature, food, culture')}
          className="form-control"
        />
      </div>
      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={travelForm.withKids}
            onChange={(e) => setTravelForm({
              ...travelForm,
              withKids: e.target.checked
            })}
          />
          {t('testAPI.withKids', 'Traveling with kids')}
        </label>
      </div>
      <button 
        onClick={handleTravelRecommendationSubmit}
        disabled={isLoading || !travelForm.destination}
        className="action-button"
      >
        {isLoading ? t('testAPI.processing', 'Processing...') : t('testAPI.getRecommendations', 'Get Recommendations')}
      </button>
    </div>
  );
  
  const renderExplorationRecommendationForm = () => (
    <div className="api-form">
      <h3>{t('testAPI.explorationRecommendationTitle', 'Exploration Recommendations')}</h3>
      <div className="form-group">
        <label>{t('testAPI.currentLocation')}</label>
        <div className="location-inputs">
          <input
            type="number"
            value={explorationForm.currentLocation[0]}
            onChange={(e) => setExplorationForm({
              ...explorationForm,
              currentLocation: [parseFloat(e.target.value) || 0, explorationForm.currentLocation[1]]
            })}
            placeholder="Longitude"
            className="form-control"
          />
          <input
            type="number"
            value={explorationForm.currentLocation[1]}
            onChange={(e) => setExplorationForm({
              ...explorationForm,
              currentLocation: [explorationForm.currentLocation[0], parseFloat(e.target.value) || 0]
            })}
            placeholder="Latitude"
            className="form-control"
          />
        </div>
      </div>
      <div className="form-group">
        <label>{t('testAPI.radius', 'Search Radius (km)')}</label>
        <input
          type="number"
          value={explorationForm.radius}
          onChange={(e) => setExplorationForm({
            ...explorationForm,
            radius: parseInt(e.target.value) || 1
          })}
          min="1"
          max="50"
          className="form-control"
        />
      </div>
      <div className="form-group">
        <label>{t('testAPI.categories', 'Categories')}</label>
        <input
          type="text"
          value={explorationForm.categories}
          onChange={(e) => setExplorationForm({
            ...explorationForm,
            categories: e.target.value
          })}
          placeholder={t('testAPI.categoriesPlaceholder', 'e.g. nature, food, culture')}
          className="form-control"
        />
      </div>
      <div className="form-group">
        <label>{t('testAPI.maxResults', 'Max Results')}</label>
        <input
          type="number"
          value={explorationForm.maxResults}
          onChange={(e) => setExplorationForm({
            ...explorationForm,
            maxResults: parseInt(e.target.value) || 5
          })}
          min="1"
          max="20"
          className="form-control"
        />
      </div>
      <button 
        onClick={handleExplorationRecommendationSubmit}
        disabled={isLoading}
        className="action-button"
      >
        {isLoading ? t('testAPI.processing', 'Processing...') : t('testAPI.findPlaces', 'Find Places')}
      </button>
    </div>
  );
  
  const renderMapboxInteractionForm = () => (
    <div className="api-form">
      <h3>{t('testAPI.mapboxInteractionTitle', 'Mapbox Interaction')}</h3>
      <div className="form-group">
        <label>{t('testAPI.query')}</label>
        <input
          type="text"
          value={mapboxForm.query}
          onChange={(e) => setMapboxForm({
            ...mapboxForm,
            query: e.target.value
          })}
          placeholder={t('testAPI.queryPlaceholder', 'e.g. restaurants, parks, museums')}
          className="form-control"
        />
      </div>
      <div className="form-group">
        <label>{t('testAPI.currentLocation')}</label>
        <div className="location-inputs">
          <input
            type="number"
            value={mapboxForm.currentLocation[0]}
            onChange={(e) => setMapboxForm({
              ...mapboxForm,
              currentLocation: [parseFloat(e.target.value) || 0, mapboxForm.currentLocation[1]]
            })}
            placeholder="Longitude"
            className="form-control"
          />
          <input
            type="number"
            value={mapboxForm.currentLocation[1]}
            onChange={(e) => setMapboxForm({
              ...mapboxForm,
              currentLocation: [mapboxForm.currentLocation[0], parseFloat(e.target.value) || 0]
            })}
            placeholder="Latitude"
            className="form-control"
          />
        </div>
      </div>
      <button 
        onClick={handleMapboxInteractionSubmit}
        disabled={isLoading}
        className="action-button"
      >
        {isLoading ? t('testAPI.processing', 'Processing...') : t('testAPI.sendQuery', 'Send Query')}
      </button>
    </div>
  );
  
  const renderRewardValidationForm = () => (
    <div className="api-form">
      <h3>{t('testAPI.rewardValidationTitle', 'Reward Validation')}</h3>
      <div className="form-group">
        <label>{t('testAPI.rewardId', 'Reward ID')}</label>
        <input
          type="text"
          value={rewardForm.rewardId}
          onChange={(e) => setRewardForm({
            ...rewardForm,
            rewardId: e.target.value
          })}
          placeholder={t('testAPI.rewardIdPlaceholder', 'Enter reward ID')}
          className="form-control"
        />
      </div>
      <div className="form-group">
        <label>{t('testAPI.claimCode', 'Claim Code')}</label>
        <input
          type="text"
          value={rewardForm.claimCode}
          onChange={(e) => setRewardForm({
            ...rewardForm,
            claimCode: e.target.value
          })}
          placeholder={t('testAPI.claimCodePlaceholder', 'Enter claim code')}
          className="form-control"
        />
      </div>
      <div className="form-group">
        <label>{t('testAPI.userLocation', 'Your Current Location')}</label>
        <div className="location-inputs">
          <input
            type="number"
            value={rewardForm.userLocation[0]}
            onChange={(e) => setRewardForm({
              ...rewardForm,
              userLocation: [parseFloat(e.target.value) || 0, rewardForm.userLocation[1]]
            })}
            placeholder="Longitude"
            className="form-control"
          />
          <input
            type="number"
            value={rewardForm.userLocation[1]}
            onChange={(e) => setRewardForm({
              ...rewardForm,
              userLocation: [rewardForm.userLocation[0], parseFloat(e.target.value) || 0]
            })}
            placeholder="Latitude"
            className="form-control"
          />
        </div>
      </div>
      <button 
        onClick={handleRewardValidationSubmit}
        disabled={isLoading || !rewardForm.rewardId || !rewardForm.claimCode}
        className="action-button"
      >
        {isLoading ? t('testAPI.processing', 'Processing...') : t('testAPI.validateReward', 'Validate Reward')}
      </button>
    </div>
  );
  
  const renderEndpointSelector = () => (
    <div className="treasure-box-card-selector">
      <h3>{t('testAPI.selectEndpoint', 'Select an API endpoint to test')}</h3>
      <div className="card-options">
        <div 
          className="card-option"
          onClick={() => setSelectedEndpoint(APIEndpoint.TravelRecommendation)}
        >
          <div className="option-icon l1-icon">✈️</div>
          <h4>{t('testAPI.travelRecommendation', 'Travel Recommendation')}</h4>
          <p>{t('testAPI.travelRecommendationDesc', 'Get personalized travel itineraries')}</p>
        </div>
        
        <div 
          className="card-option"
          onClick={() => setSelectedEndpoint(APIEndpoint.ExplorationRecommendation)}
        >
          <div className="option-icon l2-icon">🔍</div>
          <h4>{t('testAPI.explorationRecommendation', 'Exploration')}</h4>
          <p>{t('testAPI.explorationRecommendationDesc', 'Discover nearby places')}</p>
        </div>
        
        <div 
          className="card-option"
          onClick={() => setSelectedEndpoint(APIEndpoint.MapboxInteraction)}
        >
          <div className="option-icon private-icon">🗺️</div>
          <h4>{t('testAPI.mapboxInteraction', 'Mapbox Search')}</h4>
          <p>{t('testAPI.mapboxInteractionDesc', 'Search for locations')}</p>
        </div>
        
        <div 
          className="card-option"
          onClick={() => setSelectedEndpoint(APIEndpoint.RewardValidation)}
        >
          <div className="option-icon l1-icon">🏆</div>
          <h4>{t('testAPI.rewardValidation', 'Reward Validation')}</h4>
          <p>{t('testAPI.rewardValidationDesc', 'Validate and claim rewards')}</p>
        </div>
      </div>
    </div>
  );
  
  const handleBack = () => {
    setSelectedEndpoint(null);
    setResponseData(null);
  };
  
  const renderForm = () => {
    if (!selectedEndpoint) return renderEndpointSelector();
    
    return (
      <>
        <button className="back-button" onClick={handleBack}>
          ← {t('back')}
        </button>
        
        {selectedEndpoint === APIEndpoint.TravelRecommendation && renderTravelRecommendationForm()}
        {selectedEndpoint === APIEndpoint.ExplorationRecommendation && renderExplorationRecommendationForm()}
        {selectedEndpoint === APIEndpoint.MapboxInteraction && renderMapboxInteractionForm()}
        {selectedEndpoint === APIEndpoint.RewardValidation && renderRewardValidationForm()}
      </>
    );
  };
  
  return (
    <div className="treasure-box-container">
      <div className="treasure-box-overlay" onClick={onClose}></div>
      
      <div className="treasure-box-content">
        <div className="treasure-box-header">
          <h2><span role="img" aria-label="api">🧪</span> {t('testAPI.title', 'API Testing')}</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>
        
        <div className="treasure-box-body">
          {renderForm()}
          
          {responseData && (
            <div className="api-response-container">
              <h3>{t('testAPI.response', 'Response')}</h3>
              <div className={`status-message ${responseData.status === 'success' ? 'success-message' : 'error-message'}`}>
                <pre className="result-raw-json">{JSON.stringify(responseData, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
