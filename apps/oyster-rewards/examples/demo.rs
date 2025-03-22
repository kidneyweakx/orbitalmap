use oyster_rewards::{
    Location, SensorData, WifiNetwork, CellTower,
    register_location, get_location, generate_heatmap, generate_visit_analytics,
    HeatmapRequest, VisitAnalyticsRequest
};
use std::collections::HashMap;
use chrono::Utc;

fn main() {
    println!("Oyster Rewards Demo");
    println!("===================\n");
    
    // Generate some sample locations
    let locations = generate_sample_locations();
    println!("Generated {} sample locations", locations.len());
    
    // Register locations
    let mut encrypted_ids = Vec::with_capacity(locations.len());
    for location in &locations {
        let result = register_location(location.clone());
        if result.success {
            encrypted_ids.push(result.encrypted_location_id);
            println!("Registered location: {:.6}, {:.6}", location.lat, location.lon);
        } else {
            println!("Failed to register location: {}", result.message);
        }
    }
    
    // Retrieve a random location
    println!("\nRetrieving location data:");
    if !encrypted_ids.is_empty() {
        let random_index = rand::random::<usize>() % encrypted_ids.len();
        let encrypted_id = &encrypted_ids[random_index];
        
        match get_location(encrypted_id) {
            Ok(location) => {
                println!("Retrieved location successfully:");
                println!("  Latitude: {:.6}", location.lat);
                println!("  Longitude: {:.6}", location.lon);
                println!("  Timestamp: {}", location.timestamp);
                println!("  User ID: {}", location.user_id);
            },
            Err(err) => {
                println!("Error retrieving location: {}", err);
            }
        }
    }
    
    // Generate a heatmap of the locations
    println!("\nGenerating heatmap:");
    let heatmap_request = HeatmapRequest {
        min_lat: 37.75,
        max_lat: 37.8,
        min_lon: -122.45,
        max_lon: -122.4,
        privacy_level: 1.5,
    };
    
    let heatmap = generate_heatmap(&heatmap_request);
    println!("Generated heatmap with {} cells", heatmap.cells.len());
    println!("Top 5 heatmap cells by intensity:");
    
    // Sort cells by intensity
    let mut cells = heatmap.cells;
    cells.sort_by(|a, b| b.intensity.partial_cmp(&a.intensity).unwrap());
    
    // Display top cells
    for (i, cell) in cells.iter().take(5).enumerate() {
        println!("  {}. Lat: {:.6}, Lon: {:.6}, Intensity: {:.2}, Count: {}",
            i + 1, cell.lat, cell.lon, cell.intensity, cell.count);
    }
    
    // Generate visit analytics
    println!("\nGenerating visit analytics:");
    let analytics_request = VisitAnalyticsRequest {
        user_id: "user123".to_string(),
        start_time: "2023-01-01T00:00:00Z".to_string(),
        end_time: "2023-12-31T23:59:59Z".to_string(),
    };
    
    let analytics = generate_visit_analytics(&analytics_request);
    println!("Found {} significant visits", analytics.visits.len());
    
    // Display visits
    for (i, visit) in analytics.visits.iter().enumerate() {
        println!("  Visit {}:", i + 1);
        println!("    Location: {:.6}, {:.6}", visit.lat, visit.lon);
        println!("    Arrival: {}", visit.arrival_time);
        println!("    Departure: {}", visit.departure_time);
        println!("    Duration: {} minutes", visit.duration_seconds / 60);
    }
}

