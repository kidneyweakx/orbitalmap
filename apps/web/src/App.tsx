import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useTranslation } from 'react-i18next'
import { MapMenu } from './components/MapMenu'
import { Navbar } from './components/Navbar'
import './App.css'

function App() {
  const { t, i18n } = useTranslation()
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [showLocationModal, setShowLocationModal] = useState(true)
  
  // Debug i18n
  useEffect(() => {
    console.log('Current language:', i18n.language);
    console.log('Available languages:', i18n.languages);
    console.log('Translation test:', t('locationModal.title'));
  }, [i18n, t]);
  
  // Japan coordinates (Tokyo)
  const defaultCenter: [number, number] = [139.6503, 35.6762]

  const initializeMap = (center: [number, number]) => {
    if (!mapContainer.current) return

    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: center,
      zoom: 9
    })
  }

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation: [number, number] = [position.coords.longitude, position.coords.latitude]
          initializeMap(userLocation)
          setShowLocationModal(false)
        },
        (error) => {
          console.error('Error getting location:', error)
          initializeMap(defaultCenter)
          setShowLocationModal(false)
        }
      )
    } else {
      console.error('Geolocation is not supported by this browser.')
      initializeMap(defaultCenter)
      setShowLocationModal(false)
    }
  }

  const handleUseDefaultLocation = () => {
    initializeMap(defaultCenter)
    setShowLocationModal(false)
  }

  useEffect(() => {
    // Map will be initialized after user chooses location option
    return () => {
      map.current?.remove()
    }
  }, [])

  return (
    <div className="app-container">
      <Navbar />
      <div ref={mapContainer} className="map-container" />
      {!showLocationModal && <MapMenu map={map.current} />}
      
      {showLocationModal && (
        <div className="location-modal-overlay">
          <div className="location-modal">
            <h2>{t('locationModal.title')}</h2>
            <p>{t('locationModal.prompt')}</p>
            <div className="location-buttons">
              <button onClick={handleUseCurrentLocation}>
                {t('locationModal.useCurrentLocation')}
              </button>
              <button onClick={handleUseDefaultLocation}>
                {t('locationModal.useDefaultLocation')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
