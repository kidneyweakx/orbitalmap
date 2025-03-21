use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use serde::{Deserialize, Serialize};
use rand::Rng;

#[derive(Deserialize)]
struct Location {
    latitude: f64,
    longitude: f64,
}

#[derive(Serialize)]
struct Reward {
    emoji: String,
    value: u32,
}

fn generate_reward() -> Reward {
    let mut rng = rand::thread_rng();
    let reward_tiers = [("🔥", 100), ("⭐️", 50), ("🍀", 10)];
    let (emoji, value) = reward_tiers[rng.gen_range(0..reward_tiers.len())]; 
    Reward { emoji: emoji.to_string(), value }
}

async fn handle_location(loc: web::Json<Location>) -> impl Responder {
    let reward = generate_reward();
    HttpResponse::Ok().json(reward)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| App::new().route("/reward", web::post().to(handle_location)))
        .bind("0.0.0.0:8080")?
        .run()
        .await
}
