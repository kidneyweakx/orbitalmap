pub mod models;
pub mod crypto;
pub mod location;
pub mod heatmap;
pub mod analytics;

// Re-export key types and functions
pub use models::{
    Location, EncryptedLocation, SensorData, WifiNetwork, CellTower,
    Station, StationType, GridCell, HeatmapResponse, HeatmapRequest,
    VisitAnalyticsRequest, VisitAnalyticsResponse, LocationRegistrationRequest,
    LocationRegistrationResponse, LocationVisit
};

pub use crypto::{encrypt_location, decrypt_location};
pub use location::{register_location, get_location, verify_location};
pub use heatmap::{generate_heatmap, generate_synthetic_heatmap};
pub use analytics::{generate_visit_analytics, generate_daily_summary}; 