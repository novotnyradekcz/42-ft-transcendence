// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved.

use actix_ws::{Session, Message};
use actix_web::{HttpRequest, HttpResponse, Error};

pub trait WebSocketHandler: Send + 'static {
    fn on_connect(&mut self, session: &mut Session) -> impl std::future::Future<Output = ()> + Send;
    fn on_message(&mut self, session: &mut Session, msg: Message) -> impl std::future::Future<Output = Result<(), Error>> + Send;
    fn on_close(&mut self, session: &mut Session) -> impl std::future::Future<Output = ()> + Send;
}

pub async fn start_websocket_handler<H>(
    req: HttpRequest,
    stream: actix_web::web::Payload,
    handler: H,
) -> Result<HttpResponse, Error>
where
    H: WebSocketHandler + 'static,
{
    let (response, mut session, mut msg_stream) = actix_ws::handle(&req, stream)?;
    
    actix_web::rt::spawn(async move {
        let mut handler = handler;
        handler.on_connect(&mut session).await;
        
        while let Some(res) = msg_stream.recv().await {
            match res {
                Ok(msg) => match msg {
                    Message::Ping(bytes) => {
                        if session.pong(&bytes).await.is_err() {
                            break;
                        }
                    }
                    Message::Close(_) => {
                        break;
                    }
                    other => {
                        if handler.on_message(&mut session, other).await.is_err() {
                            break;
                        }
                    }
                },
                Err(_) => break,
            }
        }
        
        handler.on_close(&mut session).await;
    });

    Ok(response)
}
