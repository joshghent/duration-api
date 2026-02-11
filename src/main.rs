mod duration;
mod error;
mod models;
mod routes;

use axum::extract::DefaultBodyLimit;
use axum::routing::{get, post};
use axum::Router;
use clap::{Parser, Subcommand};
use std::sync::Arc;
use tower_http::cors::CorsLayer;

use crate::routes::AppState;

#[derive(Parser)]
#[command(name = "durationapi", about = "Duration extraction micro API")]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Start the API server (default)
    Serve {
        #[arg(short, long, default_value = "3000")]
        port: u16,
    },
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let cli = Cli::parse();

    match cli.command {
        Some(Commands::Serve { port }) => {
            start_server(port).await;
        }
        None => {
            start_server(3000).await;
        }
    }
}

async fn start_server(port: u16) {
    let http_client = reqwest::Client::new();
    let state = Arc::new(AppState { http_client });

    let app = Router::new()
        .route("/health", get(routes::health))
        .route("/duration", post(routes::duration_json))
        .route("/duration/upload", post(routes::duration_multipart))
        .layer(CorsLayer::permissive())
        .layer(DefaultBodyLimit::max(500 * 1024 * 1024)) // 500MB
        .with_state(state);

    let addr = format!("0.0.0.0:{port}");
    tracing::info!("Starting server on {addr}");
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("Failed to bind");
    println!("Server running on http://{addr}");
    axum::serve(listener, app).await.expect("Server failed");
}
