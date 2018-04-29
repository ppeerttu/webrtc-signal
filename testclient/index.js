/**
 * A client for testing socket.io server features quickly
 * Run with parcel by `parcel index.html`
 *
 * NOTE: Parcel not included in project dependencies since
 * this client will be removed after server is more mature
 */
const io = require('socket.io-client');

const socket = io('http://localhost:8080', {
  path: '/signal'
});

socket.on('connect', () => {
  console.log('connection open!');
});

function onClick(id, fn) {
  let elem = document.getElementById(id);
  if (elem) {
    console.log('her');
    elem.addEventListener('click', fn);
  }
}

// Quick and dirty way out of DOM ready event listener
setTimeout(() => {
  onClick('send', () => {
    console.log('hss');
    let type = document.getElementById('msg-type');
    let msg = document.getElementById('msg');
    socket.emit(type.value, { message: msg.value });
  });
}, 1000);
