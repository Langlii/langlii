// Get the HTML elements
const joinBtn = document.getElementById("join-btn");
const regionSelect = document.getElementById("region-select");
const usernameInput = document.getElementById("username");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const messagesDiv = document.getElementById("messages");
const locationDiv = document.getElementById("coords");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

// Login elements
const loginBtn = document.getElementById("login-btn");
const loginMethodSelect = document.getElementById("login-method");
const emailLogin = document.getElementById("email-login");
const phoneLogin = document.getElementById("phone-login");
const googleLogin = document.getElementById("google-login");
const icloudLogin = document.getElementById("icloud-login");
const emailInput = document.getElementById("email");
const phoneInput = document.getElementById("phone");

// Create socket connection
const socket = io();

// Store user information
let username = "";
let currentRegion = "";
let peerConnection = null;
let localStream = null;

// Show the correct login method based on selection
loginMethodSelect.addEventListener("change", (e) => {
  const selectedMethod = e.target.value;
  emailLogin.style.display = selectedMethod === "email" ? "block" : "none";
  phoneLogin.style.display = selectedMethod === "phone" ? "block" : "none";
  googleLogin.style.display = selectedMethod === "google" ? "block" : "none";
  icloudLogin.style.display = selectedMethod === "icloud" ? "block" : "none";
});

// Handle "Login" button click
loginBtn.addEventListener("click", () => {
  const selectedMethod = loginMethodSelect.value;
  
  if (selectedMethod === "email" && emailInput.value) {
    // Proceed with email login
    username = emailInput.value;
    proceedToChat();
  } else if (selectedMethod === "phone" && phoneInput.value) {
    // Proceed with phone login
    username = phoneInput.value;
    proceedToChat();
  } else if (selectedMethod === "google") {
    // Google login logic (replace with actual login functionality)
    username = "google_user";
    proceedToChat();
  } else if (selectedMethod === "icloud") {
    // iCloud login logic (replace with actual login functionality)
    username = "icloud_user";
    proceedToChat();
  } else {
    alert("Please provide a valid input.");
  }
});

// Proceed to the chat interface after login
function proceedToChat() {
  // Hide login form and show the region and username form
  document.getElementById("login-form").style.display = "none";
  document.getElementById("join-form").style.display = "block";
}

// Handle "Join Region" button click
joinBtn.addEventListener("click", () => {
  currentRegion = regionSelect.value;
  
  if (!username) {
    alert("Please enter a username.");
    return;
  }

  // Send region and username to server
  socket.emit("join-region", { username, region: currentRegion });
  
  // Hide join form and show chat interface
  document.getElementById("join-form").style.display = "none";
  document.getElementById("videos").style.display = "block";
  document.getElementById("chat").style.display = "block";
  document.getElementById("location").style.display = "block";
  
  // Initialize WebRTC
  startVideo();
});

// Handle incoming "match-found" event
socket.on("match-found", ({ id, username }) => {
  console.log(`Matched with ${username} (ID: ${id})`);

  // Create peer connection
  peerConnection = new RTCPeerConnection();
  
  // Handle incoming ICE candidates
  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit("candidate", { candidate: event.candidate, target: id });
    }
  };

  // Handle incoming video stream
  peerConnection.ontrack = event => {
    remoteVideo.srcObject = event.streams[0];
  };

  // Add local stream to the peer connection
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  // Create an offer to connect
  createOffer(id);
});

// Start video capture (WebRTC)
async function startVideo() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStream = stream;
    localVideo.srcObject = stream;
  } catch (err) {
    console.error("Error accessing media devices:", err);
  }
}

// Create offer to send to the peer
async function createOffer(targetId) {
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Send offer to the peer
    socket.emit("offer", { sdp: offer, target: targetId });
  } catch (err) {
    console.error("Error creating offer:", err);
  }
}

// Handle incoming offer
socket.on("offer", async (data) => {
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit("answer", { sdp: answer, target: data.from });
  } catch (err) {
    console.error("Error handling offer:", err);
  }
});

// Handle incoming answer
socket.on("answer", async (data) => {
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
  } catch (err) {
    console.error("Error handling answer:", err);
  }
});

// Send chat message
sendBtn.addEventListener("click", () => {
  const message = messageInput.value;
  if (message.trim() !== "") {
    socket.emit("chat", { msg: message, target: peerConnection?.id, from: username });
    const messageElement = document.createElement("div");
    messageElement.textContent = `You: ${message}`;
    messagesDiv.appendChild(messageElement);
    messageInput.value = "";
  }
});

// Send location update
if (navigator.geolocation) {
  navigator.geolocation.watchPosition(position => {
    const coords = position.coords;
    socket.emit("location", { coords, from: username });
  });
}

// Handle incoming location updates
socket.on("location", data => {
  const locationElement = document.createElement("div");
  locationElement.textContent = `${data.from}'s location: Lat ${data.coords.latitude}, Lon ${data.coords.longitude}`;
  messagesDiv.appendChild(locationElement);
});

// Handle socket disconnect
socket.on("disconnect", () => {
  console.log("Disconnected from server.");
});
``