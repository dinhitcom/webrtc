'use strict';
// TODO: check room exist
let isChannelReady = false;
let isInitiator = false;
let isStarted = false;
let isCameraOn = false;
let isMicroOn = false;
let pc;
let turnReady;

let offerOptions = {
    offerToReceiveVideo: 1,
    offerToReceiveAudio: 1,
}

let pcConfig = {
  'iceServers': [{
    'urls': 'stun:stun.l.google.com:19302'
  }]
};

let room = prompt('Enter room name: ');
let socket = io.connect();

if (room !== '') {
  socket.emit('create or join', room);
}

socket.on('created', room => {
  isInitiator = true;
});

socket.on('full', room => {
  console.log('Room ' + room + ' is full');
});

socket.on('join', room => {
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
});

socket.on('joined', room => {
  isChannelReady = true;
})

socket.on('log', array => {
  console.log.apply(console, array);
})

function sendMessage(message) {
  socket.emit('message', message);
}

socket.on('message', message => {
  if (message === 'got user media') {
    maybeStart();
  } else if (message.type === "offer") {
    if (!isInitiator && !isStarted) {
      maybeStart();
    }
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate' && isStarted) {
    let candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    pc.addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});

let localVideo = document.getElementById('localVideo');
let remoteVideo = document.getElementById('presenterVideo');

let localStream;
let remoteStream;
let localPeerConnection;
let remotePeerConnection;

function gotLocalMediaStream(mediaStream) {
  localStream = mediaStream;
  localVideo.srcObject = mediaStream;
  isCameraOn = true;
  isMicroOn = true;
  sendMessage('got user media');
  if (isInitiator) {
    maybeStart();
  }
}

function handleLocalMediaStreamError(error) {
  console.log('navigator.getUserMedia error: ', error);
}

const mediaStreamConstraints = {
  video: true,
  audio: {
    echoCancellation: true,
    noiseSuppression: true
  },
};

navigator.mediaDevices.getUserMedia(mediaStreamConstraints)
  .then(gotLocalMediaStream).catch(handleLocalMediaStreamError);

if (location.hostname !== 'localhost') {
  requestTurn();
}

function maybeStart() {
  if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
    createPeerConnection();
    pc.addStream(localStream);
    isStarted = true;
    if (isInitiator) {
      doCall();
    }
  }
}

window.onbeforeunload = () => {
  sendMessage('bye');
}

function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(null);
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

function handleIceCandidate(event) {
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  }
}

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function doCall() {
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
  pc.createAnswer().then(setLocalAndSendMessage, onCreateSessionDescriptionError);
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  sendMessage(sessionDescription);
}

function onCreateSessionDescriptionError(error) {
  console.log('Failed to create session description: ' + error);
}

function requestTurn() {
  var turnExists = false;
  for (var i in pcConfig.iceServers) {
    if (pcConfig.iceServers[i].urls.substr(0, 5) === 'turn:') {
      turnExists = true;
      turnReady = true;
      break;
    }
  }
  if (!turnExists) {
    let xhr = new XMLHttpRequest();
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4 && xhr.status === 200) {
        let res = JSON.parse(xhr.responseText);
        console.log('Got TURN server response: ', res);
        pcConfig.iceServers.push({
          'urls': 'turn:' + turnServer.username + '@' + turnServer.turn,
          'credential': turnServer.password
        });
        turnReady = true;
      }
    };
    xhr.open("PUT", "https://global.xirsys.net/_turn/RTCMeet", true);
    xhr.setRequestHeader("Authorization", "Basic " + btoa("dinhit:91128eba-45bd-11eb-8a6a-0242ac150002"));
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send( JSON.stringify({"format": "urls"}) );
  }
}

function handleRemoteStreamAdded(event) {
  remoteStream = event.stream;
  remoteVideo.srcObject = remoteStream;
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

function hangup() {
  stop();
  sendMessage('bye');
}

function handleRemoteHangup() {
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  pc.close();
  pc = null;
}
// function setRemoteMediaStream(event) {
//     const mediaStream = event.stream;
//     remoteVideo.srcObject = mediaStream;
//     remoteStream = mediaStream;
// }


////////////////////////////
function changeVideoState(stream) {
  stream.getVideoTracks().forEach(track => {
    track.enabled = !isCameraOn;
    isCameraOn = !isCameraOn;
  });
  return isCameraOn;
}

function changeAudioState(stream) {
  stream.getAudioTracks().forEach(track => {
    track.enabled = !isMicroOn;
    isMicroOn = !isMicroOn;
  });
  return isMicroOn;
}

$('#camera').click(() => {
  let $this = $(this);
  if (changeVideoState(localStream) === true) {
    $('#camera').html(`<i class="fal fa-video"></i>`);
    $('#camera').prop('title', 'Turn off camera');
  } else {
    $('#camera').html(`<i class="fal fa-video-slash"></i>`);
    $('#camera').prop('title', 'Turn on camera');
  } 
  
});

$('#microphone').click(() => {
  let $this = $(this);
  if (changeAudioState(localStream) === true) {
    $('#microphone').html(`<i class="fal fa-microphone"></i>`);
    $('#microphone').prop('title', 'Mute microphone');
  } else {
    $('#microphone').html(`<i class="fal fa-microphone-slash"></i>`);
    $('#microphone').prop('title', 'Umute microphone');
  }

})

$('microphone').click(() => {
  hangup();
})

// document.getElementById('camera').addEventListener('click', )