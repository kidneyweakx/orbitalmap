use std::io::{self, BufRead, Write};
use std::process::exit;
use std::collections::{HashMap, HashSet};
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use chacha20poly1305::{ChaCha20Poly1305, Key, Nonce};
use chacha20poly1305::aead::Aead;
use chacha20poly1305::KeyInit;
use x25519_dalek::{EphemeralSecret, PublicKey};
use rand::rngs::OsRng;
use rand::Rng;
use sha2::{Sha256, Digest};
use base64::{Engine as _, engine::general_purpose};
use std::sync::Mutex;
use once_cell::sync::Lazy;

// TEE key pair (never leaves the TEE)
static PRIVATE_KEY_BYTES: Lazy<[u8; 32]> = Lazy::new(|| {
    let mut bytes = [0u8; 32];
    OsRng.fill(&mut bytes);
    bytes
});
static PRIVATE_KEY: Lazy<EphemeralSecret> = Lazy::new(|| {
    // 使用 OsRng 创建 EphemeralSecret (不能从已有字节创建)
    let secret = EphemeralSecret::random_from_rng(OsRng);
    secret
});
static PUBLIC_KEY: Lazy<PublicKey> = Lazy::new(|| PublicKey::from(&*PRIVATE_KEY));

// In-memory storage for location data (in a real app, this would be persisted securely)
static LOCATION_HISTORY: Lazy<Mutex<HashMap<String, Vec<EncryptedLocation>>>> = Lazy::new(|| Mutex::new(HashMap::new()));
static HEATMAP_DATA: Lazy<Mutex<HashMap<GridCell, u32>>> = Lazy::new(|| Mutex::new(HashMap::new()));
static LOCATION_VISITS: Lazy<Mutex<HashMap<GridCell, Vec<u64>>>> = Lazy::new(|| Mutex::new(HashMap::new()));
static NEARBY_STATIONS: Lazy<Mutex<HashMap<GridCell, Vec<Station>>>> = Lazy::new(|| Mutex::new(HashMap::new()));

