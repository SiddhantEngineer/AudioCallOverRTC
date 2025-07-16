const socket = io();
const peer = new RTCPeerConnection({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
});

let localStream;
let remoteStream = new MediaStream();
let isCaller = false;
let candidateQueue = [];
let remoteDescriptionSet = false;

const roomInput = document.getElementById("roomInput");
const joinBtn = document.getElementById("joinBtn");
const statusText = document.getElementById("status");
const myVideo = document.getElementById("me");
const peerVideo = document.getElementById("peer");

joinBtn.onclick = async () => {
  const room = roomInput.value;
  if (!room) return alert("Enter a room ID");

  try {
    // Use getUserMedia instead of getDisplayMedia for compatibility
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    myVideo.srcObject = localStream;
    localStream
      .getTracks()
      .forEach((track) => peer.addTrack(track, localStream));
  } catch (err) {
    alert("Error accessing media: " + err.message);
    console.error(err);
    return;
  }

  socket.emit("join", room);
  statusText.textContent = "Joining room...";
};

socket.on("created", () => {
  isCaller = true;
  console.log("Created room, you are the caller.");
});

socket.on("joined", () => {
  console.log("Joined room, you are the callee.");
});

socket.on("ready", async () => {
  if (isCaller) {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit("signal", {
      room: roomInput.value,
      data: { type: "offer", sdp: offer },
    });
  }
});

socket.on("signal", async (data) => {
  console.log("Signal received:", data);

  if (data.type === "offer") {
    await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
    remoteDescriptionSet = true;

    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    socket.emit("signal", {
      room: roomInput.value,
      data: { type: "answer", sdp: answer },
    });

    candidateQueue.forEach((c) => peer.addIceCandidate(c));
    candidateQueue = [];
  } else if (data.type === "answer") {
    await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
    remoteDescriptionSet = true;

    candidateQueue.forEach((c) => peer.addIceCandidate(c));
    candidateQueue = [];
  } else if (data.type === "candidate") {
    const candidate = new RTCIceCandidate(data.candidate);
    if (remoteDescriptionSet) {
      await peer.addIceCandidate(candidate);
    } else {
      candidateQueue.push(candidate);
    }
  }
});

peer.onicecandidate = (event) => {
  if (event.candidate) {
    socket.emit("signal", {
      room: roomInput.value,
      data: { type: "candidate", candidate: event.candidate },
    });
  }
};

peer.ontrack = (event) => {
  console.log("Remote track received:", event.track.kind);
  remoteStream.addTrack(event.track);
  peerVideo.srcObject = remoteStream;
  statusText.textContent = "Call connected!";
};

peer.oniceconnectionstatechange = () => {
  console.log("ICE connection state:", peer.iceConnectionState);
};
