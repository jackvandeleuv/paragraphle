use axum::{
    extract::{Path},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{sync::Arc};
use tokio::sync::Mutex;
use tower_http::cors::{Any, CorsLayer};
use hyper::Method;

#[derive(Serialize)]
struct Suggestion {
    id: i32,
    title: String,
    url: String,
}

#[derive(Deserialize)]
struct SuggestionQuery {
    q: String,
    limit: usize,
}

async fn suggestion(
    Path((q, limit)): Path<(String, usize)>,
    db: Arc<Mutex<Connection>>,
) -> impl IntoResponse {
    let q = q.to_lowercase();
    let mut results = vec![];
    let db = db.lock().await;

    if let Ok(mut stmt) = db.prepare(
        "SELECT e.id, a.title, a.url 
         FROM embeddings e 
         JOIN articles a USING(id) 
         WHERE lower(a.title) LIKE ? 
         ORDER BY a.title ASC 
         LIMIT ?",
    ) {
        let query = format!("{}%", q);
        if let Ok(rows1) = stmt.query_map(params![query, limit], |row| {
            Ok(Suggestion {
                id: row.get(0)?,
                title: row.get(1)?,
                url: row.get(2)?,
            })
        }) {
            results.extend(rows1.filter_map(Result::ok));
        }
    }

    if results.len() >= limit {
        return Json(results);
    }

    let query = format!("%{}%", q);
    if let Ok(mut stmt) = db.prepare(
        "SELECT e.id, a.title, a.url 
         FROM embeddings e 
         JOIN articles a USING(id) 
         WHERE lower(a.title) LIKE ? 
         ORDER BY a.title ASC 
         LIMIT ?",
    ) {
        if let Ok(rows2) = stmt.query_map(params![query, limit], |row| {
            Ok(Suggestion {
                id: row.get(0)?,
                title: row.get(1)?,
                url: row.get(2)?,
            })
        }) {
            results.extend(rows2.filter_map(Result::ok));
        }
    }

    Json(results.into_iter().take(limit).collect::<Vec<_>>())
}

#[tokio::main]
async fn main() {
    // Connect to the SQLite database
    let db = Arc::new(Mutex::new(Connection::open("../data.db").unwrap()));

    let cors = CorsLayer::new()
        .allow_origin(Any) // Allow requests from any origin
        .allow_methods(vec![Method::GET, Method::POST]) // Allow specific HTTP methods
        .allow_headers(Any); // Allow all headers

    // Build the application with routes
    let app = Router::new()
        .route("/suggestion/:q/limit/:limit", get({
            let db = Arc::clone(&db);
            move |path| suggestion(path, Arc::clone(&db))
        }))
        .layer(cors); // Apply the CORS middleware

    // Run the server
    axum::Server::bind(&"127.0.0.1:5000".parse().unwrap())
        .serve(app.into_make_service())
        .await
        .unwrap();
}
