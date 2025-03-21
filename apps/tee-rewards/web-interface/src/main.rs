use actix_cors::Cors;
use actix_web::{web, App, HttpResponse, HttpServer, Responder, Error};
use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use std::io::{self, Write, BufRead, BufReader};
use log::{info, error};
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
            info!("🚀 Starting new Enarx process");
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
                    info!("⏳ Waiting for Enarx process to initialize...");
                    sleep(Duration::from_millis(1000)).await;
                    
                    // Read initial output until prompt
                    if let Some(child) = child_lock.as_mut() {
                        if let Some(stdout) = child.stdout.as_mut() {
                            let mut reader = BufReader::new(stdout);
                            let mut line = String::new();
                            let mut attempts = 0;
                            
                            while attempts < 15 { // Increased timeout
                                match reader.read_line(&mut line) {
                                    Ok(0) => {
                                        error!("❌ EOF reached while waiting for TEE prompt");
                                        break; // EOF
                                    },
                                    Ok(bytes) => {
                                        info!("📝 TEE startup ({}b): {}", bytes, line.trim());
                                        if line.contains(">") || line.contains("Type a JSON command") {
                                            info!("✅ TEE ready (prompt detected)");
                                            return Ok(());
                                        }
                                        line.clear();
                                    },
                                    Err(e) => {
                                        error!("❌ Failed to read from stdout: {}", e);
                                        return Err(format!("Failed to read from stdout: {}", e));
                                    }
                                }
                                attempts += 1;
                                sleep(Duration::from_millis(200)).await; // Increased wait time
                            }
                            
                            if attempts >= 15 {
                                error!("⚠️ Timed out waiting for TEE prompt, but continuing");
                                // Return Ok anyway to try to continue
                                return Ok(());
                            }
                        }
                        
                        // Also log stderr in a separate thread
                        if let Some(stderr) = child_lock.as_mut().unwrap().stderr.take() {
                            std::thread::spawn(move || {
                                let reader = BufReader::new(stderr);
                                for line in reader.lines() {
                                    if let Ok(line) = line {
                                        eprintln!("TEE stderr: {}", line);
                                    }
                                }
                            });
                        }
                    }
                    
                    info!("✅ Enarx process started successfully");
                    Ok(())
                },
                Err(e) => {
                    error!("❌ Failed to start Enarx process: {}", e);
                    Err(format!("Failed to start Enarx process: {}", e))
                }
            }
        } else {
            // Check if the process is still alive
            let mut need_restart = false;
            
            if let Some(child) = child_lock.as_mut() {
                match child.try_wait() {
                    Ok(Some(status)) => {
                        // Process has exited
                        error!("⚠️ Enarx process exited with status: {:?}", status);
                        need_restart = true;
                    },
                    Ok(None) => {
                        // Process is still running
                        info!("ℹ️ Enarx process already running");
                    },
                    Err(e) => {
                        // Error checking process status
                        error!("❌ Error checking Enarx process status: {}", e);
                        need_restart = true;
                    }
                }
            }
            
            if need_restart {
                // Kill the process if it's still in the struct but not running properly
                if let Some(mut child) = child_lock.take() {
                    let _ = child.kill();
                }
                
                // Drop the lock and start a new process (avoid recursion)
                drop(child_lock);
                
                // Use a separate method for restarting to avoid recursion in async fn
                return self.restart_process().await;
            }
            
            Ok(())
        }
    }
    
    // Separate method to avoid recursion in async fn
    async fn restart_process(&self) -> Result<(), String> {
        // Small delay before restart
        sleep(Duration::from_millis(500)).await;
        
        info!("🔄 Restarting Enarx process");
        
        let mut child_lock = self.child.lock().unwrap();
        
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
                info!("⏳ Waiting for restarted Enarx process to initialize...");
                sleep(Duration::from_millis(1000)).await;
                
                // Almost the same as start_process but without recursion
                if let Some(child) = child_lock.as_mut() {
                    if let Some(stdout) = child.stdout.as_mut() {
                        let mut reader = BufReader::new(stdout);
                        let mut line = String::new();
                        let mut attempts = 0;
                        
                        while attempts < 15 {
                            match reader.read_line(&mut line) {
                                Ok(0) => {
                                    error!("❌ EOF reached while waiting for TEE prompt");
                                    break;
                                },
                                Ok(bytes) => {
                                    info!("📝 TEE restart ({}b): {}", bytes, line.trim());
                                    if line.contains(">") || line.contains("Type a JSON command") {
                                        info!("✅ TEE restarted and ready");
                                        return Ok(());
                                    }
                                    line.clear();
                                },
                                Err(e) => {
                                    error!("❌ Failed to read from stdout: {}", e);
                                    return Err(format!("Failed to read from stdout: {}", e));
                                }
                            }
                            attempts += 1;
                            sleep(Duration::from_millis(200)).await;
                        }
                        
                        if attempts >= 15 {
                            error!("⚠️ Timed out waiting for restarted TEE prompt, but continuing");
                            return Ok(());
                        }
                    }
                    
                    // Also log stderr in a separate thread
                    if let Some(stderr) = child_lock.as_mut().unwrap().stderr.take() {
                        std::thread::spawn(move || {
                            let reader = BufReader::new(stderr);
                            for line in reader.lines() {
                                if let Ok(line) = line {
                                    eprintln!("TEE stderr: {}", line);
                                }
                            }
                        });
                    }
                }
                
                info!("✅ Enarx process restarted successfully");
                Ok(())
            },
            Err(e) => {
                error!("❌ Failed to restart Enarx process: {}", e);
                Err(format!("Failed to restart Enarx process: {}", e))
            }
        }
    }
    
    async fn send_command(&self, command: String) -> Result<String, String> {
        let mut child_lock = self.child.lock().unwrap();
        
        if let Some(child) = child_lock.as_mut() {
            // Get a handle to stdin and stdout
            if let Some(stdin) = child.stdin.as_mut() {
                // Write the command to stdin
                info!("⏳ Sending command to TEE: {}", command);
                if let Err(e) = writeln!(stdin, "{}", command) {
                    error!("❌ Failed to write to stdin: {}", e);
                    return Err(format!("Failed to write to stdin: {}", e));
                }
                
                // Create a BufReader to read from stdout
                if let Some(stdout) = child.stdout.as_mut() {
                    let mut reader = BufReader::new(stdout);
                    let mut output = String::new();
                    
                    // Read until we get the prompt or timeout
                    let mut retries = 0;
                    let mut response_started = false;
                    let mut json_bracket_count = 0;
                    let mut is_complete_json = false;
                    
                    info!("🔍 Waiting for TEE response...");
                    while retries < 30 { // Increased timeout retries
                        // Set a timeout for the read operation
                        match actix_web::rt::time::timeout(
                            Duration::from_millis(500), 
                            async {
                                let mut tmp_line = String::new();
                                match reader.read_line(&mut tmp_line) {
                                    Ok(bytes) => Some((tmp_line, bytes)),
                                    Err(e) => {
                                        error!("❌ Error reading from stdout: {}", e);
                                        None
                                    }
                                }
                            }
                        ).await {
                            Ok(Some((new_line, bytes))) => {
                                if bytes == 0 {
                                    error!("❌ EOF reached while reading TEE response");
                                    break;
                                }
                                
                                info!("📝 TEE output ({}b): {}", bytes, new_line.trim());
                                let line = new_line;
                                
                                // Track JSON structure brackets to determine if the response is complete
                                for c in line.chars() {
                                    if c == '{' {
                                        json_bracket_count += 1;
                                    } else if c == '}' {
                                        json_bracket_count -= 1;
                                        // When bracket count reaches 0 and we had some brackets, we have a complete JSON
                                        if json_bracket_count == 0 && response_started {
                                            is_complete_json = true;
                                        }
                                    }
                                }
                                
                                // If we see a line with "{", it's likely the start of JSON response
                                if line.trim().starts_with('{') {
                                    info!("✅ JSON response detected");
                                    response_started = true;
                                }
                                
                                if response_started {
                                    output.push_str(&line);
                                }
                                
                                // Complete if:
                                // 1. We see a prompt after getting some response, OR
                                // 2. We have a complete JSON object (bracket count returned to 0)
                                if ((line.contains(">") || line.contains("Type a JSON command")) && response_started) || is_complete_json {
                                    if is_complete_json {
                                        info!("✅ Complete JSON response detected (balanced brackets)");
                                    } else {
                                        info!("✅ Response complete (prompt found)");
                                    }
                                    
                                    // Remove the prompt from the output if it exists
                                    if let Some(pos) = output.rfind('>') {
                                        output.truncate(pos);
                                    }
                                    
                                    // Try to parse as JSON to validate
                                    match serde_json::from_str::<serde_json::Value>(&output) {
                                        Ok(_) => {
                                            info!("✅ Successfully parsed JSON response");
                                            return Ok(output.trim().to_string());
                                        },
                                        Err(e) => {
                                            if is_complete_json {
                                                error!("❌ Found complete JSON brackets but parsing failed: {}", e);
                                                // Adding a small delay and continuing as we might need more content
                                                sleep(Duration::from_millis(200)).await;
                                                is_complete_json = false;
                                            } else {
                                                // If the prompt was found but JSON is invalid, return anyway
                                                info!("⚠️ Prompt found but JSON parse failed: {}", e);
                                                return Ok(output.trim().to_string());
                                            }
                                        }
                                    }
                                }
                            },
                            Ok(None) => {
                                // Read error
                                retries += 1;
                            },
                            Err(_) => {
                                // Timeout occurred
                                info!("⏳ Read operation timed out, retrying...");
                                retries += 1;
                                
                                // If we have output but haven't received anything for a while,
                                // try to parse what we have as JSON and see if it's valid
                                if response_started && !output.is_empty() && retries > 5 {
                                    match serde_json::from_str::<serde_json::Value>(&output) {
                                        Ok(_) => {
                                            info!("✅ Valid JSON detected after timeout");
                                            return Ok(output.trim().to_string());
                                        },
                                        Err(_) => {
                                            // Continue waiting, it's not valid JSON yet
                                        }
                                    }
                                }
                            }
                        }
                        
                        if !response_started && retries >= 15 {
                            // If we haven't received any response after multiple retries,
                            // the process might be hung
                            error!("⚠️ No response from TEE after multiple retries, process may be hung");
                            
                            // Try to recover by killing and restarting the process
                            drop(child_lock);
                            let mut new_lock = self.child.lock().unwrap();
                            if let Some(mut proc) = new_lock.take() {
                                let _ = proc.kill();
                            }
                            drop(new_lock);
                            
                            // Try to restart
                            if let Err(e) = self.restart_process().await {
                                return Err(format!("Failed to restart hung process: {}", e));
                            }
                            
                            // Return error, client should retry
                            return Err("TEE process was unresponsive and has been restarted. Please retry your request.".to_string());
                        }
                        
                        info!("⏳ Waiting for more TEE output... (attempt {}/30)", retries);
                        sleep(Duration::from_millis(200)).await; // Increased wait time
                    }
                    
                    if output.is_empty() {
                        error!("❌ No output received from TEE after {} attempts", retries);
                        return Err("No output received from process".to_string());
                    }
                    
                    // Try to parse what we have as JSON as a last resort
                    match serde_json::from_str::<serde_json::Value>(&output) {
                        Ok(_) => {
                            info!("✅ Valid JSON detected at end of retries");
                            return Ok(output.trim().to_string());
                        },
                        Err(e) => {
                            info!("⚠️ Timed out waiting for complete response, returning partial output (parse error: {})", e);
                            return Ok(output.trim().to_string());
                        }
                    }
                } else {
                    error!("❌ Failed to get stdout handle");
                    return Err("Failed to get stdout handle".to_string());
                }
            } else {
                error!("❌ Failed to get stdin handle");
                return Err("Failed to get stdin handle".to_string());
            }
        } else {
            error!("❌ Enarx process not running");
            // Try to start the process
            drop(child_lock);
            if let Err(e) = self.start_process().await {
                return Err(format!("Failed to start Enarx process: {}", e));
            }
            
            // Try again with the process started
            sleep(Duration::from_millis(500)).await;
            
            // Use a separate method for retry to avoid recursion
            return self.retry_command(command).await;
        }
    }
    
    // Separate method to avoid recursion in async fn
    async fn retry_command(&self, command: String) -> Result<String, String> {
        info!("🔄 Retrying command after process restart");
        
        let mut child_lock = self.child.lock().unwrap();
        
        if let Some(child) = child_lock.as_mut() {
            // Get a handle to stdin and stdout
            if let Some(stdin) = child.stdin.as_mut() {
                // Write the command to stdin
                info!("⏳ Sending command to restarted TEE: {}", command);
                if let Err(e) = writeln!(stdin, "{}", command) {
                    error!("❌ Failed to write to stdin after restart: {}", e);
                    return Err(format!("Failed to write to stdin after restart: {}", e));
                }
                
                // Create a BufReader to read from stdout
                if let Some(stdout) = child.stdout.as_mut() {
                    let mut reader = BufReader::new(stdout);
                    let mut output = String::new();
                    
                    // Read until we get the prompt or timeout
                    let mut retries = 0;
                    let mut response_started = false;
                    let mut json_bracket_count = 0;
                    let mut is_complete_json = false;
                    
                    info!("🔍 Waiting for response from restarted TEE...");
                    while retries < 30 {
                        // Similar timeout logic to send_command
                        match actix_web::rt::time::timeout(
                            Duration::from_millis(500), 
                            async {
                                let mut tmp_line = String::new();
                                match reader.read_line(&mut tmp_line) {
                                    Ok(bytes) => Some((tmp_line, bytes)),
                                    Err(e) => {
                                        error!("❌ Error reading from stdout after restart: {}", e);
                                        None
                                    }
                                }
                            }
                        ).await {
                            Ok(Some((line, bytes))) => {
                                if bytes == 0 {
                                    error!("❌ EOF reached while reading restarted TEE response");
                                    break;
                                }
                                
                                info!("📝 Restarted TEE output ({}b): {}", bytes, line.trim());
                                
                                // Track JSON structure brackets to determine if the response is complete
                                for c in line.chars() {
                                    if c == '{' {
                                        json_bracket_count += 1;
                                    } else if c == '}' {
                                        json_bracket_count -= 1;
                                        // When bracket count reaches 0 and we had some brackets, we have a complete JSON
                                        if json_bracket_count == 0 && response_started {
                                            is_complete_json = true;
                                        }
                                    }
                                }
                                
                                // If we see a line with "{", it's likely the start of JSON response
                                if line.trim().starts_with('{') {
                                    info!("✅ JSON response detected from restarted TEE");
                                    response_started = true;
                                }
                                
                                if response_started {
                                    output.push_str(&line);
                                }
                                
                                // Complete if:
                                // 1. We see a prompt after getting some response, OR
                                // 2. We have a complete JSON object (bracket count returned to 0)
                                if ((line.contains(">") || line.contains("Type a JSON command")) && response_started) || is_complete_json {
                                    if is_complete_json {
                                        info!("✅ Complete JSON response detected from restarted TEE (balanced brackets)");
                                    } else {
                                        info!("✅ Response complete from restarted TEE (prompt found)");
                                    }
                                    
                                    // Remove the prompt from the output if it exists
                                    if let Some(pos) = output.rfind('>') {
                                        output.truncate(pos);
                                    }
                                    
                                    // Try to parse as JSON to validate
                                    match serde_json::from_str::<serde_json::Value>(&output) {
                                        Ok(_) => {
                                            info!("✅ Successfully parsed JSON response from restarted TEE");
                                            return Ok(output.trim().to_string());
                                        },
                                        Err(e) => {
                                            if is_complete_json {
                                                error!("❌ Found complete JSON brackets but parsing failed: {}", e);
                                                // Adding a small delay and continuing as we might need more content
                                                sleep(Duration::from_millis(200)).await;
                                                is_complete_json = false;
                                            } else {
                                                // If the prompt was found but JSON is invalid, return anyway
                                                info!("⚠️ Prompt found but JSON parse failed for restarted TEE: {}", e);
                                                return Ok(output.trim().to_string());
                                            }
                                        }
                                    }
                                }
                            },
                            Ok(None) => {
                                // Read error
                                retries += 1;
                            },
                            Err(_) => {
                                // Timeout occurred
                                info!("⏳ Read operation on restarted TEE timed out, retrying...");
                                retries += 1;
                                
                                // If we have output but haven't received anything for a while,
                                // try to parse what we have as JSON and see if it's valid
                                if response_started && !output.is_empty() && retries > 5 {
                                    match serde_json::from_str::<serde_json::Value>(&output) {
                                        Ok(_) => {
                                            info!("✅ Valid JSON detected from restarted TEE after timeout");
                                            return Ok(output.trim().to_string());
                                        },
                                        Err(_) => {
                                            // Continue waiting, it's not valid JSON yet
                                        }
                                    }
                                }
                            }
                        }
                        
                        info!("⏳ Waiting for more output from restarted TEE... (attempt {}/30)", retries);
                        sleep(Duration::from_millis(200)).await;
                    }
                    
                    if output.is_empty() {
                        error!("❌ No output received from restarted TEE after {} attempts", retries);
                        return Err("No output received from restarted process".to_string());
                    }
                    
                    // Try to parse what we have as JSON as a last resort
                    match serde_json::from_str::<serde_json::Value>(&output) {
                        Ok(_) => {
                            info!("✅ Valid JSON detected from restarted TEE at end of retries");
                            return Ok(output.trim().to_string());
                        },
                        Err(e) => {
                            info!("⚠️ Timed out waiting for complete response from restarted TEE, returning partial output (parse error: {})", e);
                            return Ok(output.trim().to_string());
                        }
                    }
                } else {
                    error!("❌ Failed to get stdout handle from restarted TEE");
                    return Err("Failed to get stdout handle from restarted TEE".to_string());
                }
            } else {
                error!("❌ Failed to get stdin handle from restarted TEE");
                return Err("Failed to get stdin handle from restarted TEE".to_string());
            }
        } else {
            error!("❌ Restarted Enarx process unexpectedly not found");
            return Err("Restarted Enarx process unexpectedly not found".to_string());
        }
    }
}

