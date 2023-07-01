const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Food = require('../models/Food');
const asyncHandler = require('express-async-handler');
const bcrypt = require('bcrypt');

// Validation rules for user data
const userValidationRules = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('email').trim().isEmail().withMessage('Invalid email address'),
  body('password').trim().notEmpty().withMessage('Password is required'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('reminder').trim().notEmpty().withMessage('Reminder is required'),
];

// @desc Get all users
// @route GET /users
// @access Private
const getAllUsers = asyncHandler(async (req, res) => {
  // Get all users from MongoDB
  const users = await User.find().select('-password').lean();

  // If no users
  if (!users?.length) {
    return res.status(400).json({ message: 'No users found' });
  }

  res.json(users);
});

// @desc Create new user
// @route POST /users
// @access Private
const createNewUser = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, email, password, name, reminder } = req.body;

  // Check for duplicate username
  const duplicate = await User.findOne({ username }).lean().exec();

  if (duplicate) {
    return res.status(409).json({ message: 'Duplicate username' });
  }

  // Hash password
  const hashedPwd = await bcrypt.hash(password, 10); // salt rounds

  const userObject = { username, email, password: hashedPwd, name, reminder };

  // Create and store new user
  const user = await User.create(userObject);

  if (user) {
    //created
    res.status(201).json({ message: `User ${username} added` });
  } else {
    res.status(400).json({ message: 'Invalid user data received' });
  }
});

// @desc Update a user
// @route PUT /users
// @access Private
const updateUser = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id, username, email, name, reminder } = req.body;

  // Does the user exist to update?
  const user = await User.findById(id).exec();

  if (!user) {
    return res.status(400).json({ message: 'User not found' });
  }

  // Check for duplicate
  const duplicate = await User.findOne({ username }).lean().exec();

  // Allow updates to the original user
  if (duplicate && duplicate._id.toString() !== id) {
    return res.status(409).json({ message: 'Duplicate username' });
  }

  user.username = username;
  user.email = email;
  user.name = name;
  user.reminder = reminder;

  const updatedUser = await user.save();

  res.json(updatedUser);
});

// @desc Delete a user
// @route DELETE /users
// @access Private
const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.body;

  // Confirm data
  if (!id) {
    return res.status(400).json({ message: 'User ID Required' });
  }

  // Does the user still have assigned notes?
  const hasFood = await Food.exists({ user: id });
  if (hasFood) {
    return res.status(400).json({ message: 'User has assigned notes' });
  }

  // Does the user exist to delete?
  const user = await User.findById(id).exec();

  if (!user) {
    return res.status(400).json({ message: 'User not found' });
  }

  const result = await user.deleteOne();

  const reply = `Username ${result.username} with ID ${result._id} deleted`;

  res.json(reply);
});

module.exports = {
  getAllUsers,
  createNewUser,
  updateUser,
  deleteUser,
  userValidationRules,
};
