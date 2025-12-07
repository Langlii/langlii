const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const Web3 = require("web3");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Setup Web3 (connect to Ethereum node)
const web3 = new Web3("https://ropsten.infura.io/v3/YOUR_INFURA_PROJECT_ID"); // Replace with your Infura/Alchemy node URL
const contractABI = [ /* Your Contract ABI here */ ]; // Copy the ABI from your compiled contract
const contractAddress = "0xYourContractAddress"; // Replace with your deployed contract address
const contract = new web3.eth.Contract(contractABI, contractAddress);

// Serve public files
app.use(express.static("public"));

// A map to track all active participants in a group call
const roomParticipants = {};

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // Join a room (group chat)
  socket.on("join-room", ({ username, roomId }) => {
    if (!roomParticipants[roomId]) {
      roomParticipants[roomId] = [];
    }

    roomParticipants[roomId].push({ id: socket.id, username });

    // Notify all participants in the room about a new user
    socket.to(roomId).emit("user-joined", { id: socket.id, username });

    console.log(`User ${username} joined room ${roomId}.`);

    // Send the list of all participants to the new user
    socket.emit("room-participants", roomParticipants[roomId]);

    // When the user disconnects, remove them from the room
    socket.on("disconnect", () => {
      console.log(`User ${username} disconnected.`);
      roomParticipants[roomId] = roomParticipants[roomId].filter(
        (user) => user.id !== socket.id
      );
      socket.broadcast.to(roomId).emit("user-left", { id: socket.id });
    });
  });

  // WebRTC signaling (for video calls)
  socket.on("offer", (data) => {
    socket.to(data.target).emit("offer", { sdp: data.sdp, from: socket.id });
  });
  socket.on("answer", (data) => {
    socket.to(data.target).emit("answer", { sdp: data.sdp, from: socket.id });
  });
  socket.on("candidate", (data) => {
    socket.to(data.target).emit("candidate", { candidate: data.candidate, from: socket.id });
  });

  // Retry logic for blockchain messages in case of network issues
  const sendMessageToBlockchain = async (msg, retries = 3) => {
    try {
      const accounts = await web3.eth.getAccounts();
      await contract.methods.storeMessage(msg.text).send({ from: accounts[0] });
      console.log("Message stored on blockchain:", msg.text);
    } catch (error) {
      console.error("Error storing message on blockchain:", error);
      if (retries > 0) {
        console.log(`Retrying... ${retries} attempts left`);
        setTimeout(() => sendMessageToBlockchain(msg, retries - 1), 5000); // Retry after 5 seconds
      } else {
        console.log("Failed to store message after several attempts.");
      }
    }
  };

  // Chat and blockchain integration
  socket.on("chat", async (msg) => {
    try {
      // Send message to blockchain
      await sendMessageToBlockchain(msg);

      // Emit message via Socket.io for real-time chat
      io.to(msg.target).emit("chat", { msg: msg.text, from: msg.from });
    } catch (error) {
      console.error("Error handling chat message:", error);
    }
  });

  // Handle location sharing (optional)
  socket.on("location", (coords) => {
    io.to(coords.target).emit("location", { coords, from: coords.from });
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
    for (const key in roomParticipants) {
      roomParticipants[key] = roomParticipants[key].filter((u) => u.id !== socket.id);
    }
  });
});

// Start server
server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