// Grid size for heatmap (0.001 degrees is roughly 100m)
const GRID_SIZE: f64 = 0.001;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Location {
    lat: f64,
    lon: f64,
    timestamp: u64,
    user_id: String,
    device_id: String,
    sensors: SensorData,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct EncryptedLocation {
    enc_data: String,
    timestamp: u64,
    nonce: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct SensorData {
    wifi_networks: Vec<WifiNetwork>,
    cell_towers: Vec<CellTower>,
    accelerometer: Option<[f32; 3]>,
    gyroscope: Option<[f32; 3]>,
    is_mock_location: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct WifiNetwork {
    ssid: String,
    bssid: String,
    signal_strength: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct CellTower {
    cell_id: String,
    signal_strength: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Station {
    id: String,
    lat: f64,
    lon: f64,
    station_type: StationType,
    signal_strength: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
enum StationType {
    Wifi,
    CellTower,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, Hash)]
struct GridCell {
    lat_grid: i32,
    lon_grid: i32,
}

#[derive(Debug, Serialize, Deserialize)]
struct HeatmapResponse {
    grid_cells: Vec<HeatmapCell>,
    max_value: u32,
}

#[derive(Debug, Serialize, Deserialize)]
struct HeatmapCell {
    lat: f64,
    lon: f64,
    value: u32,
}

#[derive(Debug, Serialize, Deserialize)]
struct VisitAnalyticsResponse {
    location: Location,
    visits_24h: u32,
    unique_visitors_24h: u32,
    peak_hour: u32,
}

// Commands
#[derive(Debug, Serialize, Deserialize)]
enum Command {
    RegisterLocation(Location),
    GetLocation(String),
    GenerateHeatmap { min_lat: f64, min_lon: f64, max_lat: f64, max_lon: f64 },
    GetVisitAnalytics { lat: f64, lon: f64 },
    Help,
    Exit,
}

#[derive(Debug, Serialize, Deserialize)]
enum Response {
    LocationRegistered { enc_location: String, success: bool, message: String },
    LocationData { location: Option<Location>, success: bool, message: String },
    Heatmap(HeatmapResponse),
    VisitAnalytics(VisitAnalyticsResponse),
    Message { success: bool, message: String },
}

impl GridCell {
    fn from_location(lat: f64, lon: f64) -> Self {
        GridCell {
            lat_grid: (lat / GRID_SIZE).floor() as i32,
            lon_grid: (lon / GRID_SIZE).floor() as i32,
        }
    }

    fn to_coordinates(&self) -> (f64, f64) {
        (
            (self.lat_grid as f64) * GRID_SIZE + (GRID_SIZE / 2.0),
            (self.lon_grid as f64) * GRID_SIZE + (GRID_SIZE / 2.0),
        )
    }
}

// Get a derived key for encryption/decryption
fn get_derived_key() -> Key {
    let mut hasher = Sha256::new();
    // 为了保持一致性，我们仍然使用 PRIVATE_KEY_BYTES
    hasher.update(&*PRIVATE_KEY_BYTES);
    let hashed_key = hasher.finalize();
    *Key::from_slice(&hashed_key[0..32])
}

// Function to encrypt location data
fn encrypt_location(location: &Location) -> Result<EncryptedLocation, String> {
    // Generate a random nonce
    let mut rng = OsRng;
    let mut nonce_bytes = [0u8; 12];
    rng.fill(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Serialize location data
    let location_json = serde_json::to_string(location)
        .map_err(|e| format!("Serialization error: {}", e))?;

    // Get the derived key
    let key = get_derived_key();

    // Create cipher and encrypt
    let cipher = ChaCha20Poly1305::new(&key);
    let encrypted = cipher
        .encrypt(nonce, location_json.as_bytes())
        .map_err(|e| format!("Encryption error: {}", e))?;

    Ok(EncryptedLocation {
        enc_data: general_purpose::STANDARD.encode(encrypted),
        timestamp: location.timestamp,
        nonce: general_purpose::STANDARD.encode(nonce),
    })
}

// Function to decrypt location data
fn decrypt_location(encrypted: &EncryptedLocation) -> Result<Location, String> {
    // Get the same derived key
    let key = get_derived_key();

    // Decode base64 nonce and ciphertext
    let nonce_bytes = general_purpose::STANDARD.decode(&encrypted.nonce)
        .map_err(|e| format!("Nonce decoding error: {}", e))?;
    let ciphertext = general_purpose::STANDARD.decode(&encrypted.enc_data)
        .map_err(|e| format!("Ciphertext decoding error: {}", e))?;

    let nonce = Nonce::from_slice(&nonce_bytes);

    // Create cipher and decrypt
    let cipher = ChaCha20Poly1305::new(&key);
    let decrypted = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| format!("Decryption error: {}", e))?;

    // Deserialize back to Location
    let location: Location = serde_json::from_slice(&decrypted)
        .map_err(|e| format!("Deserialization error: {}", e))?;

    Ok(location)
}

// Verify the legitimacy of a location based on sensor data
fn verify_location(location: &Location) -> bool {
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
    let grid_cell = GridCell::from_location(location.lat, location.lon);
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
                
            // Require a minimum percentage of matches to consider it valid
            let total_expected = expected_stations.len();
            let total_matched = wifi_matches + cell_matches;
            
            if total_expected > 0 && (total_matched as f32 / total_expected as f32) < 0.3 {
                return false;
            }
        }
    }
    
    // Store observed stations for future verification
    let mut stations = NEARBY_STATIONS.lock().unwrap();
    let mut new_stations = Vec::new();
    
    // Add WiFi networks
    for network in &location.sensors.wifi_networks {
        new_stations.push(Station {
            id: network.bssid.clone(),
            lat: location.lat,
            lon: location.lon,
            station_type: StationType::Wifi,
            signal_strength: network.signal_strength,
        });
    }
    
    // Add cell towers
    for tower in &location.sensors.cell_towers {
        new_stations.push(Station {
            id: tower.cell_id.clone(),
            lat: location.lat,
            lon: location.lon,
            station_type: StationType::CellTower,
            signal_strength: tower.signal_strength,
        });
    }
    
    // Store the stations
    stations.insert(grid_cell, new_stations);
    
    true
}

// Register a new location
fn register_location(location: Location) -> Response {
    // First, verify the location is legitimate
    if !verify_location(&location) {
        return Response::LocationRegistered {
            enc_location: String::new(),
            success: false,
            message: "Location verification failed. Possible spoofing detected.".to_string(),
        };
    }

    // Encrypt the location
    match encrypt_location(&location) {
        Ok(encrypted) => {
            // Store in our in-memory database
            let mut locations = LOCATION_HISTORY.lock().unwrap();
            let user_locations = locations.entry(location.user_id.clone()).or_insert_with(Vec::new);
            user_locations.push(encrypted.clone());
            
            // Update heatmap data
            let grid_cell = GridCell::from_location(location.lat, location.lon);
            let mut heatmap = HEATMAP_DATA.lock().unwrap();
            *heatmap.entry(grid_cell.clone()).or_insert(0) += 1;
            
            // Update visit analytics
            let current_time = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
            
            let mut visits = LOCATION_VISITS.lock().unwrap();
            let cell_visits = visits.entry(grid_cell).or_insert_with(Vec::new);
            cell_visits.push(current_time);
            
            Response::LocationRegistered {
                enc_location: encrypted.enc_data,
                success: true,
                message: "Location registered successfully.".to_string(),
            }
        },
        Err(e) => {
            Response::LocationRegistered {
                enc_location: String::new(),
                success: false,
                message: format!("Encryption failed: {}", e),
            }
        }
    }
}

// Get a decrypted location (only used within the TEE)
fn get_location(encrypted_data: String) -> Response {
    // Find the encrypted location entry
    let locations = LOCATION_HISTORY.lock().unwrap();
    
    // Search through all users' locations
    let mut found_encrypted = None;
    for user_locations in locations.values() {
        for encrypted in user_locations {
            if encrypted.enc_data == encrypted_data {
                found_encrypted = Some(encrypted.clone());
                break;
            }
        }
        if found_encrypted.is_some() {
            break;
        }
    }
    
    // If found, decrypt it
    if let Some(encrypted) = found_encrypted {
        match decrypt_location(&encrypted) {
            Ok(location) => {
                Response::LocationData {
                    location: Some(location),
                    success: true,
                    message: "Location retrieved successfully.".to_string(),
                }
            },
            Err(e) => {
                Response::LocationData {
                    location: None,
                    success: false,
                    message: format!("Decryption failed: {}", e),
                }
            }
        }
    } else {
        Response::LocationData {
            location: None,
            success: false,
            message: "Location not found.".to_string(),
        }
    }
}

// Generate a heatmap for a specific area
fn generate_heatmap(min_lat: f64, min_lon: f64, max_lat: f64, max_lon: f64) -> Response {
    let min_lat_grid = (min_lat / GRID_SIZE).floor() as i32;
    let min_lon_grid = (min_lon / GRID_SIZE).floor() as i32;
    let max_lat_grid = (max_lat / GRID_SIZE).ceil() as i32;
    let max_lon_grid = (max_lon / GRID_SIZE).ceil() as i32;
    
    let heatmap = HEATMAP_DATA.lock().unwrap();
    let mut cells = Vec::new();
    let mut max_value = 0;
    
    for lat_grid in min_lat_grid..=max_lat_grid {
        for lon_grid in min_lon_grid..=max_lon_grid {
            let grid_cell = GridCell { lat_grid, lon_grid };
            if let Some(&value) = heatmap.get(&grid_cell) {
                let (lat, lon) = grid_cell.to_coordinates();
                cells.push(HeatmapCell { lat, lon, value });
                if value > max_value {
                    max_value = value;
                }
            }
        }
    }
    
    Response::Heatmap(HeatmapResponse {
        grid_cells: cells,
        max_value,
    })
}

// Get visit analytics for a specific location
fn get_visit_analytics(lat: f64, lon: f64) -> Response {
    let grid_cell = GridCell::from_location(lat, lon);
    let current_time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    // 24 hours in seconds
    let day_seconds = 24 * 60 * 60;
    let time_24h_ago = current_time.saturating_sub(day_seconds);
    
    let visits = LOCATION_VISITS.lock().unwrap();
    
    if let Some(timestamps) = visits.get(&grid_cell) {
        // Count visits in the last 24 hours
        let recent_visits: Vec<_> = timestamps
            .iter()
            .filter(|&&ts| ts >= time_24h_ago)
            .collect();
        
        let visits_24h = recent_visits.len() as u32;
        
        // Count unique visitors (use a simple hash of timestamp to simulate user IDs)
        let mut unique_visitors = HashSet::new();
        for &ts in &recent_visits {
            unique_visitors.insert(ts % 100); // This is a simplification for demo purposes
        }
        
        let unique_visitors_24h = unique_visitors.len() as u32;
        
        // Find peak hour
        let mut hour_counts = [0; 24];
        for &ts in &recent_visits {
            let seconds_since_day_start = (ts - time_24h_ago) % day_seconds;
            let hour = (seconds_since_day_start / 3600) as usize;
            if hour < 24 {
                hour_counts[hour] += 1;
            }
        }
        
        let mut peak_hour = 0;
        let mut max_count = 0;
        for (hour, &count) in hour_counts.iter().enumerate() {
            if count > max_count {
                max_count = count;
                peak_hour = hour as u32;
            }
        }
        
        // Create a dummy location object for the response
        let location = Location {
            lat,
            lon,
            timestamp: current_time,
            user_id: "ANONYMOUS".to_string(),
            device_id: "ANONYMOUS".to_string(),
            sensors: SensorData {
                wifi_networks: Vec::new(),
                cell_towers: Vec::new(),
                accelerometer: None,
                gyroscope: None,
                is_mock_location: false,
            },
        };
        
        Response::VisitAnalytics(VisitAnalyticsResponse {
            location,
            visits_24h,
            unique_visitors_24h,
            peak_hour,
        })
    } else {
        // Create a dummy location object for the response
        let location = Location {
            lat,
            lon,
            timestamp: current_time,
            user_id: "ANONYMOUS".to_string(),
            device_id: "ANONYMOUS".to_string(),
            sensors: SensorData {
                wifi_networks: Vec::new(),
                cell_towers: Vec::new(),
                accelerometer: None,
                gyroscope: None,
                is_mock_location: false,
            },
        };
        
        Response::VisitAnalytics(VisitAnalyticsResponse {
            location,
            visits_24h: 0,
            unique_visitors_24h: 0,
            peak_hour: 0,
        })
    }
}

// Print help information
fn print_help() -> Response {
    let help_message = r#"
TEE Location Services - Available Commands:

1. Register location:
   {"RegisterLocation": {"lat": 37.7749, "lon": -122.4194, "timestamp": 1617984000, "user_id": "user123", "device_id": "device456", "sensors": {...}}}

2. Get a specific location (by encrypted ID):
   {"GetLocation": "ENCRYPTED_LOCATION_ID"}

3. Generate heatmap for an area:
   {"GenerateHeatmap": {"min_lat": 37.7, "min_lon": -122.5, "max_lat": 37.8, "max_lon": -122.3}}

4. Get visit analytics for a location:
   {"GetVisitAnalytics": {"lat": 37.7749, "lon": -122.4194}}

5. Help:
   {"Help": null}

6. Exit:
   {"Exit": null}

All data processing happens securely within the TEE.
"#;

    Response::Message {
        success: true,
        message: help_message.to_string(),
    }
}

// Process a command
fn process_command(cmd_str: &str) -> Response {
    match serde_json::from_str::<Command>(cmd_str) {
        Ok(command) => {
            match command {
                Command::RegisterLocation(location) => {
                    register_location(location)
                },
                Command::GetLocation(encrypted_data) => {
                    get_location(encrypted_data)
                },
                Command::GenerateHeatmap { min_lat, min_lon, max_lat, max_lon } => {
                    generate_heatmap(min_lat, min_lon, max_lat, max_lon)
                },
                Command::GetVisitAnalytics { lat, lon } => {
                    get_visit_analytics(lat, lon)
                },
                Command::Help => {
                    print_help()
                },
                Command::Exit => {
                    println!("Exiting program");
                    exit(0);
                },
            }
        },
        Err(e) => {
            Response::Message {
                success: false,
                message: format!("Failed to parse command: {}. Try 'Help' for available commands.", e),
            }
        }
    }
}

fn main() {
    println!("TEE Location Services - Running in Trusted Execution Environment");
    println!("The public key for this TEE is: {}", general_purpose::STANDARD.encode(PUBLIC_KEY.as_bytes()));
    println!("Type a JSON command or 'Help' for available commands.");
    
    let stdin = io::stdin();
    let mut handle = stdin.lock();
    
    loop {
        print!("> ");
        io::stdout().flush().unwrap();
        
        let mut input = String::new();
        if handle.read_line(&mut input).is_err() {
            println!("Error reading input");
            continue;
        }
        
        let input = input.trim();
        
        // Simple handling for "Help" and "Exit" without requiring JSON
        if input.eq_ignore_ascii_case("help") {
            let response = print_help();
            println!("{}", serde_json::to_string_pretty(&response).unwrap());
            continue;
        } else if input.eq_ignore_ascii_case("exit") || input.eq_ignore_ascii_case("quit") {
            println!("Exiting program");
            exit(0);
        }
        
        // Process the command and print the response
        let response = process_command(input);
        match serde_json::to_string_pretty(&response) {
            Ok(json) => println!("{}", json),
            Err(e) => println!("Error serializing response: {}", e),
        }
    }
}