const Food = require('../models/Food');
const User = require('../models/User');
const asyncHandler = require('express-async-handler');

// @desc Get all Food
// @route GET /getAllFood
// @access Private
const getAllFood = asyncHandler(async (req, res) => {
  // Get all FoodgetAllFood from MongoDB
  const foods = await Food.find().lean();

  // If no getAllFood
  if (!foods?.length) {
    return res.status(400).json({ message: 'No food found' });
  }

  // Add username to each food before sending the response
  const foodWithUser = await Promise.all(
    foods.map(async (food) => {
      const user = await User.findById(food.user).lean().exec();
      const username = user ? user.username : null;
      return { ...food, username };
    })
  );

  res.json(foodWithUser);
});

// @desc Create new food
// @route POST /food
// @access Private
const createNewFood = asyncHandler(async (req, res) => {
  const { user, name, dateExpiry, category, place, quantity } = req.body;

  // Confirm data
  if ((!user || !name || !dateExpiry || !category || !place, !quantity)) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  // Create and store the new user
  const food = await Food.create({
    user,
    name,
    dateExpiry,
    category,
    place,
    quantity,
  });

  if (food) {
    // Created
    return res.status(201).json({ message: 'New food added' });
  } else {
    return res.status(400).json({ message: 'Invalid food data received' });
  }
});

// @desc Update a food
// @route PATCH /food
const updateFood = asyncHandler(async (req, res) => {
  const { id, user, name, dateExpiry, category, place, quantity } = req.body;

  // Confirm data
  if (
    !id ||
    !user ||
    !name ||
    !dateExpiry ||
    !category ||
    !place ||
    !quantity
  ) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  // Confirm food exists to update
  const food = await Food.findById(id).exec();

  if (!food) {
    return res.status(400).json({ message: 'Food not found' });
  }

  food.name = name;
  food.dateExpiry = dateExpiry;
  food.category = category;
  food.place = place;
  food.quantity = quantity;

  const updatedFood = await food.save();

  res.json(`'${updatedFood.name}' updated`);
});

// @desc Delete a food
// @route DELETE /food
// @access Private
const deleteFood = asyncHandler(async (req, res) => {
  const { id } = req.body;

  // Confirm data
  if (!id) {
    return res.status(400).json({ message: 'Food ID required' });
  }

  // Confirm food exists to delete
  const food = await Food.findById(id).exec();

  if (!food) {
    return res.status(400).json({ message: 'Food not found' });
  }

  const result = await food.deleteOne();

  const reply = `Food '${result.title}' with ID ${result._id} deleted`;

  res.json(reply);
});

// @desc Get all expired food
// @route GET /expiredFood
// @access Private
const getExpiredFood = asyncHandler(async (req, res) => {
  // Get all food from MongoDB
  const today = new Date();
  const foods = await Food.find((expiry) => expiry <= today).lean();

  // If no food
  if (!foods?.length) {
    return res.status(400).json({ message: 'No food found' });
  }

  const foodWithUser = await Promise.all(
    foods.map(async (food) => {
      const user = await User.findById(food.user).lean().exec();
      return { ...food, username: user.username };
    })
  );

  res.json(foodWithUser);
});

// @desc Delete all expired food
// @route DELETE /deleteAllFood
// @access Private
const deleteAllFood = asyncHandler(async (req, res) => {
  // Get all expired food from MongoDB
  const today = new Date();
  const result = await Food.deleteMany({ dateExpiry: { $lte: today } });

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
