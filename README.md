# webrtc-signal

A signal server for WebRTC clients.

## Details

This server is used for signal WebRTC clients. During the early steps of this project this server might expose some REST APIs for development needs.

### Requirements

* NodeJS (preferred v8 and up)
* Docker and docker-compose tools
* Parcel module bundler for test client

### Stack

* Restify (might get removed later)
* socket.io as WebSocket server

## Running the project

### Development environment

**In project root:**

1. Install Parcel: `sudo npm install -g parcel`
2. Build the server container: `docker-compose build`
3. Run the container: `docker-compose up`
    * With `-d` flag for running in background
4. For testing browser client, open another terminal window (if needed) and `cd` to `testclient` and run `parcel index.html`
    * As you can see, the client will be available at `http://localhost:1234`

### Tests

To run tests, install dependencies (see Development environment) and run `docker-compose -f docker-compose.test.yml up` to watch the files and run tests continously when changes detected.
