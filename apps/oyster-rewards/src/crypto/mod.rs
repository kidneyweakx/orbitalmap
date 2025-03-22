use chacha20poly1305::{ChaCha20Poly1305, Key, Nonce};
use chacha20poly1305::aead::Aead;
use chacha20poly1305::KeyInit;
use x25519_dalek::{EphemeralSecret, PublicKey};
use rand::rngs::OsRng;
use rand::Rng;
use sha2::{Sha256, Digest};
use base64::{Engine as _, engine::general_purpose};
use once_cell::sync::Lazy;
use crate::models::{Location, EncryptedLocation};

// Generate stable keys for the application
static PRIVATE_KEY_BYTES: Lazy<[u8; 32]> = Lazy::new(|| {
    let mut bytes = [0u8; 32];
    OsRng.fill(&mut bytes);
    bytes
});

static PRIVATE_KEY: Lazy<EphemeralSecret> = Lazy::new(|| {
    // Use OsRng to create EphemeralSecret
    let secret = EphemeralSecret::random_from_rng(OsRng);
    secret
});

static PUBLIC_KEY: Lazy<PublicKey> = Lazy::new(|| PublicKey::from(&*PRIVATE_KEY));

// Get a derived key for encryption/decryption
pub fn get_derived_key() -> Key {
    let mut hasher = Sha256::new();
    // For consistency, still use PRIVATE_KEY_BYTES
    hasher.update(&*PRIVATE_KEY_BYTES);
    let hashed_key = hasher.finalize();
    *Key::from_slice(&hashed_key[0..32])
}

// Function to encrypt location data
pub fn encrypt_location(location: &Location) -> Result<EncryptedLocation, String> {
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
        timestamp: location.timestamp.clone(),
        nonce: general_purpose::STANDARD.encode(nonce),
    })
}

// Function to decrypt location data
pub fn decrypt_location(encrypted: &EncryptedLocation) -> Result<Location, String> {
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