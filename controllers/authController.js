import { catchAsync } from '../utils/wrapperFunction.js'; 
import User from '../models/userModel.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export const register = catchAsync(async (req, res) => {
  const { name, email, phone, password, role } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: 'User already exists' });
  }

  const user = new User({
    name,
    email,
    phone,
    password,
    role
  });

  await user.save();

  res.status(201).json({ message: 'User created successfully' });
});

export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(422).json({
      status: "fail",
      message: "Please provide email and password"
    });
  }

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    return res.status(401).json({
      status: "fail",
      message: "Invalid email"
    });
  }

  const isValid = await user.comparePassword(password); 
  if (!isValid) {
    return res.status(401).json({
      status: "fail",
      message: "Invalid password"
    });
  }

  const token = jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET, 
    { expiresIn: "1h" }
  );

  res.status(200).json({
    status: "success",
    token
  });
});
