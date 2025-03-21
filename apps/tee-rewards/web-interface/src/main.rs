use actix_cors::Cors;
use actix_web::{web, App, HttpResponse, HttpServer, Responder, Error, http};
use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use std::io::{self, Write, BufRead, BufReader};
use log::{info, error, debug};
use std::sync::Mutex;
use actix_web::rt::time::sleep;
use std::time::Duration;
use std::sync::Arc;

// Request Models
#[derive(Debug, Serialize, Deserialize)]
struct LocationRegistrationRequest {
    lat: f64,
    lon: f64,
    user_id: String,
    device_id: String,
    wifi_networks: Vec<WifiNetwork>,
    cell_towers: Vec<CellTower>,
    accelerometer: Option<[f32; 3]>,
    gyroscope: Option<[f32; 3]>,
    is_mock_location: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct LocationLookupRequest {
    encrypted_location_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct HeatmapRequest {
    min_lat: f64,
    min_lon: f64,
    max_lat: f64,
    max_lon: f64,
}

#[derive(Debug, Serialize, Deserialize)]
struct VisitAnalyticsRequest {
    lat: f64,
    lon: f64,
}

#[derive(Debug, Serialize, Deserialize)]
struct WifiNetwork {
    ssid: String,
    bssid: String,
    signal_strength: i32,
}

#[derive(Debug, Serialize, Deserialize)]
struct CellTower {
    cell_id: String,
    signal_strength: i32,
}

// Response Models
#[derive(Debug, Serialize, Deserialize)]
struct LocationRegistrationResponse {
    encrypted_location_id: String,
    success: bool,
    message: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct LocationResponse {
    lat: Option<f64>,
    lon: Option<f64>,
    timestamp: Option<u64>,
    success: bool,
    message: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct HeatmapResponse {
    grid_cells: Vec<HeatmapCell>,
    max_value: u32,
    success: bool,
    message: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct HeatmapCell {
    lat: f64,
    lon: f64,
    value: u32,
}

#[derive(Debug, Serialize, Deserialize)]
struct VisitAnalyticsResponse {
    lat: f64,
    lon: f64,
    visits_24h: u32,
    unique_visitors_24h: u32,
    peak_hour: u32,
    success: bool,
    message: String,
}

// General response for errors
#[derive(Debug, Serialize, Deserialize)]
struct ApiResponse {
    success: bool,
    message: String,
}

// Enarx process management
struct EnarxProcess {
    child: Mutex<Option<std::process::Child>>,
}

impl EnarxProcess {
    fn new() -> Self {
        Self {
            child: Mutex::new(None),
        }
    }

    async fn start_process(&self) -> Result<(), String> {
        let mut child_lock = self.child.lock().unwrap();
        
        // Only start a new process if one isn't already running
        if child_lock.is_none() {
            info!("Starting new Enarx process");
            let child = Command::new("enarx")
                .arg("run")
                .arg("/app/tee-rewards.wasm")
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn();
            
            match child {
                Ok(process) => {
                    *child_lock = Some(process);
                    
                    // Wait for process to be ready
                    sleep(Duration::from_millis(1000)).await;
                    
                    // Read initial output until prompt
                    if let Some(child) = child_lock.as_mut() {
                        if let Some(stdout) = child.stdout.as_mut() {
                            let mut reader = BufReader::new(stdout);
                            let mut line = String::new();
                            let mut attempts = 0;
                            
                            while attempts < 10 {
                                match reader.read_line(&mut line) {
                                    Ok(0) => break, // EOF
                                    Ok(_) => {
                                        debug!("TEE startup: {}", line.trim());
                                        if line.contains(">") {
                                            return Ok(());
                                        }
                                        line.clear();
                                    },
                                    Err(e) => return Err(format!("Failed to read from stdout: {}", e)),
                                }
                                attempts += 1;
                            }
                        }
                    }
                    
                    Ok(())
                },
                Err(e) => Err(format!("Failed to start Enarx process: {}", e)),
            }
        } else {
            Ok(())
        }
    }
    
    async fn send_command(&self, command: String) -> Result<String, String> {
        let mut child_lock = self.child.lock().unwrap();
        
        if let Some(child) = child_lock.as_mut() {
            // Get a handle to stdin and stdout
            if let Some(stdin) = child.stdin.as_mut() {
                // Write the command to stdin
                debug!("Sending command to TEE: {}", command);
                if let Err(e) = writeln!(stdin, "{}", command) {
                    return Err(format!("Failed to write to stdin: {}", e));
                }
                
                // Create a BufReader to read from stdout
                if let Some(stdout) = child.stdout.as_mut() {
                    let mut reader = BufReader::new(stdout);
                    let mut output = String::new();
                    let mut line = String::new();
                    
                    // Read until we get the prompt or timeout
                    let mut retries = 0;
                    let mut response_started = false;
                    
                    while retries < 20 {
                        match reader.read_line(&mut line) {
                            Ok(0) => break, // EOF
                            Ok(_) => {
                                debug!("TEE output: {}", line.trim());
                                
                                // If we see a line with "{", it's likely the start of JSON response
                                if line.trim().starts_with('{') {
                                    response_started = true;
                                }
                                
                                if response_started {
                                    output.push_str(&line);
                                }
                                
                                // If we see a prompt after getting some response, we're done
                                if line.contains(">") && response_started {
                                    // Remove the prompt from the output
                                    if let Some(pos) = output.rfind('>') {
                                        output.truncate(pos);
                                    }
                                    return Ok(output.trim().to_string());
                                }
                                
                                line.clear();
                            }
                            Err(e) => return Err(format!("Failed to read from stdout: {}", e)),
                        }
                        
                        retries += 1;
                        sleep(Duration::from_millis(100)).await;
                    }
                    
                    if output.is_empty() {
                        return Err("No output received from process".to_string());
                    }
                    
                    return Ok(output.trim().to_string());
                } else {
                    return Err("Failed to get stdout handle".to_string());
                }
            } else {
                return Err("Failed to get stdin handle".to_string());
            }
        } else {
            return Err("Enarx process not running".to_string());
        }
    }
}

// API endpoints
async fn register_location(
    enarx_process: web::Data<Arc<EnarxProcess>>, 
    req: web::Json<LocationRegistrationRequest>
) -> Result<HttpResponse, Error> {
    info!("Received location registration request for user: {}", req.user_id);
    
    // Ensure process is running
    if let Err(e) = enarx_process.start_process().await {
        error!("Failed to start Enarx process: {}", e);
        return Ok(HttpResponse::InternalServerError().json(ApiResponse {
            success: false,
            message: format!("Failed to start Enarx process: {}", e),
        }));
    }
    
    // Prepare the command for the TEE
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    let command = serde_json::json!({
        "RegisterLocation": {
            "lat": req.lat,
            "lon": req.lon,
            "timestamp": timestamp,
            "user_id": req.user_id,
            "device_id": req.device_id,
            "sensors": {
                "wifi_networks": req.wifi_networks,
                "cell_towers": req.cell_towers,
                "accelerometer": req.accelerometer,
                "gyroscope": req.gyroscope,
                "is_mock_location": req.is_mock_location
            }
        }
    });
    
    // Send command to process
    match enarx_process.send_command(command.to_string()).await {
        Ok(output) => {
            debug!("TEE response: {}", output);
            
            // Parse the response
            match serde_json::from_str::<serde_json::Value>(&output) {
                Ok(response) => {
                    if let Some(location_registered) = response.get("LocationRegistered") {
                        let enc_location = location_registered.get("enc_location")
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                            
                        let success = location_registered.get("success")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false);
                            
                        let message = location_registered.get("message")
                            .and_then(|v| v.as_str())
                            .unwrap_or("Unknown response");
                            
                        let response = LocationRegistrationResponse {
                            encrypted_location_id: enc_location.to_string(),
                            success,
                            message: message.to_string(),
                        };
                        
                        if success {
                            return Ok(HttpResponse::Ok().json(response));
                        } else {
                            return Ok(HttpResponse::BadRequest().json(response));
                        }
                    } else {
                        return Ok(HttpResponse::InternalServerError().json(ApiResponse {
                            success: false,
                            message: "Unexpected response format from TEE".to_string(),
                        }));
                    }
                },
                Err(e) => {
                    error!("Failed to parse TEE response: {}", e);
                    return Ok(HttpResponse::InternalServerError().json(ApiResponse {
                        success: false,
                        message: format!("Failed to parse TEE response: {}", e),
                    }));
                }
            }
        },
        Err(e) => {
            error!("Failed to communicate with Enarx: {}", e);
            return Ok(HttpResponse::InternalServerError().json(ApiResponse {
                success: false,
                message: format!("Failed to communicate with Enarx: {}", e),
            }));
        }
    }
}

async fn get_location(
    enarx_process: web::Data<Arc<EnarxProcess>>, 
    req: web::Json<LocationLookupRequest>
) -> Result<HttpResponse, Error> {
    info!("Received location lookup request for encrypted ID: {}", req.encrypted_location_id);
    
    // Ensure process is running
    if let Err(e) = enarx_process.start_process().await {
        error!("Failed to start Enarx process: {}", e);
        return Ok(HttpResponse::InternalServerError().json(ApiResponse {
            success: false,
            message: format!("Failed to start Enarx process: {}", e),
        }));
    }
    
    // Prepare the command for the TEE
    let command = serde_json::json!({
        "GetLocation": req.encrypted_location_id
    });
    
    // Send command to process
    match enarx_process.send_command(command.to_string()).await {
        Ok(output) => {
            debug!("TEE response: {}", output);
            
            // Parse the response
            match serde_json::from_str::<serde_json::Value>(&output) {
                Ok(response) => {
                    if let Some(location_data) = response.get("LocationData") {
                        let success = location_data.get("success")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false);
                            
                        let message = location_data.get("message")
                            .and_then(|v| v.as_str())
                            .unwrap_or("Unknown response");
                        
                        let mut location_response = LocationResponse {
                            lat: None,
                            lon: None,
                            timestamp: None,
                            success,
                            message: message.to_string(),
                        };
                        
                        if success {
                            if let Some(location) = location_data.get("location") {
                                location_response.lat = location.get("lat").and_then(|v| v.as_f64());
                                location_response.lon = location.get("lon").and_then(|v| v.as_f64());
                                location_response.timestamp = location.get("timestamp").and_then(|v| v.as_u64());
                            }
                        }
                        
                        if success {
                            return Ok(HttpResponse::Ok().json(location_response));
                        } else {
                            return Ok(HttpResponse::NotFound().json(location_response));
                        }
                    } else {
                        return Ok(HttpResponse::InternalServerError().json(ApiResponse {
                            success: false,
                            message: "Unexpected response format from TEE".to_string(),
                        }));
                    }
                },
                Err(e) => {
                    error!("Failed to parse TEE response: {}", e);
                    return Ok(HttpResponse::InternalServerError().json(ApiResponse {
                        success: false,
                        message: format!("Failed to parse TEE response: {}", e),
                    }));
                }
            }
        },
        Err(e) => {
            error!("Failed to communicate with Enarx: {}", e);
            return Ok(HttpResponse::InternalServerError().json(ApiResponse {
                success: false,
                message: format!("Failed to communicate with Enarx: {}", e),
            }));
        }
    }
}

async fn generate_heatmap(
    enarx_process: web::Data<Arc<EnarxProcess>>, 
    req: web::Json<HeatmapRequest>
) -> Result<HttpResponse, Error> {
    info!("Received heatmap request for area: ({}, {}) to ({}, {})", 
          req.min_lat, req.min_lon, req.max_lat, req.max_lon);
    
    // Ensure process is running
    if let Err(e) = enarx_process.start_process().await {
        error!("Failed to start Enarx process: {}", e);
        return Ok(HttpResponse::InternalServerError().json(ApiResponse {
            success: false,
            message: format!("Failed to start Enarx process: {}", e),
        }));
    }
    
    // Prepare the command for the TEE
    let command = serde_json::json!({
        "GenerateHeatmap": {
            "min_lat": req.min_lat,
            "min_lon": req.min_lon,
            "max_lat": req.max_lat,
            "max_lon": req.max_lon
        }
    });
    
    // Send command to process
    match enarx_process.send_command(command.to_string()).await {
        Ok(output) => {
            debug!("TEE response: {}", output);
            
            // Parse the response
            match serde_json::from_str::<serde_json::Value>(&output) {
                Ok(response) => {
                    if let Some(heatmap_data) = response.get("Heatmap") {
                        let mut cells = Vec::new();
                        let mut max_value = 0;
                        
                        if let Some(grid_cells) = heatmap_data.get("grid_cells").and_then(|v| v.as_array()) {
                            for cell in grid_cells {
                                let lat = cell.get("lat").and_then(|v| v.as_f64()).unwrap_or(0.0);
                                let lon = cell.get("lon").and_then(|v| v.as_f64()).unwrap_or(0.0);
                                let value = cell.get("value").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                                
                                cells.push(HeatmapCell { lat, lon, value });
                            }
                        }
                        
                        max_value = heatmap_data.get("max_value").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                        
                        let heatmap_response = HeatmapResponse {
                            grid_cells: cells,
                            max_value,
                            success: true,
                            message: "Heatmap generated successfully".to_string(),
                        };
                        
                        return Ok(HttpResponse::Ok().json(heatmap_response));
                    } else {
                        return Ok(HttpResponse::InternalServerError().json(ApiResponse {
                            success: false,
                            message: "Unexpected response format from TEE".to_string(),
                        }));
                    }
                },
                Err(e) => {
                    error!("Failed to parse TEE response: {}", e);
                    return Ok(HttpResponse::InternalServerError().json(ApiResponse {
                        success: false,
                        message: format!("Failed to parse TEE response: {}", e),
                    }));
                }
            }
        },
        Err(e) => {
            error!("Failed to communicate with Enarx: {}", e);
            return Ok(HttpResponse::InternalServerError().json(ApiResponse {
                success: false,
                message: format!("Failed to communicate with Enarx: {}", e),
            }));
        }
    }
}

async fn get_visit_analytics(
    enarx_process: web::Data<Arc<EnarxProcess>>, 
    req: web::Json<VisitAnalyticsRequest>
) -> Result<HttpResponse, Error> {
    info!("Received visit analytics request for location: ({}, {})", req.lat, req.lon);
    
    // Ensure process is running
    if let Err(e) = enarx_process.start_process().await {
        error!("Failed to start Enarx process: {}", e);
        return Ok(HttpResponse::InternalServerError().json(ApiResponse {
            success: false,
            message: format!("Failed to start Enarx process: {}", e),
        }));
    }
    
    // Prepare the command for the TEE
    let command = serde_json::json!({
        "GetVisitAnalytics": {
            "lat": req.lat,
            "lon": req.lon
        }
    });
    
    // Send command to process
    match enarx_process.send_command(command.to_string()).await {
        Ok(output) => {
            debug!("TEE response: {}", output);
            
            // Parse the response
            match serde_json::from_str::<serde_json::Value>(&output) {
                Ok(response) => {
                    if let Some(analytics_data) = response.get("VisitAnalytics") {
                        let visits_24h = analytics_data.get("visits_24h")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0) as u32;
                            
                        let unique_visitors_24h = analytics_data.get("unique_visitors_24h")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0) as u32;
                            
                        let peak_hour = analytics_data.get("peak_hour")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0) as u32;
                            
                        let lat = req.lat;
                        let lon = req.lon;
                        
                        let analytics_response = VisitAnalyticsResponse {
                            lat,
                            lon,
                            visits_24h,
                            unique_visitors_24h,
                            peak_hour,
                            success: true,
                            message: "Visit analytics generated successfully".to_string(),
                        };
                        
                        return Ok(HttpResponse::Ok().json(analytics_response));
                    } else {
                        return Ok(HttpResponse::InternalServerError().json(ApiResponse {
                            success: false,
                            message: "Unexpected response format from TEE".to_string(),
                        }));
                    }
                },
                Err(e) => {
                    error!("Failed to parse TEE response: {}", e);
                    return Ok(HttpResponse::InternalServerError().json(ApiResponse {
                        success: false,
                        message: format!("Failed to parse TEE response: {}", e),
                    }));
                }
            }
        },
        Err(e) => {
            error!("Failed to communicate with Enarx: {}", e);
            return Ok(HttpResponse::InternalServerError().json(ApiResponse {
                success: false,
                message: format!("Failed to communicate with Enarx: {}", e),
            }));
        }
    }
}

async fn health_check() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "up",
        "message": "TEE Location Service is running"
    }))
}

#[actix_web::main]
async fn main() -> io::Result<()> {
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));
    
    info!("Starting TEE Location Services API at http://0.0.0.0:8080");
    
    // Create shared Enarx process instance
    let enarx_process = Arc::new(EnarxProcess::new());
    
    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header();
            
        App::new()
            .wrap(cors)
            .app_data(web::Data::new(enarx_process.clone()))
            .route("/health", web::get().to(health_check))
            .route("/api/location/register", web::post().to(register_location))
            .route("/api/location/get", web::post().to(get_location))
            .route("/api/heatmap", web::post().to(generate_heatmap))
            .route("/api/analytics/visits", web::post().to(get_visit_analytics))
    })
    .bind(("0.0.0.0", 8080))?
    .run()
    .await
} 