// API endpoints
async fn register_location(
    enarx_process: web::Data<Arc<EnarxProcess>>, 
    req: web::Json<LocationRegistrationRequest>
) -> Result<HttpResponse, Error> {
    info!("📥 Received location registration request for user: {}", req.user_id);
    
    // Ensure process is running
    info!("🔄 Starting/checking Enarx process");
    if let Err(e) = enarx_process.start_process().await {
        error!("❌ Failed to start Enarx process: {}", e);
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
    
    info!("🔧 Preparing location registration command");
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
    info!("📤 Sending registration command to Enarx process");
    match enarx_process.send_command(command.to_string()).await {
        Ok(output) => {
            info!("📩 Received TEE response: {}", output);
            
            // Parse the response
            info!("🔍 Parsing TEE response");
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
                            info!("✅ Registration successful: {}", enc_location);
                            return Ok(HttpResponse::Ok().json(response));
                        } else {
                            error!("⚠️ Registration failed: {}", message);
                            return Ok(HttpResponse::BadRequest().json(response));
                        }
                    } else {
                        error!("❌ Unexpected response format from TEE: {}", output);
                        return Ok(HttpResponse::InternalServerError().json(ApiResponse {
                            success: false,
                            message: "Unexpected response format from TEE".to_string(),
                        }));
                    }
                },
                Err(e) => {
                    error!("❌ Failed to parse TEE response: {} - Raw output: {}", e, output);
                    return Ok(HttpResponse::InternalServerError().json(ApiResponse {
                        success: false,
                        message: format!("Failed to parse TEE response: {}", e),
                    }));
                }
            }
        },
        Err(e) => {
            error!("❌ Failed to communicate with Enarx: {}", e);
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
    info!("📥 Received location lookup request for encrypted ID: {}", req.encrypted_location_id);
    
    // Ensure process is running
    info!("🔄 Starting/checking Enarx process");
    if let Err(e) = enarx_process.start_process().await {
        error!("❌ Failed to start Enarx process: {}", e);
        return Ok(HttpResponse::InternalServerError().json(ApiResponse {
            success: false,
            message: format!("Failed to start Enarx process: {}", e),
        }));
    }
    
    // Prepare command
    info!("🔧 Preparing location lookup command");
    let command = serde_json::json!({
        "GetLocation": req.encrypted_location_id
    });
    
    // Send command to process
    info!("📤 Sending location lookup command to Enarx process");
    match enarx_process.send_command(command.to_string()).await {
        Ok(output) => {
            info!("📩 Received TEE response: {}", output);
            
            // Parse the response
            info!("🔍 Parsing TEE response");
            match serde_json::from_str::<serde_json::Value>(&output) {
                Ok(response) => {
                    if let Some(location) = response.get("Location") {
                        // Check if location was found
                        if location.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
                            let lat = location.get("lat").and_then(|v| v.as_f64());
                            let lon = location.get("lon").and_then(|v| v.as_f64());
                            let timestamp = location.get("timestamp").and_then(|v| v.as_u64());
                            let message = location.get("message").and_then(|v| v.as_str()).unwrap_or("Success");
                            
                            let response = LocationResponse {
                                lat,
                                lon,
                                timestamp,
                                success: true,
                                message: message.to_string(),
                            };
                            
                            info!("✅ Location found: lat={:?}, lon={:?}", lat, lon);
                            return Ok(HttpResponse::Ok().json(response));
                        } else {
                            let message = location.get("message").and_then(|v| v.as_str()).unwrap_or("Location not found");
                            
                            let response = LocationResponse {
                                lat: None,
                                lon: None,
                                timestamp: None,
                                success: false,
                                message: message.to_string(),
                            };
                            
                            error!("⚠️ Location not found: {}", message);
                            return Ok(HttpResponse::NotFound().json(response));
                        }
                    } else {
                        error!("❌ Unexpected response format from TEE: {}", output);
                        return Ok(HttpResponse::InternalServerError().json(ApiResponse {
                            success: false,
                            message: "Unexpected response format from TEE".to_string(),
                        }));
                    }
                },
                Err(e) => {
                    error!("❌ Failed to parse TEE response: {} - Raw output: {}", e, output);
                    return Ok(HttpResponse::InternalServerError().json(ApiResponse {
                        success: false,
                        message: format!("Failed to parse TEE response: {}", e),
                    }));
                }
            }
        },
        Err(e) => {
            error!("❌ Failed to communicate with Enarx: {}", e);
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
    info!("📥 Received heatmap request for area: [{}, {}] to [{}, {}]", 
        req.min_lat, req.min_lon, req.max_lat, req.max_lon);
    
    // Ensure process is running
    info!("🔄 Starting/checking Enarx process");
    if let Err(e) = enarx_process.start_process().await {
        error!("❌ Failed to start Enarx process: {}", e);
        return Ok(HttpResponse::InternalServerError().json(ApiResponse {
            success: false,
            message: format!("Failed to start Enarx process: {}", e),
        }));
    }
    
    // Prepare command
    info!("🔧 Preparing heatmap generation command");
    let command = serde_json::json!({
        "GenerateHeatmap": {
            "min_lat": req.min_lat,
            "min_lon": req.min_lon,
            "max_lat": req.max_lat,
            "max_lon": req.max_lon
        }
    });
    
    // Send command to process
    info!("📤 Sending heatmap command to Enarx process");
    match enarx_process.send_command(command.to_string()).await {
        Ok(output) => {
            info!("📩 Received TEE response: {}", output);
            
            // Parse the response
            info!("🔍 Parsing TEE response");
            match serde_json::from_str::<serde_json::Value>(&output) {
                Ok(response) => {
                    if let Some(heatmap) = response.get("Heatmap") {
                        let grid_cells = match heatmap.get("grid_cells") {
                            Some(cells) => {
                                let mut result = Vec::new();
                                
                                if let Some(cells_array) = cells.as_array() {
                                    for cell in cells_array {
                                        if let (Some(lat), Some(lon), Some(value)) = (
                                            cell.get("lat").and_then(|v| v.as_f64()),
                                            cell.get("lon").and_then(|v| v.as_f64()),
                                            cell.get("value").and_then(|v| v.as_u64())
                                        ) {
                                            result.push(HeatmapCell {
                                                lat,
                                                lon,
                                                value: value as u32,
                                            });
                                        }
                                    }
                                }
                                
                                result
                            },
                            None => Vec::new()
                        };
                        
                        let max_value = heatmap.get("max_value")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0) as u32;
                            

                        
                        let cell_count = grid_cells.len();
                        info!("✅ Heatmap generated with {} cells, max value: {}", cell_count, max_value);
                        
                        let response = HeatmapResponse {
                            grid_cells,
                            max_value,
                            success: true,
                            message: "Heatmap generated successfully".to_string(),
                        };
                        return Ok(HttpResponse::Ok().json(response));
                    } else {
                        error!("❌ Unexpected response format from TEE: {}", output);
                        return Ok(HttpResponse::InternalServerError().json(ApiResponse {
                            success: false,
                            message: "Unexpected response format from TEE".to_string(),
                        }));
                    }
                },
                Err(e) => {
                    error!("❌ Failed to parse TEE response: {} - Raw output: {}", e, output);
                    return Ok(HttpResponse::InternalServerError().json(ApiResponse {
                        success: false,
                        message: format!("Failed to parse TEE response: {}", e),
                    }));
                }
            }
        },
        Err(e) => {
            error!("❌ Failed to communicate with Enarx: {}", e);
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
    info!("📥 Received visit analytics request for location: [{}, {}]", req.lat, req.lon);
    
    // Ensure process is running
    info!("🔄 Starting/checking Enarx process");
    if let Err(e) = enarx_process.start_process().await {
        error!("❌ Failed to start Enarx process: {}", e);
        return Ok(HttpResponse::InternalServerError().json(ApiResponse {
            success: false,
            message: format!("Failed to start Enarx process: {}", e),
        }));
    }
    
    // Prepare command
    info!("🔧 Preparing visit analytics command");
    let command = serde_json::json!({
        "GetVisitAnalytics": {
            "lat": req.lat,
            "lon": req.lon
        }
    });
    
    // Send command to process
    info!("📤 Sending visit analytics command to Enarx process");
    match enarx_process.send_command(command.to_string()).await {
        Ok(output) => {
            info!("📩 Received TEE response: {}", output);
            
            // Parse the response
            info!("🔍 Parsing TEE response");
            match serde_json::from_str::<serde_json::Value>(&output) {
                Ok(response) => {
                    if let Some(analytics) = response.get("VisitAnalytics") {
                        if let (
                            Some(_location),
                            Some(visits_24h),
                            Some(unique_visitors_24h),
                            Some(peak_hour)
                        ) = (
                            analytics.get("location"),
                            analytics.get("visits_24h").and_then(|v| v.as_u64()),
                            analytics.get("unique_visitors_24h").and_then(|v| v.as_u64()),
                            analytics.get("peak_hour").and_then(|v| v.as_u64())
                        ) {
                            let response = VisitAnalyticsResponse {
                                lat: req.lat,
                                lon: req.lon,
                                visits_24h: visits_24h as u32,
                                unique_visitors_24h: unique_visitors_24h as u32,
                                peak_hour: peak_hour as u32,
                                success: true,
                                message: "Visit analytics generated successfully".to_string(),
                            };
                            
                            info!("✅ Visit analytics generated: visits_24h={}, unique_visitors_24h={}, peak_hour={}", 
                                visits_24h, unique_visitors_24h, peak_hour);
                            return Ok(HttpResponse::Ok().json(response));
                        } else {
                            error!("❌ Incomplete analytics data in TEE response: {}", output);
                            return Ok(HttpResponse::InternalServerError().json(ApiResponse {
                                success: false,
                                message: "Incomplete analytics data in TEE response".to_string(),
                            }));
                        }
                    } else {
                        error!("❌ Unexpected response format from TEE: {}", output);
                        return Ok(HttpResponse::InternalServerError().json(ApiResponse {
                            success: false,
                            message: "Unexpected response format from TEE".to_string(),
                        }));
                    }
                },
                Err(e) => {
                    error!("❌ Failed to parse TEE response: {} - Raw output: {}", e, output);
                    return Ok(HttpResponse::InternalServerError().json(ApiResponse {
                        success: false,
                        message: format!("Failed to parse TEE response: {}", e),
                    }));
                }
            }
        },
        Err(e) => {
            error!("❌ Failed to communicate with Enarx: {}", e);
            return Ok(HttpResponse::InternalServerError().json(ApiResponse {
                success: false,
                message: format!("Failed to communicate with Enarx: {}", e),
            }));
        }
    }
}

async fn health_check() -> impl Responder {
    info!("Received health check request");
    HttpResponse::Ok().json(ApiResponse {
        success: true,
        message: "TEE Location Services API is running".to_string(),
    })
}

// New debug endpoint to check Enarx process status
async fn debug_enarx_status(enarx_process: web::Data<Arc<EnarxProcess>>) -> Result<HttpResponse, Error> {
    info!("📥 Received debug status request");
    
    // Check if Enarx process is running
    let status = {
        let child_lock = enarx_process.child.lock().unwrap();
        if child_lock.is_some() {
            "running"
        } else {
            "not running"
        }
    };
    
    // Try to send a simple command to check TEE responsiveness
    let tee_status = if status == "running" {
        info!("🔍 Testing TEE responsiveness with Help command");
        match enarx_process.send_command(r#"{"Help": null}"#.to_string()).await {
            Ok(_output) => {
                info!("✅ TEE responded to Help command");
                "responsive"
            },
            Err(e) => {
                error!("❌ TEE failed to respond to Help command: {}", e);
                "unresponsive"
            }
        }
    } else {
        "unknown"
    };
    
    // Return debug information
    info!("📊 Enarx status: {}, TEE status: {}", status, tee_status);
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "enarx_process": status,
        "tee_status": tee_status,
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    })))
}

