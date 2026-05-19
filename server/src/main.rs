// Copyright (c) 2018, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved.

use actix_web::{web, App, HttpRequest, HttpServer, Responder};
use std::io::Result;
use openssl::ssl::{SslAcceptor, SslFiletype, SslMethod};

#[get("/")]
async fn index(_req: HttpRequest) -> impl Responder {
    "Welcome"
}

#[actix_web::main]
async fn main() -> Result<()> {
    let mut builder = SslAcceptor::mozzila_intermediate(SslMethod::tls()).unwrap();
    builder.set_private_key_file("key.pem", SslFileType).unwrap();
    builder.ssl_certificate_chain_file("cert.pem").unwrap();

    HttpServer::new(|| App::new().service(index)).bind_openssl("127.0.0.1:8080", builder).run().await
}
