use dep::std;
use jwt::JWT;
use crate::local_explorer_badge::{MAX_DATA_LENGTH, MAX_VISITED_PLACES_KEY_LENGTH, prove_local_explorer_badge, prove_explorer_badge_tier, verify_jwt_not_expired};

// Local Explorer badge tiers
struct ExplorerBadgeTier {
    id: Field,
    name: str<20>,
    min_visits: u64,
    max_visits: u64,
    reward_points: u64
}

// Example: How to unlock different rewards using different badge tiers
fn unlock_explorer_rewards(
    data: BoundedVec<u8, MAX_DATA_LENGTH>,
    base64_decode_offset: u32,
    pubkey_modulus_limbs: [Field; 18],
    redc_params_limbs: [Field; 18],
    signature_limbs: [Field; 18],
    requested_tier_id: Field,
    current_timestamp: u64
) -> u64 {
    // Badge tier definitions
    let bronze_explorer = ExplorerBadgeTier {
        id: 1,
        name: "Bronze Explorer",
        min_visits: 10,
        max_visits: 24,
        reward_points: 100
    };
    
    let silver_explorer = ExplorerBadgeTier {
        id: 2,
        name: "Silver Explorer",
        min_visits: 25,
        max_visits: 49,
        reward_points: 250
    };
    
    let gold_explorer = ExplorerBadgeTier {
        id: 3,
        name: "Gold Explorer",
        min_visits: 50,
        max_visits: 99,
        reward_points: 500
    };
    
    let platinum_explorer = ExplorerBadgeTier {
        id: 4,
        name: "Platinum Explorer",
        min_visits: 100,
        max_visits: 1000000, // No actual upper limit
        reward_points: 1000
    };
    
    // Verify that JWT is not expired
    let is_valid = verify_jwt_not_expired(
        data, 
        base64_decode_offset,
        pubkey_modulus_limbs,
        redc_params_limbs,
        signature_limbs,
        current_timestamp
    );
    assert(is_valid);
    
    // Initialize JWT to read visited_places
    let jwt = JWT::init(
        data,
        base64_decode_offset,
        pubkey_modulus_limbs,
        redc_params_limbs,
        signature_limbs
    );
    
    // Verify JWT signature
    jwt.verify();
    
    // Get "visited_places" value
    let visited_places_key = "visited_places".as_bytes();
    let visited_places = jwt.get_claim_number(visited_places_key);
    
    // Unlock corresponding rewards based on requested badge ID and visit count
    let mut reward_points = 0;
    
    if requested_tier_id == bronze_explorer.id {
        assert(visited_places >= bronze_explorer.min_visits);
        assert(visited_places <= bronze_explorer.max_visits);
        reward_points = bronze_explorer.reward_points;
    } else if requested_tier_id == silver_explorer.id {
        assert(visited_places >= silver_explorer.min_visits);
        assert(visited_places <= silver_explorer.max_visits);
        reward_points = silver_explorer.reward_points;
    } else if requested_tier_id == gold_explorer.id {
        assert(visited_places >= gold_explorer.min_visits);
        assert(visited_places <= gold_explorer.max_visits);
        reward_points = gold_explorer.reward_points;
    } else if requested_tier_id == platinum_explorer.id {
        assert(visited_places >= platinum_explorer.min_visits);
        assert(visited_places <= platinum_explorer.max_visits);
        reward_points = platinum_explorer.reward_points;
    } else {
        assert(false); // Invalid badge ID
    }
    
    reward_points
}

// Example: Using JWT proof of visit to unlock special locations
fn unlock_special_location(
    data: BoundedVec<u8, MAX_DATA_LENGTH>,
    base64_decode_offset: u32,
    pubkey_modulus_limbs: [Field; 18],
    redc_params_limbs: [Field; 18],
    signature_limbs: [Field; 18],
    location_id: Field,
    min_visits_required: u64
) -> bool {
    // Initialize JWT
    let jwt = JWT::init(
        data,
        base64_decode_offset,
        pubkey_modulus_limbs,
        redc_params_limbs,
        signature_limbs
    );
    
    // Verify JWT signature
    jwt.verify();
    
    // Get "visited_places" value
    let visited_places_key = "visited_places".as_bytes();
    let visited_places = jwt.get_claim_number(visited_places_key);
    
    // Check if user ID matches authorization
    let sub_key = "sub".as_bytes();
    let user_id = jwt.get_claim_string(sub_key);
    
    // This is just a simple example; in practice, more complex authorization logic would be needed
    let has_enough_visits = visited_places >= min_visits_required;
    
    // Check if the first character of the user ID is "u" (like "user123")
    let first_char = user_id[0]; // Access the first character directly from the string
    let is_valid_user = first_char == 117; // ASCII 'u'
    
    // Return whether the location can be unlocked
    has_enough_visits && is_valid_user
}

// This function can be called from client-side JS, returns boolean indicating if user can unlock hidden spot
fn can_unlock_hidden_spot(
    data: BoundedVec<u8, MAX_DATA_LENGTH>,
    base64_decode_offset: u32,
    pubkey_modulus_limbs: [Field; 18],
    redc_params_limbs: [Field; 18],
    signature_limbs: [Field; 18]
) -> bool {
    // Initialize JWT to read visited_places
    let jwt = JWT::init(
        data,
        base64_decode_offset,
        pubkey_modulus_limbs,
        redc_params_limbs,
        signature_limbs
    );
    
    // Verify JWT signature
    jwt.verify();
    
    // Get "visited_places" value
    let visited_places_key = "visited_places".as_bytes();
    let visited_places = jwt.get_claim_number(visited_places_key);
    
    // Hidden spots require at least 15 visited places
    visited_places >= 15
} 