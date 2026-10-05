const Food = require('../models/Food');
const User = require('../models/User');
const asyncHandler = require('express-async-handler');

// @desc Get all food for the logged-in user
// @route GET /food
// @access Private
const getAllFood = asyncHandler(async (req, res) => {
  const owner = await User.findOne({ username: req.user }).lean().exec();
  if (!owner) return res.status(401).json({ message: 'Unauthorized' });

  const foods = await Food.find({ user: owner._id }).lean();

  if (!foods?.length) {
    return res.status(400).json({ message: 'No food found' });
  }

  const foodWithUser = foods.map((food) => ({ ...food, username: req.user }));

  res.json(foodWithUser);
});

// @desc Create new food for the logged-in user
// @route POST /food
// @access Private
const createNewFood = asyncHandler(async (req, res) => {
  const { name, dateExpiry, category, place, quantity } = req.body;

  if (!name || !dateExpiry || !category || !place || !quantity) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const owner = await User.findOne({ username: req.user }).exec();
  if (!owner) return res.status(401).json({ message: 'Unauthorized' });

  const food = await Food.create({
    user: owner._id,
    name,
    dateExpiry,
    category,
    place,
    quantity,
  });

  if (food) {
    return res.status(201).json({ message: 'New food added' });
  } else {
    return res.status(400).json({ message: 'Invalid food data received' });
  }
});

// @desc Update a food item owned by the logged-in user
// @route PATCH /food
const updateFood = asyncHandler(async (req, res) => {
  const { id, name, dateExpiry, category, place, quantity } = req.body;

  if (!id || !name || !dateExpiry || !category || !place || !quantity) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const owner = await User.findOne({ username: req.user }).exec();
  if (!owner) return res.status(401).json({ message: 'Unauthorized' });

  const food = await Food.findById(id).exec();

  if (!food) {
    return res.status(400).json({ message: 'Food not found' });
  }

  if (food.user.toString() !== owner._id.toString()) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  food.name = name;
  food.dateExpiry = dateExpiry;
  food.category = category;
  food.place = place;
  food.quantity = quantity;

  const updatedFood = await food.save();

  res.json(`'${updatedFood.name}' updated`);
});

// @desc Delete a food item owned by the logged-in user
// @route DELETE /food
// @access Private
const deleteFood = asyncHandler(async (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ message: 'Food ID required' });
  }

  const owner = await User.findOne({ username: req.user }).exec();
  if (!owner) return res.status(401).json({ message: 'Unauthorized' });

  const food = await Food.findById(id).exec();

  if (!food) {
    return res.status(400).json({ message: 'Food not found' });
  }

  if (food.user.toString() !== owner._id.toString()) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const result = await food.deleteOne();

  const reply = `Food '${result.name}' with ID ${result._id} deleted`;

  res.json(reply);
});

// @desc Get expired food for the logged-in user
// @route GET /food/expiredFood
// @access Private
const getExpiredFood = asyncHandler(async (req, res) => {
  const owner = await User.findOne({ username: req.user }).lean().exec();
  if (!owner) return res.status(401).json({ message: 'Unauthorized' });

  const today = new Date();
  const foods = await Food.find({
    user: owner._id,
    dateExpiry: { $lte: today },
  }).lean();

  if (!foods?.length) {
    return res.status(400).json({ message: 'No food found' });
  }

  const foodWithUser = foods.map((food) => ({ ...food, username: req.user }));

  res.json(foodWithUser);
});

// @desc Delete all expired food for the logged-in user
// @route DELETE /deleteAllFood
// @access Private
const deleteAllFood = asyncHandler(async (req, res) => {
  const owner = await User.findOne({ username: req.user }).exec();
  if (!owner) return res.status(401).json({ message: 'Unauthorized' });

  const today = new Date();
  const result = await Food.deleteMany({
    user: owner._id,
    dateExpiry: { $lte: today },
  });

  const reply = `${result.deletedCount} expired food items deleted`;

  res.json(reply);
});

module.exports = {
  getAllFood,
  createNewFood,
  updateFood,
  deleteFood,
  deleteAllFood,
  getExpiredFood,
};
