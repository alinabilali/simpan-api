const User = require('../models/User');
const Food = require('../models/Food');
const asyncHandler = require('express-async-handler');
const { validationResult } = require('express-validator');

/**
 * @desc Get all users (admin only)
 * @route GET /users
 * @access Private/Admin
 */
const getAllUsers = asyncHandler(async (req, res) => {
  if (req.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const users = await User.find().select('-password').lean();

  if (!users?.length) {
    return res.status(400).json({ message: 'No users found' });
  }

  res.json(users);
});

/**
 * @desc Update a user — the account owner, or an admin
 * @route PATCH /users
 * @access Private
 */
const updateUser = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id, username, email, name, reminder } = req.body;

  const user = await User.findById(id).exec();
  if (!user) {
    return res.status(400).json({ message: 'User not found' });
  }

  const isOwner = user.username === req.user;
  if (!isOwner && req.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  if (username && username !== user.username) {
    const duplicate = await User.findOne({ username }).lean().exec();
    if (duplicate) {
      return res.status(409).json({ message: 'Duplicate username' });
    }
  }

  user.username = username ?? user.username;
  user.email = email ?? user.email;
  user.name = name ?? user.name;
  user.reminder = reminder ?? user.reminder;

  const updatedUser = await user.save();

  res.json(updatedUser);
});

/**
 * @desc Delete a user — the account owner, or an admin
 * @route DELETE /users
 * @access Private
 */
const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ message: 'User ID Required' });
  }

  const user = await User.findById(id).exec();
  if (!user) {
    return res.status(400).json({ message: 'User not found' });
  }

  const isOwner = user.username === req.user;
  if (!isOwner && req.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const hasFood = await Food.exists({ user: id });
  if (hasFood) {
    return res.status(400).json({ message: 'User has assigned food items' });
  }

  const result = await user.deleteOne();

  const reply = `Username ${result.username} with ID ${result._id} deleted`;

  res.json(reply);
});

module.exports = {
  getAllUsers,
  updateUser,
  deleteUser,
};
