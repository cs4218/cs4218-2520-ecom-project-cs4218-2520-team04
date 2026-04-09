import userModel from "../models/userModel.js";
import orderModel from "../models/orderModel.js";

import { comparePassword, hashPassword } from "./../helpers/authHelper.js";
import {
  clearFailedLoginAttempts,
  getLoginThrottleState,
  getRequestIp,
  normalizeEmail,
  recordFailedLoginAttempt,
} from "../helpers/loginProtection.js";
import {
  validatePasswordStrength,
} from "../helpers/passwordPolicy.js";
import {
  exceedsMaxLength,
  INPUT_LIMITS,
  isTextString,
} from "../helpers/inputValidation.js";
import JWT from "jsonwebtoken";

const INVALID_LOGIN_MESSAGE = "Invalid email or password";
const LOGIN_THROTTLED_MESSAGE =
  "Too many failed login attempts. Please try again later.";

const escapeRegex = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildCaseInsensitiveEmailQuery = (email = "") => ({
  email: {
    $regex: `^${escapeRegex(email)}$`,
    $options: "i",
  },
});

export const registerController = async (req, res) => {
  try {
    const { name, email, password, phone, address, answer } = req.body;
    const trimmedEmail = typeof email === "string" ? email.trim() : "";
    const normalizedEmail = normalizeEmail(email);
    //validations
    if (!name) return res.status(400).send({ message: "Name is required" });
    if (!email) return res.status(400).send({ message: "Email is required" });
    if (!password) return res.status(400).send({ message: "Password is required" });
    if (!phone) return res.status(400).send({ message: "Phone number is required" });
    if (!address) return res.status(400).send({ message: "Address is required" });
    if (!answer) return res.status(400).send({ message: "Answer is required" });
    if (![name, email, password, phone, address, answer].every(isTextString)) {
      return res.status(400).send({
        success: false,
        message: "Invalid input format. Fields must be text strings.",
      });
    }
    if (!trimmedEmail) return res.status(400).send({ message: "Email is required" });
    if (exceedsMaxLength(name, INPUT_LIMITS.name)) {
      return res.status(400).send({ success: false, message: "Name is too long" });
    }
    if (exceedsMaxLength(email, INPUT_LIMITS.email)) {
      return res.status(400).send({ success: false, message: "Email is too long" });
    }
    if (exceedsMaxLength(password, INPUT_LIMITS.password)) {
      return res.status(400).send({ success: false, message: "Password is too long" });
    }
    if (exceedsMaxLength(phone, INPUT_LIMITS.phone)) {
      return res.status(400).send({ success: false, message: "Phone number is too long" });
    }
    if (exceedsMaxLength(address, INPUT_LIMITS.address)) {
      return res.status(400).send({ success: false, message: "Address is too long" });
    }
    if (exceedsMaxLength(answer, INPUT_LIMITS.answer)) {
      return res.status(400).send({ success: false, message: "Answer is too long" });
    }

    //check user
    const existingUser = await userModel.findOne(
      buildCaseInsensitiveEmailQuery(trimmedEmail)
    );
    //existing user
    if (existingUser) {
      return res.status(200).send({
        success: false,
        message: "Already registered, please log in",
      });
    }
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).send({ success: false, message: passwordValidation.message });
    }
    //register user
    const hashedPassword = await hashPassword(password);
    //save
    const user = await new userModel({
      name,
      email: trimmedEmail,
      phone,
      address,
      password: hashedPassword,
      answer,
    }).save();

    res.status(201).send({
      success: true,
      message: "User registered successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
      }
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error in registration",
      error,
    });
  }
};

//POST LOGIN
export const loginController = async (req, res) => {
  try {
    const { email, password } = req.body;
    const trimmedEmail = typeof email === "string" ? email.trim() : "";
    const normalizedEmail = normalizeEmail(email);
    const requestIp = getRequestIp(req);
    const throttleState = getLoginThrottleState({
      email: normalizedEmail,
      ip: requestIp,
    });

    if (throttleState.blocked) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(throttleState.retryAfterMs / 1000)
      );

      res.set("Retry-After", String(retryAfterSeconds));
      return res.status(429).send({
        success: false,
        message: LOGIN_THROTTLED_MESSAGE,
        retryAfterSeconds,
      });
    }

    const failLoginAttempt = () => {
      recordFailedLoginAttempt({
        email: normalizedEmail,
        ip: requestIp,
      });

      return res.status(401).send({
        success: false,
        message: INVALID_LOGIN_MESSAGE,
      });
    };

    //validation
    if (!trimmedEmail || !password) {
      return res.status(400).send({
        success: false,
        message: INVALID_LOGIN_MESSAGE,
      });
    }
    if (![email, password].every(isTextString)) {
      return res.status(400).send({
        success: false,
        message: INVALID_LOGIN_MESSAGE,
      });
    }
    if (
      exceedsMaxLength(email, INPUT_LIMITS.email) ||
      exceedsMaxLength(password, INPUT_LIMITS.password)
    ) {
      return res.status(400).send({
        success: false,
        message: INVALID_LOGIN_MESSAGE,
      });
    }
    //check user
    const user = await userModel.findOne(
      buildCaseInsensitiveEmailQuery(trimmedEmail)
    );
    if (!user) {
      return failLoginAttempt();
    }
    const match = await comparePassword(password, user.password);
    if (!match) {
      return failLoginAttempt();
    }
    clearFailedLoginAttempts({
      email: normalizedEmail,
      ip: requestIp,
    });
    //token
    const token = await JWT.sign({ _id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.status(200).send({
      success: true,
      message: "Login successful",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error in login",
      error,
    });
  }
};

