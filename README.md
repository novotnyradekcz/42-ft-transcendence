# 42-ft-transcendence


## Install rust 1.95 via rustup

if not available rustup on your computer, install it:
```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

override or set default rustc 1.95 compiler:

override in server directory: 
```
cd ~/paht/to/ft_transcendence/server
ustup override set 1.95
```

set default on whole computer:
```
rustup override set 1.95
```

## Compile and run server
```
cd ~/paht/to/ft_transcendence/server
cargo build && ./target/debug/server
```

## Access server from browser
Now you can open the main page, which is only `200 Ok` response from the server. Open browser and type in url:
```
127.0.0.1:8080
```
