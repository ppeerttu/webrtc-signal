# webrtc-signal

A signaling server for WebRTC clients.

## Details

This server is used for signaling WebRTC clients. During the early steps of this project this server might expose some REST APIs for development needs.

### Requirements

* NodeJS (preferred v8 and up)
* Docker and docker-compose tools
* Parcel module bundler for test client

### Stack

* Restify (might get removed later)
* socket.io as WebSocket server

## Running the project

Currently only in development environment.

**In project root:**

1. Install Parcel: `sudo npm install -g parcel`
2. Build the server container: `docker-compose build`
3. Run the container: `docker-compose up`
    * With `-d` flag for running in background
4. For test browser client, open another terminal window (if needed) and `cd` to `testclient` and run `parcel index.html`
    * As you can see, the client will be available at `http://localhost:1234`
