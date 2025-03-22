use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// Location Structs
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Location {
    pub lat: f64,
    pub lon: f64,
    pub timestamp: String,
    pub user_id: String,
    pub device_id: String,
    pub sensors: SensorData,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EncryptedLocation {
    pub enc_data: String,
    pub timestamp: String,
    pub nonce: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SensorData {
    pub wifi_networks: Vec<WifiNetwork>,
    pub cell_towers: Vec<CellTower>,
    pub accelerometer: Option<Vec<f64>>,
    pub gyroscope: Option<Vec<f64>>,
    pub is_mock_location: bool,
    pub additional_data: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WifiNetwork {
    pub ssid: String,
    pub bssid: String,
    pub signal_strength: i32,
    pub frequency: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CellTower {
    pub cell_id: String,
    pub signal_strength: i32,
    pub mcc: u32,
    pub mnc: u32,
    pub lac: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Station {
    pub id: String,
    pub lat: f64,
    pub lon: f64,
    pub station_type: StationType,
    pub signal_strength: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum StationType {
    Wifi,
    CellTower,
}

// Grid Cell for Heatmap
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, Hash)]
pub struct GridCell {
    pub lat_grid: i32,
    pub lon_grid: i32,
}

// API Models
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HeatmapResponse {
    pub cells: Vec<HeatmapCell>,
    pub privacy_level: f64,
    pub min_lat: f64,
    pub max_lat: f64,
    pub min_lon: f64,
    pub max_lon: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HeatmapCell {
    pub lat: f64,
    pub lon: f64,
    pub intensity: f64,
    pub count: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VisitAnalyticsResponse {
    pub visits: Vec<LocationVisit>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocationVisit {
    pub lat: f64,
    pub lon: f64,
    pub arrival_time: String,
    pub departure_time: String,
    pub duration_seconds: i64,
    pub point_count: u32,
}

// Request Models
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocationRegistrationRequest {
    pub lat: f64,
    pub lon: f64,
    pub user_id: String,
    pub device_id: String,
    pub wifi_networks: Vec<WifiNetwork>,
    pub cell_towers: Vec<CellTower>,
    pub accelerometer: Option<Vec<f64>>,
    pub gyroscope: Option<Vec<f64>>,
    pub is_mock_location: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocationLookupRequest {
    pub encrypted_location_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HeatmapRequest {
    pub min_lat: f64,
    pub min_lon: f64,
    pub max_lat: f64,
    pub max_lon: f64,
    pub privacy_level: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VisitAnalyticsRequest {
    pub user_id: String,
    pub start_time: String,
    pub end_time: String,
}

// Response Models
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocationRegistrationResponse {
    pub encrypted_location_id: String,
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocationResponse {
    pub lat: Option<f64>,
    pub lon: Option<f64>,
    pub timestamp: Option<String>,
    pub success: bool,
    pub message: String,
}

// General response for errors
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApiResponse {
    pub success: bool,
    pub message: String,
}

// Grid Cell implementation
impl GridCell {
    pub fn from_location(lat: f64, lon: f64, grid_size: f64) -> Self {
        GridCell {
            lat_grid: (lat / grid_size).floor() as i32,
            lon_grid: (lon / grid_size).floor() as i32,
        }
    }

    pub fn to_coordinates(&self, grid_size: f64) -> (f64, f64) {
        (
            (self.lat_grid as f64) * grid_size + (grid_size / 2.0),
            (self.lon_grid as f64) * grid_size + (grid_size / 2.0),
        )
    }
} 