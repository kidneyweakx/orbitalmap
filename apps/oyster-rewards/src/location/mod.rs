use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use once_cell::sync::Lazy;
use rand::Rng;
use crate::models::{Location, EncryptedLocation, Station, StationType, GridCell, LocationRegistrationResponse};
use crate::crypto;

// Grid size for heatmap (0.001 degrees is roughly 100m)
pub const GRID_SIZE: f64 = 0.001;

// In-memory storage for location data (in a real app, this would be persisted securely)
pub static LOCATION_HISTORY: Lazy<Mutex<HashMap<String, Vec<EncryptedLocation>>>> = Lazy::new(|| Mutex::new(HashMap::new()));

// Store nearby stations for location verification
pub static NEARBY_STATIONS: Lazy<Mutex<HashMap<GridCell, Vec<Station>>>> = Lazy::new(|| Mutex::new(HashMap::new()));

// Verify the legitimacy of a location based on sensor data
pub fn verify_location(location: &Location) -> bool {
    // Check for mock location flag from the device
    if location.sensors.is_mock_location {
        return false;
    }

    // Check for sensor presence (a real device should have these sensors)
    if location.sensors.accelerometer.is_none() || location.sensors.gyroscope.is_none() {
        return false;
    }

    // If we have previously observed WiFi networks or cell towers in this area,
    // check that at least some of them match
    let grid_cell = GridCell::from_location(location.lat, location.lon, GRID_SIZE);
    let stations = NEARBY_STATIONS.lock().unwrap();
    
    if let Some(expected_stations) = stations.get(&grid_cell) {
        if !expected_stations.is_empty() {
            // Count how many WiFi networks match
            let wifi_matches = location.sensors.wifi_networks.iter()
                .filter(|network| {
                    expected_stations.iter()
                        .filter(|station| station.station_type == StationType::Wifi)
                        .any(|station| station.id == network.bssid)
                })
                .count();
                
            // Count how many cell towers match
            let cell_matches = location.sensors.cell_towers.iter()
                .filter(|tower| {
                    expected_stations.iter()
                        .filter(|station| station.station_type == StationType::CellTower)
                        .any(|station| station.id == tower.cell_id)
                })
                .count();
                
            // If we have at least one match in either WiFi or cell towers, consider it verified
            if wifi_matches == 0 && cell_matches == 0 && !expected_stations.is_empty() {
                return false;
            }
        }
    }
    
    // Update our knowledge about nearby stations for future verifications
    let mut stations = NEARBY_STATIONS.lock().unwrap();
    let mut stations_in_cell = stations.entry(grid_cell).or_insert(Vec::new());
    
    // Add any WiFi networks we haven't seen before
    for network in &location.sensors.wifi_networks {
        if !stations_in_cell.iter().any(|s| s.id == network.bssid) {
            stations_in_cell.push(Station {
                id: network.bssid.clone(),
                lat: location.lat,
                lon: location.lon,
                station_type: StationType::Wifi,
                signal_strength: network.signal_strength,
            });
        }
    }
    
    // Add any cell towers we haven't seen before
    for tower in &location.sensors.cell_towers {
        if !stations_in_cell.iter().any(|s| s.id == tower.cell_id) {
            stations_in_cell.push(Station {
                id: tower.cell_id.clone(),
                lat: location.lat,
                lon: location.lon,
                station_type: StationType::CellTower,
                signal_strength: tower.signal_strength,
            });
        }
    }
    
    true
}

// Register a location
pub fn register_location(location: Location) -> LocationRegistrationResponse {
    // Verify the location first
    if !verify_location(&location) {
        return LocationRegistrationResponse {
            encrypted_location_id: String::new(),
            success: false,
            message: "Location verification failed. It appears to be a mock location.".to_string(),
        };
    }
    
    // Encrypt the location
    match crypto::encrypt_location(&location) {
        Ok(encrypted) => {
            // Store the encrypted location in our history
            let mut history = LOCATION_HISTORY.lock().unwrap();
            history.entry(location.user_id.clone())
                .or_insert(Vec::new())
                .push(encrypted.clone());
                
            // Return the encrypted location ID
            LocationRegistrationResponse {
                encrypted_location_id: encrypted.enc_data.clone(),
                success: true,
                message: "Location registered successfully.".to_string(),
            }
        },
        Err(err) => {
            LocationRegistrationResponse {
                encrypted_location_id: String::new(),
                success: false,
                message: format!("Failed to encrypt location: {}", err),
            }
        }
    }
}

// Get a location by its encrypted ID
pub fn get_location(encrypted_id: &str) -> Result<Location, String> {
    let history = LOCATION_HISTORY.lock().unwrap();
    
    // Search through all users
    for (_, locations) in history.iter() {
        // Search through all locations for this user
        for encrypted_loc in locations {
            if encrypted_loc.enc_data == encrypted_id {
                return crypto::decrypt_location(encrypted_loc);
            }
        }
    }
    
    Err("Location not found".to_string())
} 