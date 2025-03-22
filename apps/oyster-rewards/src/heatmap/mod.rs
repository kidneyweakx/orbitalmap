use std::collections::HashMap;
use std::sync::Mutex;
use once_cell::sync::Lazy;
use rand::Rng;
use rand::rngs::ThreadRng;
use rand_distr::{Normal, Distribution};
use crate::models::{GridCell, HeatmapRequest, HeatmapResponse, HeatmapCell};
use crate::location::{LOCATION_HISTORY, GRID_SIZE};
use crate::crypto;

// In-memory cache for heatmap data
pub static HEATMAP_CACHE: Lazy<Mutex<HashMap<String, HeatmapResponse>>> = Lazy::new(|| Mutex::new(HashMap::new()));

// Generate a privacy-preserving heatmap
pub fn generate_heatmap(request: &HeatmapRequest) -> HeatmapResponse {
    let cache_key = format!("{}-{}-{}-{}-{}", 
        request.min_lat, request.max_lat, 
        request.min_lon, request.max_lon, 
        request.privacy_level);
    
    // Check if we have a cached result
    let cache = HEATMAP_CACHE.lock().unwrap();
    if let Some(cached_response) = cache.get(&cache_key) {
        return cached_response.clone();
    }
    drop(cache); // Release lock before expensive operation
    
    // Calculate grid boundaries
    let lat_cells = ((request.max_lat - request.min_lat) / GRID_SIZE).ceil() as usize;
    let lon_cells = ((request.max_lon - request.min_lon) / GRID_SIZE).ceil() as usize;
    
    // Initialize grid with zeros
    let mut grid: Vec<Vec<u32>> = vec![vec![0; lon_cells]; lat_cells];
    
    // Populate grid with real data
    let history = LOCATION_HISTORY.lock().unwrap();
    for (_, user_locations) in history.iter() {
        for encrypted_location in user_locations {
            // Try to decrypt the location
            if let Ok(location) = crypto::decrypt_location(encrypted_location) {
                // Check if it's in our request bounds
                if location.lat >= request.min_lat && location.lat <= request.max_lat &&
                   location.lon >= request.min_lon && location.lon <= request.max_lon {
                    
                    // Calculate grid position
                    let lat_idx = ((location.lat - request.min_lat) / GRID_SIZE).floor() as usize;
                    let lon_idx = ((location.lon - request.min_lon) / GRID_SIZE).floor() as usize;
                    
                    // Increment count for this cell
                    if lat_idx < lat_cells && lon_idx < lon_cells {
                        grid[lat_idx][lon_idx] += 1;
                    }
                }
            }
        }
    }
    
    // Apply differential privacy based on privacy level
    let dp_grid = apply_differential_privacy(&grid, request.privacy_level);
    
    // Convert to output format
    let cells = grid_to_heatmap_cells(&dp_grid, request.min_lat, request.min_lon);
    
    // Create response
    let response = HeatmapResponse {
        cells,
        privacy_level: request.privacy_level,
        min_lat: request.min_lat,
        max_lat: request.max_lat,
        min_lon: request.min_lon,
        max_lon: request.max_lon,
    };
    
    // Cache the result
    let mut cache = HEATMAP_CACHE.lock().unwrap();
    cache.insert(cache_key, response.clone());
    
    response
}

// Apply differential privacy to the grid
fn apply_differential_privacy(grid: &Vec<Vec<u32>>, privacy_level: f64) -> Vec<Vec<u32>> {
    let mut rng = rand::thread_rng();
    let mut dp_grid = grid.clone();
    
    // Scale noise based on privacy level (higher level = more privacy = more noise)
    let noise_scale = privacy_level * 2.0;
    
    // Create normal distribution
    let normal = Normal::new(0.0, noise_scale).unwrap();
    
    // Add noise to each cell
    for i in 0..dp_grid.len() {
        for j in 0..dp_grid[i].len() {
            // Add Gaussian noise scaled by privacy level
            let noise = normal.sample(&mut rng).round() as i32;
            let new_value = dp_grid[i][j] as i32 + noise;
            
            // Ensure we don't go below zero (cell counts can't be negative)
            dp_grid[i][j] = if new_value < 0 { 0 } else { new_value as u32 };
        }
    }
    
    dp_grid
}