//forgotPasswordController

export const forgotPasswordController = async (req, res) => {
  try {
    const { email, answer, newPassword } = req.body;
    const trimmedEmail = typeof email === "string" ? email.trim() : "";
    if (!email) {
      return res.status(400).send({ message: "Email is required" });
    }
    if (!answer) {
      return res.status(400).send({ message: "Answer is required" });
    }
    if (!newPassword) {
      return res.status(400).send({ message: "New password is required" });
    }
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).send({
        success: false,
        message: passwordValidation.message,
      });
    }

    // Mervyn Teo Zi Yan - Added type checks for better input validation
    if (typeof email !== "string" || typeof answer !== "string" || typeof newPassword !== "string") {
      return res.status(400).send({
        success: false,
        message: "Invalid input format. Fields must be text strings."
      });
    }

    //check
    const user = await userModel.findOne({
      ...buildCaseInsensitiveEmailQuery(trimmedEmail),
      answer,
    });
    //validation
    if (!user) {
      return res.status(404).send({
        success: false,
        message: "Wrong email or answer",
      });
    }
    const hashed = await hashPassword(newPassword);
    await userModel.findByIdAndUpdate(user._id, { password: hashed });
    res.status(200).send({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Something went wrong",
      error,
    });
  }
};

//test controller
export const testController = (req, res) => {
  try {
    res.send("Protected Routes");
  } catch (error) {
    console.log(error);
    res.send({ error });
  }
};

//update profile
export const updateProfileController = async (req, res) => {
  try {
    const { name, email, password, address, phone } = req.body;
    const user = await userModel.findById(req.user._id);
    if (!user) {
        return res.status(404).send({
        success: false,
        message: "User not found",
        });
    }
    if (
      (name !== undefined && !isTextString(name)) ||
      (password !== undefined && password !== "" && !isTextString(password)) ||
      (phone !== undefined && !isTextString(phone)) ||
      (address !== undefined && !isTextString(address))
    ) {
      return res.status(400).send({
        success: false,
        message: "Invalid input format. Fields must be text strings.",
      });
    }
    if (name && exceedsMaxLength(name, INPUT_LIMITS.name)) {
      return res.status(400).send({ success: false, message: "Name is too long" });
    }
    if (password && exceedsMaxLength(password, INPUT_LIMITS.password)) {
      return res.status(400).send({ success: false, message: "Password is too long" });
    }
    if (phone && exceedsMaxLength(phone, INPUT_LIMITS.phone)) {
      return res.status(400).send({
        success: false,
        message: "Phone number is too long",
      });
    }
    if (address && exceedsMaxLength(address, INPUT_LIMITS.address)) {
      return res.status(400).send({ success: false, message: "Address is too long" });
    }
    //password
    if (password) {
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.valid) {
      return res.status(400).send({
        success: false,
        message: passwordValidation.message,
      });
      }
    }
    const hashedPassword = password ? await hashPassword(password) : undefined;
    const updatedUser = await userModel.findByIdAndUpdate(
      req.user._id,
      {
        name: name || user.name,
        password: hashedPassword || user.password,
        phone: phone || user.phone,
        address: address || user.address,
      },
      { new: true }
    )

    const userResponse = {
        _id: updatedUser._id,
        name: updatedUser.name,
        phone: updatedUser.phone,
        address: updatedUser.address,
    }

    res.status(200).send({
      success: true,
      message: "Profile updated successfully",
      userResponse,
    });
  } catch (error) {
    console.log(error);
    res.status(400).send({
      success: false,
      message: "Error while updating profile",
      error,
    });
  }
};

//orders
export const getOrdersController = async (req, res) => {
  try {
    const orders = await orderModel
      .find({ buyer: req.user._id })
      .populate("products", "-photo")
      .populate("buyer", "name");
    res.json(orders);
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while getting orders",
      error,
    });
  }
};
//orders
export const getAllOrdersController = async (req, res) => {
  try {
    const orders = await orderModel
      .find({})
      .populate("products", "-photo")
      .populate("buyer", "name")
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while getting orders",
      error,
    });
  }
};

//order status
export const orderStatusController = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const orders = await orderModel.findByIdAndUpdate(
      orderId,
      { status },
      { new: true }
    );
    res.json(orders);
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while updating order",
      error,
    });
  }
};

// admin: list all users (for admin Users page)
export const getAllUsersController = async (req, res) => {
  try {
    const users = await userModel
      .find({})
      .select("_id name email phone address role createdAt");

    return res.status(200).send({
      success: true,
      users,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      success: false,
      message: "Error while getting users",
      error,
    });
  }
};