// Test endpoint to send a custom command to the TEE
async fn debug_send_command(
    enarx_process: web::Data<Arc<EnarxProcess>>,
    req: web::Json<serde_json::Value>
) -> Result<HttpResponse, Error> {
    info!("📥 Received debug command request: {}", serde_json::to_string(&req.0).unwrap_or_default());
    
    // Ensure process is running
    info!("🔄 Starting/checking Enarx process");
    if let Err(e) = enarx_process.start_process().await {
        error!("❌ Failed to start Enarx process: {}", e);
        return Ok(HttpResponse::InternalServerError().json(ApiResponse {
            success: false,
            message: format!("Failed to start Enarx process: {}", e),
        }));
    }
    
    // Send raw command to TEE
    let command = serde_json::to_string(&req.0).unwrap_or_default();
    info!("📤 Sending debug command to TEE: {}", command);
    
    match enarx_process.send_command(command).await {
        Ok(output) => {
            info!("📩 Received TEE response: {}", output);
            
            // Try to parse as JSON for nice formatting
            match serde_json::from_str::<serde_json::Value>(&output) {
                Ok(json_response) => {
                    Ok(HttpResponse::Ok().json(serde_json::json!({
                        "success": true,
                        "raw_response": output,
                        "parsed_response": json_response
                    })))
                },
                Err(_) => {
                    // Return raw output if not valid JSON
                    Ok(HttpResponse::Ok().json(serde_json::json!({
                        "success": true,
                        "raw_response": output
                    })))
                }
            }
        },
        Err(e) => {
            error!("❌ Failed to communicate with Enarx: {}", e);
            Ok(HttpResponse::InternalServerError().json(ApiResponse {
                success: false,
                message: format!("Failed to communicate with Enarx: {}", e),
            }))
        }
    }
}

#[actix_web::main]
async fn main() -> io::Result<()> {
    // Set default log level to debug to get more detailed logs
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("debug"));
    
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
            // Add debug endpoints
            .route("/debug/status", web::get().to(debug_enarx_status))
            .route("/debug/command", web::post().to(debug_send_command))
    })
    .bind(("0.0.0.0", 8080))?
    .run()
    .await
} 