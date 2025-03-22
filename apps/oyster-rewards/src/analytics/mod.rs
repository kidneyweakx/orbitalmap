use std::collections::{HashMap, HashSet};
use chrono::{DateTime, Duration, Utc, NaiveDateTime, Timelike};
use crate::models::{Location, EncryptedLocation, VisitAnalyticsRequest, VisitAnalyticsResponse, LocationVisit};
use crate::location::LOCATION_HISTORY;
use crate::crypto;

// Minimum time in seconds that defines a "stay" at a location
const MIN_STAY_DURATION_SECONDS: i64 = 300; // 5 minutes

// Maximum distance in degrees that counts as the "same" location
const SAME_LOCATION_THRESHOLD: f64 = 0.0003; // ~30 meters

// Generate analytics for user visits
pub fn generate_visit_analytics(request: &VisitAnalyticsRequest) -> VisitAnalyticsResponse {
    let user_id = &request.user_id;
    
    // Extract time range from request
    let start_time = match DateTime::parse_from_rfc3339(&request.start_time) {
        Ok(time) => time.with_timezone(&Utc),
        Err(_) => {
            return VisitAnalyticsResponse {
                visits: Vec::new(),
                error: Some("Invalid start time format".to_string()),
            };
        }
    };
    
    let end_time = match DateTime::parse_from_rfc3339(&request.end_time) {
        Ok(time) => time.with_timezone(&Utc),
        Err(_) => {
            return VisitAnalyticsResponse {
                visits: Vec::new(),
                error: Some("Invalid end time format".to_string()),
            };
        }
    };
    
    // Get user location history
    let history_lock = LOCATION_HISTORY.lock().unwrap();
    let user_history = match history_lock.get(user_id) {
        Some(history) => history,
        None => {
            return VisitAnalyticsResponse {
                visits: Vec::new(),
                error: None, // No error, just no data for this user
            };
        }
    };
    
    // Decrypt and filter locations within time range
    let mut locations: Vec<Location> = Vec::new();
    for encrypted_location in user_history {
        if let Ok(location) = crypto::decrypt_location(encrypted_location) {
            // Parse timestamp
            if let Ok(timestamp) = DateTime::parse_from_rfc3339(&location.timestamp) {
                let utc_timestamp = timestamp.with_timezone(&Utc);
                
                // Filter by time range
                if utc_timestamp >= start_time && utc_timestamp <= end_time {
                    locations.push(location);
                }
            }
        }
    }
    
    // Sort locations by timestamp
    locations.sort_by(|a, b| {
        let a_time = DateTime::parse_from_rfc3339(&a.timestamp).unwrap();
        let b_time = DateTime::parse_from_rfc3339(&b.timestamp).unwrap();
        a_time.cmp(&b_time)
    });
    
    // Extract significant stays (visits)
    let visits = detect_visits(&locations);
    
    VisitAnalyticsResponse {
        visits,
        error: None,
    }
}

// Detect significant visits from a chronological sequence of locations
fn detect_visits(locations: &[Location]) -> Vec<LocationVisit> {
    if locations.is_empty() {
        return Vec::new();
    }
    
    let mut visits = Vec::new();
    let mut current_cluster: Vec<&Location> = vec![&locations[0]];
    
    for i in 1..locations.len() {
        let current_loc = &locations[i];
        let previous_loc = current_cluster.last().unwrap();
        
        // Calculate distance between current and previous location
        let distance = calculate_distance(
            current_loc.lat, current_loc.lon,
            previous_loc.lat, previous_loc.lon
        );
        
        if distance <= SAME_LOCATION_THRESHOLD {
            // Same location cluster, add to current cluster
            current_cluster.push(current_loc);
        } else {
            // New location, process the previous cluster if it was significant
            process_cluster(&current_cluster, &mut visits);
            
            // Start new cluster
            current_cluster = vec![current_loc];
        }
    }
    
    // Process the final cluster
    process_cluster(&current_cluster, &mut visits);
    
    visits
}

// Process a cluster of locations to determine if it's a significant visit
fn process_cluster(cluster: &[&Location], visits: &mut Vec<LocationVisit>) {
    if cluster.len() < 2 {
        return; // Need at least 2 points to determine a stay
    }
    
    // Get first and last timestamp in cluster
    let first_time = DateTime::parse_from_rfc3339(&cluster[0].timestamp).unwrap();
    let last_time = DateTime::parse_from_rfc3339(&cluster.last().unwrap().timestamp).unwrap();
    
    // Calculate duration
    let duration = (last_time - first_time).num_seconds();
    
    // If stayed for minimum required time, consider it a visit
    if duration >= MIN_STAY_DURATION_SECONDS {
        // Calculate average location (center of cluster)
        let mut lat_sum = 0.0;
        let mut lon_sum = 0.0;
        
        for loc in cluster {
            lat_sum += loc.lat;
            lon_sum += loc.lon;
        }
        
        let avg_lat = lat_sum / cluster.len() as f64;
        let avg_lon = lon_sum / cluster.len() as f64;
        
        // Format times for display
        let arrival_time = first_time.to_rfc3339();
        let departure_time = last_time.to_rfc3339();
        
        visits.push(LocationVisit {
            lat: avg_lat,
            lon: avg_lon,
            arrival_time,
            departure_time,
            duration_seconds: duration,
            point_count: cluster.len() as u32,
        });
    }
}

// Calculate distance between two points (simple approximation using Euclidean distance)
fn calculate_distance(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    let dlat = lat2 - lat1;
    let dlon = lon2 - lon1;
    (dlat * dlat + dlon * dlon).sqrt()
}

