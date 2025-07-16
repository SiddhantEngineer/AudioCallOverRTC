const socket = io();
const peer = new RTCPeerConnection();
let localStream;

const roomInput = document.getElementById("roomInput");
const joinBtn = document.getElementById("joinBtn");
const statusText = document.getElementById("status");
const myVideo = document.getElementById("me");
const peerVideo = document.getElementById("peer");

let candidateQueue = [];
let remoteDescriptionSet = false;

joinBtn.onclick = async () => {
  const room = roomInput.value;
  if (!room) return alert("Enter a room ID");

  socket.emit("join", room);
  statusText.textContent = "Joining room...";

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    localStream
      .getTracks()
      .forEach((track) => peer.addTrack(track, localStream));
  } catch (err) {
    alert("Error accessing camera/mic: " + err.message);
    console.error(err);
    return;
  }

  myVideo.srcObject = localStream;

  socket.on("joined", async () => {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit("signal", { room, data: { type: "offer", sdp: offer } });
    statusText.textContent = "Joined";
  });

  socket.on("signal", async (data) => {
    if (data.type === "offer") {
      await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
      remoteDescriptionSet = true;

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit("signal", { room, data: { type: "answer", sdp: answer } });

      // Apply queued candidates
      candidateQueue.forEach((c) => peer.addIceCandidate(c));
      candidateQueue = [];
    } else if (data.type === "answer") {
      await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
      remoteDescriptionSet = true;

      // Apply queued candidates
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
        room,
        data: { type: "candidate", candidate: event.candidate },
      });
    }
  };

  peer.ontrack = (event) => {
    // const audio = new Audio();
    // audio.srcObject = event.streams[0];
    // audio.play();
    // document.body.appendChild(audio);
    statusText.textContent = "Call connected!";
    console.log(event.streams);

    peerVideo.srcObject = event.streams[0];
  };
};
