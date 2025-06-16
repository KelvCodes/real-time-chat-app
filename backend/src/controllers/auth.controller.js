// Import utility function to generate JWT token
import { generateToken } from "../lib/utils.js";
// Import User model for database interactions
import User from "../models/user.model.js";
// Import bcrypt for password hashing
import bcrypt from "bcryptjs";
// Import Cloudinary for handling image uploads
import cloudinary from "../lib/cloudinary.js";

// Controller for user signup
export const signup = async (req, res) => {
  // Extract fullName, email, and password from request body
  const { fullName, email, password } = req.body;
  try {
    // Validate that all required fields are provided
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Ensure password is at least 6 characters long
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    // Check if a user with the provided email already exists
    const user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Generate a salt for password hashing
    const salt = await bcrypt.genSalt(10);
    // Hash the password with the generated salt
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create a new user instance with the provided data
    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
    });

    // If user creation is successful, generate a JWT token and save the user
    if (newUser) {
      // Generate JWT token and set it in the response (assumed to set a cookie)
      generateToken(newUser._id, res);
      // Save the new user to the database
      await newUser.save();

      // Return success response with user details
      res.status(201).json({
        _id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        profilePic: newUser.profilePic,
      });
    } else {
      // Handle case where user creation fails
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    // Log any errors and return a server error response
    console.log("Error in signup controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Controller for user login
export const login = async (req, res) => {
  // Extract email and password from request body
  const { email, password } = req.body;
  try {
    // Find user by email in the database
    const user = await User.findOne({ email });

    // If user doesn't exist, return error
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Compare provided password with stored hashed password
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate JWT token for authenticated user
    generateToken(user._id, res);

    // Return success response with user details
    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
    });
  } catch (error) {
    // Log any errors and return a server error response
    console.log("Error in login controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Controller for user logout
export const logout = (req, res) => {
  try {
    // Clear the JWT cookie by setting it to an empty string with zero maxAge
    res.cookie("jwt", "", { maxAge: 0 });
    // Return success response
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    // Log any errors and return a server error response
    console.log("Error in logout controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Controller for updating user profile (specifically profile picture)
export const updateProfile = async (req, res) => {
  try {
    // Extract profilePic from request body and user ID from authenticated user
    const { profilePic } = req.body;
    const userId = req.user._id;

    // Validate that profile picture data is provided
    if (!profilePic) {
      return res.status(400).json({ message: "Profile pic is required" });
    }

    // Upload the profile picture to Cloudinary
    const uploadResponse = await cloudinary.uploader.upload(profilePic);
    // Update the user's profile picture in the database
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePic: uploadResponse.secure_url },
      { new: true } // Return the updated document
    );

    // Return the updated user data
    res.status(200).json(updatedUser);
  } catch (error) {
    // Log any errors and return a server error response
    console.log("Error in update profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Controller to check if user is authenticated
export const checkAuth = (req, res) => {
  try {
    // Return the authenticated user's data (assumes middleware sets req.user)
    res.status(200).json(req.user);
  } catch (error) {
    // Log any errors and return a server error response
    console.log("Error in checkAuth controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
