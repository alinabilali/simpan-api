const User = require('../models/User');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const transporter = require('../config/mailer');
const hashPassword = require('../utils/hashPassword');
const validatePassword = require('../utils/validatePassword');

const PASSWORD_MESSAGE =
  'Password must be at least 8 characters long and contain at least one number, one uppercase letter, one lowercase letter, and one special character.';

const GENERIC_RESET_MESSAGE =
  'If that email exists, a reset link has been sent';
const GENERIC_RESEND_MESSAGE =
  'If that account exists and is unverified, a new verification email has been sent';

const isString = (value) => typeof value === 'string' && value.length > 0;

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

// Raw token goes in the email, only the hash is stored in the database
const generateToken = () => {
  const raw = crypto.randomBytes(32).toString('hex');
  return { raw, hashed: hashToken(raw) };
};

const sendVerificationEmail = (user, rawToken) => {
  const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${rawToken}`;

  return transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: 'Verify Your Email Address',
    text: `Welcome ${user.name}! Please click the link to verify your email: ${verificationUrl}`,
  });
};

/**
 * @desc Signup
 * @route POST /auth/signup
 * @access Public
 */
const signup = asyncHandler(async (req, res) => {
  const { username, password, name, email } = req.body;

  if (![username, password, name, email].every(isString)) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  if (!validatePassword(password)) {
    return res.status(400).json({ message: PASSWORD_MESSAGE });
  }

  const existingUser = await User.findOne({ username }).exec();
  if (existingUser) {
    return res.status(409).json({ message: 'Username already exists' });
  }

  const existingEmail = await User.findOne({ email }).exec();
  if (existingEmail) {
    return res.status(409).json({ message: 'Email already exists' });
  }

  const hashedPassword = await hashPassword(password);
  const { raw, hashed } = generateToken();

  const newUser = await User.create({
    username,
    password: hashedPassword,
    name,
    email,
    emailVerificationToken: hashed,
    emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  try {
    await sendVerificationEmail(newUser, raw);

    return res.status(201).json({
      message:
        'Registration successful! Please check your email to verify your account.',
    });
  } catch (error) {
    console.error('Error sending verification email:', error);
    await User.findByIdAndDelete(newUser.id);
    return res
      .status(500)
      .json({ message: 'Failed to send verification email' });
  }
});

/**
 * @desc Verify Email
 * @route GET /auth/verify-email?token=...
 * @access Public
 */
const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.query;

  if (!isString(token)) {
    return res.status(400).json({ message: 'Verification token is required' });
  }

  const user = await User.findOne({
    emailVerificationToken: hashToken(token),
    emailVerificationExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res
      .status(400)
      .json({ message: 'Invalid or expired verification token' });
  }

  user.verified = true;
  user.emailVerificationToken = null;
  user.emailVerificationExpires = null;
  await user.save();

  res.json({ message: 'Email verified successfully! You can now log in.' });
});

/**
 * @desc Resend verification email
 * @route POST /auth/resend-verification
 * @access Public
 */
const resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!isString(email)) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const user = await User.findOne({ email }).exec();

  // Same response whether or not the account exists or is already verified
  if (!user || user.verified) {
    return res.json({ message: GENERIC_RESEND_MESSAGE });
  }

  const { raw, hashed } = generateToken();
  user.emailVerificationToken = hashed;
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();

  try {
    await sendVerificationEmail(user, raw);
  } catch (error) {
    // Logged, but not exposed: a different response here would reveal the account exists
    console.error('Error sending verification email:', error);
  }

  res.json({ message: GENERIC_RESEND_MESSAGE });
});

/**
 * @desc Login
 * @route POST /auth
 * @access Public
 */
const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!isString(username) || !isString(password)) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const foundUser = await User.findOne({ username }).exec();

  if (!foundUser) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const match = await bcrypt.compare(password, foundUser.password);

  if (!match) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Checked after the password, so strangers can't probe which accounts are unverified
  if (!foundUser.verified) {
    return res.status(403).json({
      message: 'Please verify your email address before logging in.',
    });
  }

  const accessToken = jwt.sign(
    {
      UserInfo: {
        id: foundUser.id,
        username: foundUser.username,
        name: foundUser.name,
        role: foundUser.role,
      },
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '7d' },
  );

  const refreshToken = jwt.sign(
    { username: foundUser.username },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' },
  );

  res.cookie('jwt', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({ accessToken });
});

/**
 * @desc Refresh
 * @route GET /auth/refresh
 * @access Public
 */
const refresh = (req, res) => {
  const cookies = req.cookies;

  if (!cookies?.jwt) {
    return res.status(401).json({ message: 'Unauthorised' });
  }

  const refreshToken = cookies.jwt;

  jwt.verify(
    refreshToken,
    process.env.REFRESH_TOKEN_SECRET,
    asyncHandler(async (err, decoded) => {
      if (err) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const foundUser = await User.findOne({
        username: decoded.username,
      }).exec();

      if (!foundUser) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // A password reset invalidates refresh tokens issued before it
      if (
        foundUser.passwordChangedAt &&
        decoded.iat < Math.floor(foundUser.passwordChangedAt.getTime() / 1000)
      ) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const accessToken = jwt.sign(
        {
          UserInfo: {
            id: foundUser.id,
            username: foundUser.username,
            name: foundUser.name,
            role: foundUser.role,
          },
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: '7d' },
      );

      res.json({ accessToken });
    }),
  );
};

/**
 * @desc Logout
 * @route POST /auth/logout
 * @access Public
 */
const logout = (req, res) => {
  const cookies = req.cookies;

  if (!cookies?.jwt) {
    return res.sendStatus(204);
  }

  res.clearCookie('jwt', {
    httpOnly: true,
    sameSite: 'None',
    secure: true,
  });

  res.json({ message: 'Cookie cleared' });
};

/**
 * @desc Forgot Password
 * @route POST /auth/forgot-password
 * @access Public
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!isString(email)) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const foundUser = await User.findOne({ email }).exec();

  // Always respond the same way whether or not the email exists.
  // This avoids leaking which emails are registered.
  if (!foundUser) {
    return res.json({ message: GENERIC_RESET_MESSAGE });
  }

  const { raw, hashed } = generateToken();

  foundUser.resetPasswordToken = hashed;
  foundUser.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
  await foundUser.save();

  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${raw}`;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset',
      text: `Please click the following link to reset your password: ${resetUrl}`,
    });

    res.json({ message: GENERIC_RESET_MESSAGE });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ message: 'Failed to send email' });
  }
});

/**
 * @desc Reset Password
 * @route POST /auth/reset-password
 * @access Public
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password, email } = req.body;

  if (![token, password, email].every(isString)) {
    return res.status(400).json({
      message: 'Email, token, and password are required',
    });
  }

  if (!validatePassword(password)) {
    return res.status(400).json({ message: PASSWORD_MESSAGE });
  }

  const user = await User.findOne({
    email,
    resetPasswordToken: hashToken(token),
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({ message: 'Invalid or expired reset token' });
  }

  user.password = await hashPassword(password);
  user.passwordChangedAt = new Date();

  // One-time use
  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;

  await user.save();

  res.json({ message: 'Password reset successfully' });
});

module.exports = {
  signup,
  verifyEmail,
  resendVerification,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
};