// Get daily summary of user activity
pub fn generate_daily_summary(user_id: &str, date_str: &str) -> HashMap<String, usize> {
    let mut summary = HashMap::new();
    
    // Parse date
    let date = match NaiveDateTime::parse_from_str(&format!("{} 00:00:00", date_str), "%Y-%m-%d %H:%M:%S") {
        Ok(date) => date,
        Err(_) => {
            summary.insert("error".to_string(), 1);
            return summary;
        }
    };
    
    // Calculate start and end of day in UTC
    let start_of_day = DateTime::<Utc>::from_utc(date, Utc);
    let end_of_day = start_of_day + Duration::days(1);
    
    // Count locations by hour
    let hourly_counts = count_locations_by_hour(user_id, start_of_day, end_of_day);
    
    // Add hourly counts to summary
    for (hour, count) in hourly_counts {
        summary.insert(format!("hour_{}", hour), count);
    }
    
    // Count unique places visited
    let unique_places = count_unique_places(user_id, start_of_day, end_of_day);
    summary.insert("unique_places".to_string(), unique_places);
    
    // Count total distance traveled
    let total_distance = calculate_total_distance(user_id, start_of_day, end_of_day);
    summary.insert("distance_traveled".to_string(), total_distance.round() as usize);
    
    summary
}

// Count locations by hour of day
fn count_locations_by_hour(user_id: &str, start_time: DateTime<Utc>, end_time: DateTime<Utc>) -> HashMap<u32, usize> {
    let mut hourly_counts = HashMap::new();
    
    // Initialize all hours to zero
    for hour in 0..24 {
        hourly_counts.insert(hour, 0);
    }
    
    // Get user location history
    let history_lock = LOCATION_HISTORY.lock().unwrap();
    if let Some(user_history) = history_lock.get(user_id) {
        for encrypted_location in user_history {
            if let Ok(location) = crypto::decrypt_location(encrypted_location) {
                // Parse timestamp
                if let Ok(timestamp) = DateTime::parse_from_rfc3339(&location.timestamp) {
                    let utc_timestamp = timestamp.with_timezone(&Utc);
                    
                    // Check if in time range
                    if utc_timestamp >= start_time && utc_timestamp < end_time {
                        // Get hour and increment count
                        let hour = utc_timestamp.hour();
                        *hourly_counts.entry(hour).or_insert(0) += 1;
                    }
                }
            }
        }
    }
    
    hourly_counts
}

// Count unique places visited (based on grid cells)
fn count_unique_places(user_id: &str, start_time: DateTime<Utc>, end_time: DateTime<Utc>) -> usize {
    let mut unique_places = HashSet::new();
    
    // Get user location history
    let history_lock = LOCATION_HISTORY.lock().unwrap();
    if let Some(user_history) = history_lock.get(user_id) {
        for encrypted_location in user_history {
            if let Ok(location) = crypto::decrypt_location(encrypted_location) {
                // Parse timestamp
                if let Ok(timestamp) = DateTime::parse_from_rfc3339(&location.timestamp) {
                    let utc_timestamp = timestamp.with_timezone(&Utc);
                    
                    // Check if in time range
                    if utc_timestamp >= start_time && utc_timestamp < end_time {
                        // Round coordinates to create grid cells (roughly 100m)
                        let lat_key = ((location.lat * 1000.0).round() / 1000.0 * 1000.0) as i32;
                        let lon_key = ((location.lon * 1000.0).round() / 1000.0 * 1000.0) as i32;
                        unique_places.insert((lat_key, lon_key));
                    }
                }
            }
        }
    }
    
    unique_places.len()
}

// Calculate total distance traveled
fn calculate_total_distance(user_id: &str, start_time: DateTime<Utc>, end_time: DateTime<Utc>) -> f64 {
    let mut total_distance = 0.0;
    let mut last_lat = None;
    let mut last_lon = None;
    
    // Get user location history
    let history_lock = LOCATION_HISTORY.lock().unwrap();
    if let Some(user_history) = history_lock.get(user_id) {
        // Collect and sort locations by timestamp
        let mut locations: Vec<Location> = Vec::new();
        for encrypted_location in user_history {
            if let Ok(location) = crypto::decrypt_location(encrypted_location) {
                // Parse timestamp
                if let Ok(timestamp) = DateTime::parse_from_rfc3339(&location.timestamp) {
                    let utc_timestamp = timestamp.with_timezone(&Utc);
                    
                    // Check if in time range
                    if utc_timestamp >= start_time && utc_timestamp < end_time {
                        locations.push(location);
                    }
                }
            }
        }
        
        // Sort locations by timestamp
        locations.sort_by(|a, b| {
            let a_time = DateTime::parse_from_rfc3339(&a.timestamp).unwrap();
            let b_time = DateTime::parse_from_rfc3339(&b.timestamp).unwrap();
            a_time.cmp(&b_time)
        });
        
        // Calculate distances between consecutive points
        for location in locations {
            if let (Some(prev_lat), Some(prev_lon)) = (last_lat, last_lon) {
                // Calculate distance
                let distance = calculate_distance(prev_lat, prev_lon, location.lat, location.lon);
                
                // Convert to meters (approximately) and add to total
                // 1 degree of latitude is roughly 111km
                total_distance += distance * 111000.0;
            }
            
            last_lat = Some(location.lat);
            last_lon = Some(location.lon);
        }
    }
    
    total_distance
} 