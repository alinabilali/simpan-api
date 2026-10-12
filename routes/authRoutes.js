const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const loginLimiter = require('../middleware/loginLimiter');

router.route('/').post(loginLimiter, authController.login);

router.route('/refresh').get(authController.refresh);

router.route('/logout').post(authController.logout);

router.route('/forgot-password').post(authController.forgotPassword);

router.route('/signup').post(authController.signup);

router.route('/forgot-password').post(authController.forgotPassword);
router.route('/verify-email').get(authController.verifyEmail);
router.route('/resend-verification').post(authController.resendVerification);
router.route('/reset-password').post(authController.resetPassword);

module.exports = router;
