mod auth;
mod db;
mod duration;
mod error;
mod models;
mod routes;

use axum::extract::DefaultBodyLimit;
use axum::middleware;
use axum::routing::{get, post};
use axum::Router;
use clap::{Parser, Subcommand};
use std::sync::Arc;
use tower_http::cors::CorsLayer;

use crate::db::Db;
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
        #[arg(long, default_value = "durationapi.db")]
        db_path: String,
    },
    /// Create a new API key
    CreateKey {
        #[arg(short, long)]
        name: String,
        #[arg(long, default_value = "durationapi.db")]
        db_path: String,
    },
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let cli = Cli::parse();

    match cli.command {
        Some(Commands::CreateKey { name, db_path }) => {
            let db = Db::new(&db_path).expect("Failed to open database");
            let key = db.create_api_key(&name).expect("Failed to create API key");
            println!("Created API key for '{name}': {key}");
        }
        Some(Commands::Serve { port, db_path }) => {
            start_server(port, &db_path).await;
        }
        None => {
            start_server(3000, "durationapi.db").await;
        }
    }
}

async fn start_server(port: u16, db_path: &str) {
    let db = Arc::new(Db::new(db_path).expect("Failed to open database"));
    let http_client = reqwest::Client::new();
    let state = Arc::new(AppState {
        db: db.clone(),
        http_client,
    });

    let authed_routes = Router::new()
        .route("/duration", post(routes::duration_json))
        .route("/duration/upload", post(routes::duration_multipart))
        .layer(middleware::from_fn_with_state(
            db.clone(),
            auth::auth_middleware,
        ));

    let app = Router::new()
        .route("/health", get(routes::health))
        .merge(authed_routes)
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
