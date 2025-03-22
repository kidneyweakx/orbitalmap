use criterion::{black_box, criterion_group, criterion_main, Criterion};
use oyster_rewards::{Location, SensorData, WifiNetwork, CellTower, verify_location};
use std::collections::HashMap;
use rand::Rng;
use chrono::Utc;

fn create_test_location() -> Location {
    let mut rng = rand::thread_rng();
    let lat = 37.7749 + (rng.gen::<f64>() - 0.5) * 0.1;
    let lon = -122.4194 + (rng.gen::<f64>() - 0.5) * 0.1;
    
    // Create WiFi networks
    let mut wifi_networks = Vec::new();
    for i in 0..3 {
        let bssid = format!("{:02X}:{:02X}:{:02X}:{:02X}:{:02X}:{:02X}",
            rng.gen::<u8>(), rng.gen::<u8>(), rng.gen::<u8>(),
            rng.gen::<u8>(), rng.gen::<u8>(), rng.gen::<u8>());
            
        wifi_networks.push(WifiNetwork {
            ssid: format!("WiFi-{}", i),
            bssid,
            signal_strength: -50 - (rng.gen::<f64>() * 40.0) as i32,
            frequency: 2400 + (rng.gen::<u32>() % 500),
        });
    }
    
    // Create cell towers
    let mut cell_towers = Vec::new();
    for i in 0..2 {
        cell_towers.push(CellTower {
            cell_id: format!("CELL-{}", i),
            signal_strength: -70 - (rng.gen::<f64>() * 40.0) as i32,
            mcc: 310,
            mnc: 410 + (i as u32),
            lac: 10000 + (rng.gen::<u32>() % 5000),
        });
    }
    
    // Create sensor data
    let sensor_data = SensorData {
        wifi_networks,
        cell_towers,
        accelerometer: Some(vec![0.1, 0.2, 9.8]),
        gyroscope: Some(vec![0.01, 0.02, 0.03]),
        is_mock_location: false,
        additional_data: HashMap::new(),
    };
    
    // Create location
    Location {
        lat,
        lon,
        timestamp: Utc::now().to_rfc3339(),
        user_id: "benchmark_user".to_string(),
        device_id: "benchmark_device".to_string(),
        sensors: sensor_data,
    }
}

fn location_verification_benchmark(c: &mut Criterion) {
    let mut group = c.benchmark_group("Location Verification");
    
    // Benches with valid locations
    let valid_location = create_test_location();
    group.bench_function("verify_valid_location", |b| {
        b.iter(|| verify_location(black_box(&valid_location)))
    });
    
    // Benches with invalid locations (mock location)
    let mut mock_location = create_test_location();
    mock_location.sensors.is_mock_location = true;
    group.bench_function("verify_mock_location", |b| {
        b.iter(|| verify_location(black_box(&mock_location)))
    });
    
    // Benches with invalid locations (missing sensors)
    let mut no_sensor_location = create_test_location();
    no_sensor_location.sensors.accelerometer = None;
    no_sensor_location.sensors.gyroscope = None;
    group.bench_function("verify_no_sensor_location", |b| {
        b.iter(|| verify_location(black_box(&no_sensor_location)))
    });
    
    group.finish();
}

criterion_group!(benches, location_verification_benchmark);
criterion_main!(benches); 