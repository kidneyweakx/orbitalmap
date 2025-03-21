use actix_cors::Cors;
use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::io::{self, Write};
use log::{info, error};

#[derive(Debug, Serialize, Deserialize)]
struct FibRequest {
    n: u32,
}

#[derive(Debug, Serialize, Deserialize)]
struct FibResponse {
    input: u32,
    result: u32,
    success: bool,
    message: String,
}

async fn calculate_fibonacci(req: web::Json<FibRequest>) -> impl Responder {
    info!("Received request to calculate Fibonacci for n={}", req.n);
    
    let output = Command::new("enarx")
        .arg("run")
        .arg("/app/tee-rewards.wasm")
        .arg(req.n.to_string())
        .output();
        
    match output {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            
            info!("Enarx stdout: {}", stdout);
            if !stderr.is_empty() {
                error!("Enarx stderr: {}", stderr);
            }
            
            // Parse the result from the output
            // The expected format is "Fibonacci sequence number at index X is Y"
            let result = stdout.lines()
                .filter_map(|line| {
                    if line.contains("Fibonacci sequence number at index") {
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if parts.len() >= 8 {
                            return parts[7].parse::<u32>().ok();
                        }
                    }
                    None
                })
                .next();
                
            match result {
                Some(fib_number) => {
                    HttpResponse::Ok().json(FibResponse {
                        input: req.n,
                        result: fib_number,
                        success: true,
                        message: "Fibonacci calculated successfully".to_string(),
                    })
                },
                None => {
                    HttpResponse::InternalServerError().json(FibResponse {
                        input: req.n,
                        result: 0,
                        success: false,
                        message: "Failed to parse Fibonacci result".to_string(),
                    })
                }
            }
        },
        Err(e) => {
            error!("Failed to execute Enarx: {}", e);
            HttpResponse::InternalServerError().json(FibResponse {
                input: req.n,
                result: 0,
                success: false,
                message: format!("Failed to execute Enarx: {}", e),
            })
        }
    }
}

async fn health_check() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "up",
        "message": "Service is running"
    }))
}

#[actix_web::main]
async fn main() -> io::Result<()> {
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));
    
    info!("Starting web server at http://0.0.0.0:8080");
    
    HttpServer::new(|| {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header();
            
        App::new()
            .wrap(cors)
            .route("/health", web::get().to(health_check))
            .route("/fibonacci", web::post().to(calculate_fibonacci))
    })
    .bind(("0.0.0.0", 8080))?
    .run()
    .await
} 