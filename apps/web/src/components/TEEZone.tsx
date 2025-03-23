import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface TEEZoneProps {
  onClose: () => void;
}

// TEE供應商類型
enum TEEProvider {
  MARLIN = 'marlin',
  ENARX = 'enarx'
}

enum TEEFeature {
  LOCATION_REGISTRATION = 'location_registration',
  LOCATION_LOOKUP = 'location_lookup',
  HEATMAP = 'heatmap',
  VISIT_ANALYTICS = 'visit_analytics'
}

interface WifiNetwork {
  ssid: string;
  bssid: string;
  signal_strength: number;
}

interface CellTower {
  cell_id: string;
  signal_strength: number;
}

interface LocationRegistrationForm {
  lat: string;
  lon: string;
  user_id: string;
  device_id: string;
  wifi_networks: WifiNetwork[];
  cell_towers: CellTower[];
  accelerometer: [number, number, number] | null;
  gyroscope: [number, number, number] | null;
  is_mock_location: boolean;
}

interface LocationLookupForm {
  encrypted_location_id: string;
}

interface HeatmapForm {
  min_lat: string;
  min_lon: string;
  max_lat: string;
  max_lon: string;
}

interface VisitAnalyticsForm {
  lat: string;
  lon: string;
}

interface HeatmapCell {
  lat: number;
  lon: number;
  value: number;
}

interface Result {
  success: boolean;
  message?: string;
  encrypted_location_id?: string;
  lat?: number;
  lon?: number;
  timestamp?: number;
  visits_24h?: number;
  unique_visitors_24h?: number;
  peak_hour?: number;
  grid_cells?: HeatmapCell[];
  max_value?: number;
}

