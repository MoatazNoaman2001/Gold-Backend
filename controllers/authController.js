import { catchAsync } from "../utils/wrapperFunction.js";
import User from "../models/userModel.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: "1h",
    }
  );

  const refreshToken = jwt.sign(
    {
      id: user._id,
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "15d" }
  );

  return { refreshToken, accessToken };
};

export const register = catchAsync(async (req, res) => {
  const { name, email, phone, password, role } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: "User already exists" });
  }

  const user = new User({
    name,
    email,
    phone,
    password,
    role,
  });

  await user.save();

  res.status(201).json({ message: "User created successfully" });
});

export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(422).json({
      status: "fail",
      message: "Please provide email and password",
    });
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    return res.status(401).json({
      status: "fail",
      message: "Invalid email",
    });
  }

  const isValid = await user.comparePassword(password);
  if (!isValid) {
    return res.status(401).json({
      status: "fail",
      message: "Invalid password",
    });
  }

  // const token = jwt.sign(
  //   {
  //     id: user._id,
  //     email: user.email,
  //     role: user.role
  //   },
  //   process.env.JWT_SECRET,
  //   { expiresIn: "1h" }
  // );

  const { accessToken, refreshToken } = generateTokens(user);
  user.refreshToken = refreshToken;
  await user.save();

  res.cookie("jwt", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    maxAge: 15 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    status: "success",
    accessToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
    },
  });
});

export const refresh = catchAsync(async (req, res) => {
  const cookies = req.cookies;

  if (!cookies?.jwt) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const refreshToken = cookies.jwt;

  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

  const user = await User.findById(decoded.id);

  if (!user || user.refreshToken !== refreshToken) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);

  user.refreshToken = newRefreshToken;
  await user.save();

  res.cookie("jwt", newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    maxAge: 15 * 24 * 60 * 60 * 1000,
  });

  res.json({ accessToken });
});

export const logout = catchAsync(async (req, res) => {
  const cookies = req.cookies;

  if (!cookies?.jwt) {
    return res.sendStatus(204);
  }

  const refreshToken = cookies.jwt;

  const user = await User.findOne({ refreshToken });

  if (user) {
    user.refreshToken = null;
    await user.save();
  }

  res.clearCookie("jwt", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
  });

  res.status(200).json({ message: "Logged out successfully" });
});

export const googleAuth = catchAsync(async (req, res) => {
  const { accessToken, refreshToken } = generateTokens(req.user);

  req.user.refreshToken = refreshToken;
  await req.user.save();

  res.cookie("jwt", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    maxAge: 15 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    status: "success",
    accessToken,
  });
});

export const googleAuthFailure = (req, res) => {
  res.status(401).json({
    status: "fail",
    message: "Google authentication failed",
  });
};
