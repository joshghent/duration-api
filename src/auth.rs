use axum::extract::Request;
use axum::http::StatusCode;
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use serde_json::json;
use std::sync::Arc;

use crate::db::Db;

#[derive(Clone)]
pub struct ApiKeyId(pub i64);

pub async fn auth_middleware(
    axum::extract::State(db): axum::extract::State<Arc<Db>>,
    mut req: Request,
    next: Next,
) -> Response {
    let api_key = req
        .headers()
        .get("X-API-Key")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let api_key = match api_key {
        Some(k) => k,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                axum::Json(json!({"error": "Missing X-API-Key header"})),
            )
                .into_response();
        }
    };

    match db.validate_key(&api_key) {
        Ok(Some(key_id)) => {
            req.extensions_mut().insert(ApiKeyId(key_id));
            let response = next.run(req).await;
            // Record usage on successful responses
            if response.status().is_success() {
                let _ = db.record_usage(key_id);
            }
            response
        }
        Ok(None) => (
            StatusCode::UNAUTHORIZED,
            axum::Json(json!({"error": "Invalid API key"})),
        )
            .into_response(),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(json!({"error": "Database error"})),
        )
            .into_response(),
    }
}