// Generate sample locations in San Francisco
fn generate_sample_locations() -> Vec<Location> {
    let mut locations = Vec::new();
    let user_id = "user123".to_string();
    let device_id = "device456".to_string();
    
    // Home location - morning
    add_location_cluster(
        &mut locations,
        37.762, -122.435, // Home coordinates
        6, // 6 points
        "07:00:00", // Starting at 7am
        600, // 10 minutes apart
        &user_id,
        &device_id,
    );
    
    // Work location - day
    add_location_cluster(
        &mut locations,
        37.789, -122.401, // Work coordinates
        8, // 8 points
        "09:30:00", // Starting at 9:30am
        1800, // 30 minutes apart
        &user_id,
        &device_id,
    );
    
    // Lunch location
    add_location_cluster(
        &mut locations,
        37.792, -122.406, // Lunch spot
        3, // 3 points
        "12:30:00", // Starting at 12:30pm
        600, // 10 minutes apart
        &user_id,
        &device_id,
    );
    
    // Back to work
    add_location_cluster(
        &mut locations,
        37.789, -122.401, // Work coordinates
        6, // 6 points
        "14:00:00", // Starting at 2pm
        1800, // 30 minutes apart
        &user_id,
        &device_id,
    );
    
    // Evening activity
    add_location_cluster(
        &mut locations,
        37.777, -122.419, // Evening location
        4, // 4 points
        "18:30:00", // Starting at 6:30pm
        1200, // 20 minutes apart
        &user_id,
        &device_id,
    );
    
    // Home in the evening
    add_location_cluster(
        &mut locations,
        37.762, -122.435, // Home coordinates
        5, // 5 points
        "20:30:00", // Starting at 8:30pm
        1200, // 20 minutes apart
        &user_id,
        &device_id,
    );
    
    // Sort by timestamp
    locations.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));
    
    locations
}

// Helper to add a cluster of locations
fn add_location_cluster(
    locations: &mut Vec<Location>,
    base_lat: f64,
    base_lon: f64,
    count: usize,
    start_time: &str,
    seconds_between: u64,
    user_id: &str,
    device_id: &str,
) {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    
    // Parse base time
    let base_time = chrono::NaiveTime::parse_from_str(start_time, "%H:%M:%S").unwrap();
    let today = Utc::now().date_naive();
    let base_datetime = chrono::NaiveDateTime::new(today, base_time);
    
    for i in 0..count {
        // Add some random variation to location
        let lat_jitter = (rng.gen::<f64>() - 0.5) * 0.001; // ~100m jitter
        let lon_jitter = (rng.gen::<f64>() - 0.5) * 0.001;
        
        // Calculate timestamp
        let seconds_offset = i as u64 * seconds_between;
        let timestamp = base_datetime + chrono::Duration::seconds(seconds_offset as i64);
        let timestamp_str = timestamp.and_utc().to_rfc3339();
        
        // Generate some fake WiFi networks
        let wifi_count = 2 + (rng.gen::<f64>() * 3.0) as usize;
        let mut wifi_networks = Vec::with_capacity(wifi_count);
        
        for j in 0..wifi_count {
            // Generate bssid like 00:11:22:33:44:55
            let bssid = format!("{:02X}:{:02X}:{:02X}:{:02X}:{:02X}:{:02X}",
                rng.gen::<u8>(), rng.gen::<u8>(), rng.gen::<u8>(),
                rng.gen::<u8>(), rng.gen::<u8>(), rng.gen::<u8>());
                
            wifi_networks.push(WifiNetwork {
                bssid,
                ssid: format!("WiFi-{}", j),
                signal_strength: -50 - (rng.gen::<f64>() * 40.0) as i32,
                frequency: 2400 + (rng.gen::<u32>() % 500),
            });
        }
        
        // Generate some fake cell towers
        let cell_count = 1 + (rng.gen::<f64>() * 2.0) as usize;
        let mut cell_towers = Vec::with_capacity(cell_count);
        
        for j in 0..cell_count {
            cell_towers.push(CellTower {
                cell_id: format!("CELL-{}-{}", i, j),
                signal_strength: -70 - (rng.gen::<f64>() * 40.0) as i32,
                mcc: 310, // USA
                mnc: 410 + (j as u32),
                lac: 10000 + (rng.gen::<u32>() % 5000),
            });
        }
        
        // Create sensor data
        let sensor_data = SensorData {
            wifi_networks,
            cell_towers,
            accelerometer: Some(vec![rng.gen::<f64>() * 2.0 - 1.0, 
                                    rng.gen::<f64>() * 2.0 - 1.0, 
                                    9.8 + rng.gen::<f64>() * 0.4 - 0.2]),
            gyroscope: Some(vec![rng.gen::<f64>() * 0.2 - 0.1,
                               rng.gen::<f64>() * 0.2 - 0.1,
                               rng.gen::<f64>() * 0.2 - 0.1]),
            is_mock_location: false,
            additional_data: HashMap::new(),
        };
        
        // Create complete location
        locations.push(Location {
            lat: base_lat + lat_jitter,
            lon: base_lon + lon_jitter,
            timestamp: timestamp_str,
            user_id: user_id.to_string(),
            device_id: device_id.to_string(),
            sensors: sensor_data,
        });
    }
} 