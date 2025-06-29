// Import the User model to interact with user data in the database
import User from "../models/user.model.js";
// Import the Message model to handle message-related database operations
import Message from "../models/message.model.js";

// Import Cloudinary configuration for image uploads
import cloudinary from "../lib/cloudinary.js";
// Import socket utilities to manage real-time communication
import { getReceiverSocketId, io } from "../lib/socket.js";

// Retrieves a list of users for the chat sidebar, excluding the logged-in user
// @route GET /api/users
// @access Private
// @param {Object} req - Express request object containing the authenticated user's ID
// @param {Object} res - Express response object
export const getUsersForSidebar = async (req, res) => {
  try {
    // Get the ID of the currently logged-in user from the request
    const loggedInUserId = req.user._id;
    // Fetch all users from the database, excluding the logged-in user and their password
    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");

    // Respond with the list of users in JSON format with a 200 status code
    res.status(200).json(filteredUsers);
  } catch (error) {
    // Log any errors that occur during the database query
    console.error("Error in getUsersForSidebar: ", error.message);
    // Return a 500 status code with a generic error message
    res.status(500).json({ error: "Internal server error" });
  }
};

// Fetches all messages between the logged-in user and the specified user
// @route GET /api/messages/:id
// @access Private
// @param {Object} req - Express request object containing the authenticated user's ID and the target user's ID
// @param {Object} res - Express response object
export const getMessages = async (req, res) => {
  try {
    // Extract the ID of the user to chat with from the URL parameters
    const { id: userToChatId } = req.params;
    // Get the ID of the currently logged-in user
    const myId = req.user._id;

    // Find all messages where either the sender or receiver is the logged-in user
    // and the other party is the specified user
    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    });

    // Respond with the list of messages in JSON format with a 200 status code
    res.status(200).json(messages);
  } catch (error) {
    // Log any errors that occur during the database query
    console.log("Error in getMessages controller: ", error.message);
    // Return a 500 status code with a generic error message
    res.status(500).json({ error: "Internal server error" });
  }
};

// Sends a new message (text or image) from the logged-in user to the specified receiver
// @route POST /api/messages/:id
// @access Private
// @param {Object} req - Express request object containing the message data and receiver ID
// @param {Object} res - Express response object
export const sendMessage = async (req, res) => {
  try {
    // Extract text and image (if any) from the request body
    const { text, image } = req.body;
    // Extract the receiver's ID from the URL parameters
    const { id: receiverId } = req.params;
    // Get the ID of the currently logged-in user
    const senderId = req.user._id;

    // Initialize variable to store the uploaded image URL
    let imageUrl;
    if (image) {
      // If an image is provided, upload it to Cloudinary and retrieve the secure URL
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    // Create a new message document with sender, receiver, text, and image (if applicable)
    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
    });

    // Save the new message to the database
    await newMessage.save();

    // Get the socket ID of the receiver for real-time notification
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      // Emit the new message to the receiver's socket for real-time delivery
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    // Respond with the newly created message in JSON format with a 201 status code
    res.status(201).json(newMessage);
  } catch (error) {
    // Log any errors that occur during message creation or socket emission
    console.log("Error in sendMessage controller: ", error.message);
    // Return a 500 status code with a generic error message
    res.status(500).json({ error: "Internal server error" });
  }
};