export function TEEZone({ onClose }: TEEZoneProps) {
  const { t } = useTranslation();
  const [selectedProvider, setSelectedProvider] = useState<TEEProvider | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<TEEFeature | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [enarxAvailable, setEnarxAvailable] = useState(false);
  
  // Location Registration form
  const [registrationForm, setRegistrationForm] = useState<LocationRegistrationForm>({
    lat: '37.7749',
    lon: '-122.4194',
    user_id: 'user123',
    device_id: 'device456',
    wifi_networks: [
      { ssid: 'WiFi-1', bssid: '00:11:22:33:44:55', signal_strength: -60 }
    ],
    cell_towers: [
      { cell_id: 'tower123', signal_strength: -70 }
    ],
    accelerometer: [0.1, 0.2, 0.3],
    gyroscope: [0.1, 0.2, 0.3],
    is_mock_location: false
  });

  // Location Lookup form
  const [lookupForm, setLookupForm] = useState<LocationLookupForm>({
    encrypted_location_id: ''
  });

  // Heatmap form 
  const [heatmapForm, setHeatmapForm] = useState<HeatmapForm>({
    min_lat: '37.7',
    min_lon: '-122.5',
    max_lat: '37.8',
    max_lon: '-122.3'
  });

  // Visit Analytics form
  const [analyticsForm, setVisitAnalyticsForm] = useState<VisitAnalyticsForm>({
    lat: '37.7749',
    lon: '-122.4194'
  });

  // 檢查Enarx健康狀態
  useEffect(() => {
    const checkEnarxHealth = async () => {
      try {
        const response = await fetch('http://localhost:8080/health', { 
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          // 設定較短的超時時間，以便快速失敗
          signal: AbortSignal.timeout(2000)
        });
        
        if (response.ok) {
          setEnarxAvailable(true);
        } else {
          setEnarxAvailable(false);
        }
      } catch (err) {
        console.log('Enarx not available:', err);
        setEnarxAvailable(false);
      }
    };

    checkEnarxHealth();
  }, []);

  const resetState = () => {
    if (selectedFeature) {
      setSelectedFeature(null);
    } else if (selectedProvider) {
      setSelectedProvider(null);
    }
    setIsLoading(false);
    setError(null);
    setResult(null);
  };

  const handleChangeRegistrationForm = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    if (name === 'is_mock_location') {
      setRegistrationForm({
        ...registrationForm,
        is_mock_location: (e.target as HTMLInputElement).checked
      });
    } else {
      setRegistrationForm({
        ...registrationForm,
        [name]: type === 'number' ? parseFloat(value) : value
      });
    }
  };

  const handleChangeLookupForm = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLookupForm({
      ...lookupForm,
      [e.target.name]: e.target.value
    });
  };

  const handleChangeHeatmapForm = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHeatmapForm({
      ...heatmapForm,
      [e.target.name]: e.target.value
    });
  };

  const handleChangeAnalyticsForm = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVisitAnalyticsForm({
      ...analyticsForm,
      [e.target.name]: e.target.value
    });
  };

  const getApiEndpoint = () => {
    // 根據所選供應商返回相應的API端點
    if (selectedProvider === TEEProvider.ENARX) {
      return 'http://localhost:8080';
    } else {
      // Marlin Oyster端點
      return import.meta.env.VITE_TEE_API_ENDPOINT || 'https://api.oyster.marlin.org';
    }
  };

  const handleRegisterLocation = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // 根據所選供應商調整API路徑
      const endpoint = selectedProvider === TEEProvider.ENARX
        ? `${getApiEndpoint()}/api/v1/locations` 
        : `${getApiEndpoint()}/api/location/register`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lat: parseFloat(registrationForm.lat),
          lon: parseFloat(registrationForm.lon),
          user_id: registrationForm.user_id,
          device_id: registrationForm.device_id,
          wifi_networks: registrationForm.wifi_networks,
          cell_towers: registrationForm.cell_towers,
          accelerometer: registrationForm.accelerometer,
          gyroscope: registrationForm.gyroscope,
          is_mock_location: registrationForm.is_mock_location,
          timestamp: new Date().toISOString()
        }),
      });

      const data = await response.json();
      setResult(data);
      
      // If successful, update the lookup form with the encrypted location ID
      if (data.success && data.encrypted_location_id) {
        setLookupForm({
          encrypted_location_id: data.encrypted_location_id
        });
      }
    } catch (err) {
      setError(`Failed to register location: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLookupLocation = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // 根據所選供應商調整API路徑
      const endpoint = selectedProvider === TEEProvider.ENARX
        ? `${getApiEndpoint()}/api/v1/locations/${encodeURIComponent(lookupForm.encrypted_location_id)}`
        : `${getApiEndpoint()}/api/location/get`;
      
      const method = selectedProvider === TEEProvider.ENARX ? 'GET' : 'POST';
      const body = selectedProvider === TEEProvider.ENARX ? undefined : JSON.stringify({
        encrypted_location_id: lookupForm.encrypted_location_id
      });

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body
      });

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(`Failed to lookup location: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateHeatmap = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // 根據所選供應商調整API路徑
      const endpoint = selectedProvider === TEEProvider.ENARX
        ? `${getApiEndpoint()}/api/v1/heatmap`
        : `${getApiEndpoint()}/api/heatmap`;

      const requestBody = {
        min_lat: parseFloat(heatmapForm.min_lat),
        min_lon: parseFloat(heatmapForm.min_lon),
        max_lat: parseFloat(heatmapForm.max_lat),
        max_lon: parseFloat(heatmapForm.max_lon),
        privacy_level: 1.5 // 默認隱私級別
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(`Failed to generate heatmap: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetVisitAnalytics = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // 根據所選供應商調整API路徑
      const endpoint = selectedProvider === TEEProvider.ENARX
        ? `${getApiEndpoint()}/api/v1/analytics`
        : `${getApiEndpoint()}/api/analytics/visits`;

      const requestBody = selectedProvider === TEEProvider.ENARX
        ? {
            user_id: "user123", // 使用默認用戶ID
            start_time: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30天前
            end_time: new Date().toISOString() // 現在
          }
        : {
            lat: parseFloat(analyticsForm.lat),
            lon: parseFloat(analyticsForm.lon)
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(`Failed to get visit analytics: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const renderRegistrationForm = () => (
    <div className="tee-form">
      <h3>{t('teeZone.locationRegistrationTitle')}</h3>
      <div className="form-group">
        <label>{t('teeZone.latitude')}</label>
        <input
          type="text"
          name="lat"
          value={registrationForm.lat}
          onChange={handleChangeRegistrationForm}
          placeholder="37.7749"
        />
      </div>
      <div className="form-group">
        <label>{t('teeZone.longitude')}</label>
        <input
          type="text"
          name="lon"
          value={registrationForm.lon}
          onChange={handleChangeRegistrationForm}
          placeholder="-122.4194"
        />
      </div>
      <div className="form-group">
        <label>{t('teeZone.userId')}</label>
        <input
          type="text"
          name="user_id"
          value={registrationForm.user_id}
          onChange={handleChangeRegistrationForm}
          placeholder="user123"
        />
      </div>
      <div className="form-group">
        <label>{t('teeZone.deviceId')}</label>
        <input
          type="text"
          name="device_id"
          value={registrationForm.device_id}
          onChange={handleChangeRegistrationForm}
          placeholder="device456"
        />
      </div>
      <div className="form-group checkbox-group">
        <label>{t('teeZone.isMockLocation')}</label>
        <input
          type="checkbox"
          name="is_mock_location"
          checked={registrationForm.is_mock_location}
          onChange={handleChangeRegistrationForm}
        />
      </div>
      <div className="form-actions">
        <button
          className="tee-button"
          onClick={handleRegisterLocation}
          disabled={isLoading}
        >
          {isLoading ? t('teeZone.processing') : t('teeZone.registerLocation')}
        </button>
      </div>
    </div>
  );

  const renderLookupForm = () => (
    <div className="tee-form">
      <h3>{t('teeZone.locationLookupTitle')}</h3>
      <div className="form-group">
        <label>{t('teeZone.encryptedLocationId')}</label>
        <input
          type="text"
          name="encrypted_location_id"
          value={lookupForm.encrypted_location_id}
          onChange={handleChangeLookupForm}
          placeholder="Enter encrypted location ID"
        />
      </div>
      <div className="form-actions">
        <button
          className="tee-button"
          onClick={handleLookupLocation}
          disabled={isLoading}
        >
          {isLoading ? t('teeZone.processing') : t('teeZone.lookupLocation')}
        </button>
      </div>
    </div>
  );

  const renderHeatmapForm = () => (
    <div className="tee-form">
      <h3>{t('teeZone.heatmapTitle')}</h3>
      <div className="form-row">
        <div className="form-group">
          <label>{t('teeZone.minLat')}</label>
          <input
            type="text"
            name="min_lat"
            value={heatmapForm.min_lat}
            onChange={handleChangeHeatmapForm}
            placeholder="37.7"
          />
        </div>
        <div className="form-group">
          <label>{t('teeZone.minLon')}</label>
          <input
            type="text"
            name="min_lon"
            value={heatmapForm.min_lon}
            onChange={handleChangeHeatmapForm}
            placeholder="-122.5"
          />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>{t('teeZone.maxLat')}</label>
          <input
            type="text"
            name="max_lat"
            value={heatmapForm.max_lat}
            onChange={handleChangeHeatmapForm}
            placeholder="37.8"
          />
        </div>
        <div className="form-group">
          <label>{t('teeZone.maxLon')}</label>
          <input
            type="text"
            name="max_lon"
            value={heatmapForm.max_lon}
            onChange={handleChangeHeatmapForm}
            placeholder="-122.3"
          />
        </div>
      </div>
      <div className="form-actions">
        <button
          className="tee-button"
          onClick={handleGenerateHeatmap}
          disabled={isLoading}
        >
          {isLoading ? t('teeZone.processing') : t('teeZone.generateHeatmap')}
        </button>
      </div>
    </div>
  );

  const renderVisitAnalyticsForm = () => (
    <div className="tee-form">
      <h3>{t('teeZone.visitAnalyticsTitle')}</h3>
      <div className="form-group">
        <label>{t('teeZone.latitude')}</label>
        <input
          type="text"
          name="lat"
          value={analyticsForm.lat}
          onChange={handleChangeAnalyticsForm}
          placeholder="37.7749"
        />
      </div>
      <div className="form-group">
        <label>{t('teeZone.longitude')}</label>
        <input
          type="text"
          name="lon"
          value={analyticsForm.lon}
          onChange={handleChangeAnalyticsForm}
          placeholder="-122.4194"
        />
      </div>
      <div className="form-actions">
        <button
          className="tee-button"
          onClick={handleGetVisitAnalytics}
          disabled={isLoading}
        >
          {isLoading ? t('teeZone.processing') : t('teeZone.getVisitAnalytics')}
        </button>
      </div>
    </div>
  );

  const renderHeatmapVisualization = () => {
    if (!result || !result.grid_cells || !Array.isArray(result.grid_cells)) {
      return null;
    }

    // Get max value for normalization
    const maxValue = result.max_value || 
      Math.max(...result.grid_cells.map((cell: HeatmapCell) => cell.value));

    return (
      <div className="heatmap-visualization">
        <h4>{t('teeZone.heatmapVisualizationTitle')}</h4>
        <div className="heatmap-grid">
          {result.grid_cells.map((cell: HeatmapCell, index: number) => {
            // Normalize the value to get intensity between 0 and 1
            const intensity = maxValue > 0 ? cell.value / maxValue : 0;
            // Calculate a color (red with varying opacity based on intensity)
            const backgroundColor = `rgba(255, 0, 0, ${intensity})`;
            
            return (
              <div 
                key={index} 
                className="heatmap-cell" 
                style={{ backgroundColor }}
                title={`Lat: ${cell.lat}, Lon: ${cell.lon}, Value: ${cell.value}`}
              >
                {cell.value > 0 && <span className="cell-value">{cell.value}</span>}
              </div>
            );
          })}
        </div>
        <div className="heatmap-legend">
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: 'rgba(255, 0, 0, 0.1)' }}></div>
            <span>Low</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: 'rgba(255, 0, 0, 0.5)' }}></div>
            <span>Medium</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: 'rgba(255, 0, 0, 1)' }}></div>
            <span>High</span>
          </div>
        </div>
      </div>
    );
  };

  const renderResult = () => {
    if (!result) return null;

    return (
      <div className={`tee-result ${result.success ? 'success' : 'error'}`}>
        <h4>{t('teeZone.resultTitle')}</h4>
        
        {result.message && (
          <div className="result-message">
            <strong>{t('teeZone.message')}:</strong> {result.message}
          </div>
        )}
        
        {/* Location Registration Result */}
        {result.encrypted_location_id && (
          <div className="result-detail">
            <strong>{t('teeZone.encryptedLocationId')}:</strong> {result.encrypted_location_id}
          </div>
        )}
        
        {/* Location Lookup Result */}
        {result.lat !== undefined && result.lon !== undefined && (
          <>
            <div className="result-detail">
              <strong>{t('teeZone.latitude')}:</strong> {result.lat}
            </div>
            <div className="result-detail">
              <strong>{t('teeZone.longitude')}:</strong> {result.lon}
            </div>
            {result.timestamp && (
              <div className="result-detail">
                <strong>{t('teeZone.timestamp')}:</strong> {new Date(result.timestamp * 1000).toLocaleString()}
              </div>
            )}
          </>
        )}
        
        {/* Visit Analytics Result */}
        {result.visits_24h !== undefined && (
          <>
            <div className="result-detail">
              <strong>{t('teeZone.visits24h')}:</strong> {result.visits_24h}
            </div>
            <div className="result-detail">
              <strong>{t('teeZone.uniqueVisitors24h')}:</strong> {result.unique_visitors_24h}
            </div>
            <div className="result-detail">
              <strong>{t('teeZone.peakHour')}:</strong> {result.peak_hour}:00
            </div>
          </>
        )}
        
        {/* Heatmap Result */}
        {result.grid_cells && renderHeatmapVisualization()}
        
        {/* Raw JSON for debugging */}
        <details className="result-raw-json">
          <summary>{t('teeZone.rawResponse')}</summary>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </details>
      </div>
    );
  };

  // 渲染TEE供應商選擇介面
  const renderProviderSelection = () => (
    <div className="tee-provider-selection">
      <h3>{t('teeZone.selectProvider')}</h3>
      <div className="provider-options">
        <div 
          className={`provider-option ${selectedProvider === TEEProvider.MARLIN ? 'selected' : ''}`}
          onClick={() => setSelectedProvider(TEEProvider.MARLIN)}
        >
          <div className="provider-circle">
            <img 
              src="/assets/marlin-logo.svg" 
              alt="Marlin Oyster" 
              onError={(e) => {
                e.currentTarget.src = "https://marlin.org/assets/images/favicon.png";
                e.currentTarget.onerror = null;
              }}
            />
          </div>
          <div className="provider-label">Marlin Oyster</div>
          <div className="provider-status available">
            <span className="status-dot"></span>
            Available
          </div>
        </div>
        
        <div 
          className={`provider-option ${!enarxAvailable ? 'disabled' : ''} ${selectedProvider === TEEProvider.ENARX ? 'selected' : ''}`}
          onClick={() => enarxAvailable && setSelectedProvider(TEEProvider.ENARX)}
        >
          <div className="provider-circle">
            <img 
              src="/assets/enarx-logo.svg" 
              alt="Enarx" 
              onError={(e) => {
                e.currentTarget.src = "https://enarx.dev/favicon.png";
                e.currentTarget.onerror = null;
              }}
            />
          </div>
          <div className="provider-label">Enarx (Local)</div>
          <div className={`provider-status ${enarxAvailable ? 'available' : 'unavailable'}`}>
            <span className="status-dot"></span>
            {enarxAvailable ? 'Available' : 'Unavailable'}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="treasure-box-container">
      <div className="treasure-box-overlay" onClick={onClose}></div>
      
      <div className="treasure-box-content">
        <div className="treasure-box-header">
          <h2>{t('teeZone.title')}</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="treasure-box-body">
          {!selectedProvider ? (
            // 首先選擇TEE供應商
            renderProviderSelection()
          ) : !selectedFeature ? (
            // 然後選擇功能
            <div className="tee-features">
              <h3>{t('teeZone.selectFeature')}</h3>
              <div className="tee-feature-grid">
                <button
                  className="tee-feature-button"
                  onClick={() => setSelectedFeature(TEEFeature.LOCATION_REGISTRATION)}
                >
                  <span className="emoji">📍</span>
                  <span>{t('teeZone.locationRegistration')}</span>
                </button>
                <button
                  className="tee-feature-button"
                  onClick={() => setSelectedFeature(TEEFeature.LOCATION_LOOKUP)}
                >
                  <span className="emoji">🔍</span>
                  <span>{t('teeZone.locationLookup')}</span>
                </button>
                <button
                  className="tee-feature-button"
                  onClick={() => setSelectedFeature(TEEFeature.HEATMAP)}
                >
                  <span className="emoji">🔥</span>
                  <span>{t('teeZone.heatmap')}</span>
                </button>
                <button
                  className="tee-feature-button"
                  onClick={() => setSelectedFeature(TEEFeature.VISIT_ANALYTICS)}
                >
                  <span className="emoji">📊</span>
                  <span>{t('teeZone.visitAnalytics')}</span>
                </button>
              </div>
              <div className="provider-info">
                <p>
                  <span className="provider-label">
                    {selectedProvider === TEEProvider.MARLIN ? 'Marlin Oyster' : 'Enarx (Local)'}
                  </span>
                  <button className="change-provider-button" onClick={resetState}>
                    Change Provider
                  </button>
                </p>
                <p className="provider-endpoint">
                  API Endpoint: <code>{getApiEndpoint()}</code>
                </p>
              </div>
            </div>
          ) : (
            <div className="tee-form-container">
              <div className="form-header">
                <h3>
                  {t(`teeZone.${selectedFeature}Title`)}
                  <button className="back-button" onClick={resetState}>
                    ↩ {t('teeZone.back')}
                  </button>
                </h3>
                <div className="provider-indicator">
                  <span className="provider-label">
                    {selectedProvider === TEEProvider.MARLIN ? 'Marlin Oyster' : 'Enarx (Local)'}
                  </span>
                </div>
              </div>
              
              {selectedFeature === TEEFeature.LOCATION_REGISTRATION && renderRegistrationForm()}
              {selectedFeature === TEEFeature.LOCATION_LOOKUP && renderLookupForm()}
              {selectedFeature === TEEFeature.HEATMAP && renderHeatmapForm()}
              {selectedFeature === TEEFeature.VISIT_ANALYTICS && renderVisitAnalyticsForm()}
              
              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}
              
              {renderResult()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 