// Convert grid to heatmap cells
fn grid_to_heatmap_cells(grid: &Vec<Vec<u32>>, min_lat: f64, min_lon: f64) -> Vec<HeatmapCell> {
    let mut cells = Vec::new();
    
    // Find the max value for normalization
    let mut max_value = 0;
    for row in grid {
        for &cell in row {
            if cell > max_value {
                max_value = cell;
            }
        }
    }
    
    // Convert grid cells to output format
    for (i, row) in grid.iter().enumerate() {
        for (j, &count) in row.iter().enumerate() {
            if count > 0 {
                // Calculate actual lat/lon coordinates for this cell
                let lat = min_lat + (i as f64 * GRID_SIZE);
                let lon = min_lon + (j as f64 * GRID_SIZE);
                
                // Normalize intensity between 0.0 and 1.0
                let intensity = if max_value > 0 {
                    count as f64 / max_value as f64
                } else {
                    0.0
                };
                
                cells.push(HeatmapCell {
                    lat,
                    lon,
                    intensity,
                    count,
                });
            }
        }
    }
    
    cells
}

// Generate synthetic data for testing or demonstration
pub fn generate_synthetic_heatmap(request: &HeatmapRequest) -> HeatmapResponse {
    let mut rng = rand::thread_rng();
    let mut cells = Vec::new();
    
    // Number of "hot spots" to generate
    let hotspot_count = 3 + (rng.gen::<f64>() * 5.0) as usize;
    
    // Generate hotspots
    let hotspots = generate_random_hotspots(
        &mut rng, 
        hotspot_count, 
        request.min_lat, request.max_lat,
        request.min_lon, request.max_lon
    );
    
    // Calculate grid boundaries
    let lat_cells = ((request.max_lat - request.min_lat) / GRID_SIZE).ceil() as usize;
    let lon_cells = ((request.max_lon - request.min_lon) / GRID_SIZE).ceil() as usize;
    
    // Generate grid cells influenced by hotspots
    for lat_idx in 0..lat_cells {
        for lon_idx in 0..lon_cells {
            let lat = request.min_lat + (lat_idx as f64 * GRID_SIZE);
            let lon = request.min_lon + (lon_idx as f64 * GRID_SIZE);
            
            // Calculate cell intensity based on distance to hotspots
            let intensity = calculate_intensity(&hotspots, lat, lon);
            
            // Only include cells with non-zero intensity
            if intensity > 0.05 {
                // Generate a synthetic count based on intensity
                let count = (intensity * 100.0).round() as u32;
                
                cells.push(HeatmapCell {
                    lat,
                    lon,
                    intensity,
                    count,
                });
            }
        }
    }
    
    HeatmapResponse {
        cells,
        privacy_level: request.privacy_level,
        min_lat: request.min_lat,
        max_lat: request.max_lat,
        min_lon: request.min_lon,
        max_lon: request.max_lon,
    }
}

// Helper struct for hotspot generation
struct Hotspot {
    lat: f64,
    lon: f64,
    strength: f64,
    radius: f64,
}

// Generate random hotspots within the map bounds
fn generate_random_hotspots(
    rng: &mut ThreadRng, 
    count: usize,
    min_lat: f64, max_lat: f64,
    min_lon: f64, max_lon: f64
) -> Vec<Hotspot> {
    let mut hotspots = Vec::with_capacity(count);
    
    for _ in 0..count {
        let lat = min_lat + rng.gen::<f64>() * (max_lat - min_lat);
        let lon = min_lon + rng.gen::<f64>() * (max_lon - min_lon);
        let strength = 0.5 + rng.gen::<f64>() * 0.5; // Between 0.5 and 1.0
        let radius = 0.005 + rng.gen::<f64>() * 0.02; // Between 0.005 and 0.025 degrees (roughly 500m to 2.5km)
        
        hotspots.push(Hotspot {
            lat, lon, strength, radius
        });
    }
    
    hotspots
}

// Calculate cell intensity based on distance to hotspots
fn calculate_intensity(hotspots: &[Hotspot], lat: f64, lon: f64) -> f64 {
    let mut max_intensity = 0.0;
    
    for hotspot in hotspots {
        // Calculate distance to hotspot (simple Euclidean distance is used here)
        let d_lat = lat - hotspot.lat;
        let d_lon = lon - hotspot.lon;
        let distance = (d_lat * d_lat + d_lon * d_lon).sqrt();
        
        // Intensity decreases with distance using a Gaussian falloff
        let intensity = hotspot.strength * (-distance * distance / (2.0 * hotspot.radius * hotspot.radius)).exp();
        
        // Take the maximum intensity from all hotspots
        if intensity > max_intensity {
            max_intensity = intensity;
        }
    }
    
    max_intensity
} 