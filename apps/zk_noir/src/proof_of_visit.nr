use dep::std;

// Proof of Visit - proves a user has visited a location without revealing exact GPS coordinates
// We use a hash of location and a timestamp to verify the visit happened within a time range

// Input parameters:
// - location_hash: hash of the actual location (precomputed)
// - user_location_hash: user's claimed location hash
// - visit_timestamp: when the user visited (in seconds)
// - current_timestamp: current time (in seconds) 
// - max_time_diff: maximum allowed time difference (in seconds, e.g., 24 hours = 86400)

fn prove_visit(
    location_hash: Field,
    user_location_hash: Field, 
    visit_timestamp: Field,
    current_timestamp: Field,
    max_time_diff: Field
) {
    // Verify the user visited the correct location
    assert(location_hash == user_location_hash);
    
    // Verify the visit happened within the acceptable time window
    let time_diff = current_timestamp - visit_timestamp;
    assert((time_diff as i64) >= 0);
    assert((time_diff as i64) <= (max_time_diff as i64));
}

// Helper function to generate a location hash from GPS coordinates
fn hash_location(latitude: Field, longitude: Field) -> Field {
    // Create a hash from latitude and longitude
    // This keeps the exact coordinates private
    let hash_input = [latitude, longitude];
    std::hash::hash_to_field(hash_input)
}

#[test]
fn test_proof_of_visit() {
    // Test scenario
    let actual_latitude = 37_123456; // 37.123456
    let actual_longitude = -122_987654; // -122.987654
    
    // Location hash (would be provided by the application)
    let location_hash = hash_location(actual_latitude, actual_longitude);
    
    // User's location (same in this test case)
    let user_location_hash = hash_location(actual_latitude, actual_longitude);
    
    // Timestamps
    let visit_time = 1649700000; // Some timestamp
    let current_time = 1649750000; // 50000 seconds later (about 14 hours)
    let max_allowed_diff = 86400; // 24 hours
    
    // This should pass
    prove_visit(location_hash, user_location_hash, visit_time, current_time, max_allowed_diff);
    
    // Uncomment to test failure cases:
    // Wrong location
    // let wrong_location_hash = hash_location(37_111111, -122_222222);
    // prove_visit(location_hash, wrong_location_hash, visit_time, current_time, max_allowed_diff);
    
    // Time too long ago
    // let old_visit_time = 1649600000; // Too old
    // prove_visit(location_hash, user_location_hash, old_visit_time, current_time, max_allowed_diff);
} 