/**
 * A client for testing socket.io server features quickly
 * Run with parcel by `parcel index.html`
 *
 * NOTE: Parcel not included in project dependencies since
 * this client will be removed after the server is more mature
 */
const io = require('socket.io-client');
const REST_API = 'http://localhost:8080';

let socket = null;

let caller = {};
let onCall = false;
let myUname, myConnection, constraints, stream, loggedIn = false;

// constraints for desktop browser
const desktopConstraints = {
  video: {
    mandatory: {
      maxWidth:1200,
      maxHeight:900
    }
  },
  audio: false
};

// constraints for mobile browser
const mobileConstraints = {
  video: {
    mandatory: {
      maxWidth: 480,
      maxHeight: 320,
      facingMode: 'environment'
    }
  },
  audio: true
};

// if a user is using a mobile browser
if (/Android|iPhone|iPad/i.test(navigator.userAgent)) constraints = mobileConstraints;
else constraints = desktopConstraints;


function onClick(id, fn) {
  let elem = document.getElementById(id);

  if (elem) {
    elem.addEventListener('click', fn);
  }
}


// Quick and dirty way out of DOM ready event listener
setTimeout(() => {

  onClick('send', () => {
    let type = document.getElementById('msg-type');
    let msg = document.getElementById('msg');
    socket.emit(type.value, { message: msg.value });
  });

  onClick('init', () => {
    myUname = document.getElementById('my-uname').value;
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    const opts = {
      method: 'POST',
      headers,
      body: JSON.stringify({ username: myUname })
    };
    fetch(`${REST_API}/api/auth`, opts)
      .then(res => res.json())
      .then(data => {
        console.log(data);
        if (data.token) {
          localStorage.setItem('token', data.token);
          socket = io('http://localhost:8080', {
            path: '/signal',
            reconnection: false,
            query: {
              token: data.token
            }
          });
          bindSocketListeners(socket);
        }
      })
      .catch(err => console.error(err));
  });

  onClick('call', () => {
    myConnection.createOffer()
      .then(offer => {
        console.log(offer);

        socket.emit('call', { username: document.getElementById('uname').value, offer });

        myConnection.setLocalDescription(offer);
      })
      .catch(err => console.error(err));
  });

  onClick('answer', () => {
    onCall = true;
    console.log('setting remote description', caller.offer);
    myConnection.setRemoteDescription(new RTCSessionDescription(caller.offer));

    myConnection.createAnswer(answer => {
      myConnection.setLocalDescription(answer);

      socket.emit('answer', { username: caller.username, answer });
    }, (error) => console.error(error));
  });

  onClick('decline', () => {
    if (!onCall) socket.emit('answer', { username: caller.username, answer: false });
    else socket.emit('leave', { username: caller.username });
    onCall = false;
  });


}, 1000);

function addMessage(data) {
  let parent = document.querySelector('.messages');
  let node = document.createTextNode(JSON.stringify(data));
  let p = document.createElement('p');
  p.appendChild(node);
  parent.appendChild(p);
}

function bindSocketListeners(sock) {

  sock.on('connect', () => {
    console.log('connection open!');
    addMessage({ event: 'socketio open' });
  });

  sock.on('users', data => {
    addMessage(data);

    if (!loggedIn) {

      //enabling video and audio channels
      navigator.mediaDevices.getUserMedia(constraints)
        .then(localStream => {
          let localVideo = document.querySelector('#localVideo');
          let configuration = {
            'iceServers': [
              { url:'stun:stun2.1.google.com:19302' }
            ]
          };

          myConnection = new webkitRTCPeerConnection(configuration);
          myConnection.addStream(localStream);


          console.log('RTCPeerConnection object was created');
          console.log(myConnection);


          myConnection.onaddstream = e => {
            console.log('add stream', e);
            let remoteVideo = document.querySelector('#remoteVideo');
            remoteVideo.srcObject = e.stream;
            remoteVideo.style.display = 'block';

            remoteVideo.onloadedmetadata = (e) => {
              console.log('loaded meta data', e);
              remoteVideo.play();
            };

          };

          myConnection.onicecandidate = (event) => {
            console.log('candidate', event);
            if (event.candidate) sock.emit('candidate', { username: caller.username, candidate: event.candidate });
          };
           //inserting our stream to the video tag
          localVideo.srcObject = localStream;
          localVideo.style.display = 'block';
        })
        .catch(err => console.error(err));
    }
    loggedIn = true;
  });

  sock.on('call', data => {
    addMessage(data);
    caller = data;
    onCall = true;
    /*
    console.log('setting remote description', caller.offer);
    myConnection.setRemoteDescription(new RTCSessionDescription(caller.offer));

    myConnection.createAnswer(answer => {
      myConnection.setLocalDescription(answer);

      sock.emit('answer', { username: caller.username, answer });
    }, (error) => console.error(error));
    */
  });

  sock.on('answer', data => {
    if (data.answer) {
      onCall = true;
      console.log('setting remote description', data.answer);
      myConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      caller = data;
    } else onCall = false;
    addMessage(data);
  });

  sock.on('candidate', data => {
    console.log('RECEIVED CANDIDATE', data);
    addMessage(data);
    myConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
  });

  sock.on('decline', data => {
    addMessage(data);
  });

  sock.on('leave', data => {
    addMessage('leave');
  });
}
