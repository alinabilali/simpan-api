const express = require('express');
const router = express.Router();
const foodController = require('../controllers/foodController');
const verifyJWT = require('../middleware/verifyJWT');

router.use(verifyJWT);

router
  .route('/')
  .get(foodController.getAllFood)
  .post(foodController.createNewFood)
  .patch(foodController.updateFood)
  .delete(foodController.deleteFood);

router.delete('/deleteAllFood', foodController.deleteAllFood);

module.exports = router;
