use actix_web::{web, App, HttpResponse, HttpServer}
use std::io::Result

#[actix_web::main]
async fn main() -> Result<()> {
    HttpServer::new(|| App::new().route("/", web::get().to(HttpResponse::Ok))).
        .bind(("127.0.0.1", 8080))?
        .run()
        .await
}
