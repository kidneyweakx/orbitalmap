use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use actix_cors::Cors;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use oyster_rewards::{
    Location, HeatmapRequest, VisitAnalyticsRequest,
    register_location, get_location, generate_heatmap, generate_visit_analytics
};

// State to be shared across API handlers
struct AppState {
    api_version: String,
}

// API info response
#[derive(Serialize)]
struct ApiInfo {
    version: String,
    name: String,
    status: String,
}

// Routes handlers
async fn health_check() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "message": "Service is healthy"
    }))
}

async fn get_api_info(data: web::Data<AppState>) -> impl Responder {
    let info = ApiInfo {
        version: data.api_version.clone(),
        name: "Oyster Rewards API".to_string(),
        status: "running".to_string(),
    };
    
    HttpResponse::Ok().json(info)
}

async fn register_location_handler(
    location: web::Json<Location>,
) -> impl Responder {
    match register_location(location.into_inner()) {
        response if response.success => {
            HttpResponse::Created().json(response)
        },
        response => {
            HttpResponse::BadRequest().json(response)
        }
    }
}

async fn get_location_handler(
    path: web::Path<String>,
) -> impl Responder {
    let encrypted_id = path.into_inner();
    
    match get_location(&encrypted_id) {
        Ok(location) => {
            HttpResponse::Ok().json(location)
        },
        Err(error) => {
            HttpResponse::NotFound().json(serde_json::json!({
                "success": false,
                "message": error
            }))
        }
    }
}

async fn generate_heatmap_handler(
    req: web::Json<HeatmapRequest>,
) -> impl Responder {
    let heatmap = generate_heatmap(&req);
    HttpResponse::Ok().json(heatmap)
}

async fn generate_analytics_handler(
    req: web::Json<VisitAnalyticsRequest>,
) -> impl Responder {
    let analytics = generate_visit_analytics(&req);
    HttpResponse::Ok().json(analytics)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize environment
    dotenv::dotenv().ok();
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));
    
    // Configure host and port
    let host = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse::<u16>()
        .expect("PORT must be a number");
    
    log::info!("Starting server at {}:{}", host, port);
    
    // Create shared state
    let app_state = web::Data::new(AppState {
        api_version: "1.0.0".to_string(),
    });
    
    // Start HTTP server
    HttpServer::new(move || {
        // Configure CORS
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);
        
        App::new()
            .wrap(cors)
            .wrap(actix_web::middleware::Logger::default())
            .app_data(app_state.clone())
            // API routes
            .route("/", web::get().to(get_api_info))
            .route("/health", web::get().to(health_check))
            .service(
                web::scope("/api/v1")
                    .route("/locations", web::post().to(register_location_handler))
                    .route("/locations/{id}", web::get().to(get_location_handler))
                    .route("/heatmap", web::post().to(generate_heatmap_handler))
                    .route("/analytics", web::post().to(generate_analytics_handler))
            )
    })
    .bind((host, port))?
    .run()
    .await
} 