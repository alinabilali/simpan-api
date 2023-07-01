const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');

// @desc Login
// @route POST /auth
// @access Public
const login = asyncHandler(async (req, res) => {
  const { id, username, password, name } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const foundUser = await User.findOne({ username }).exec();

  if (!foundUser) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const match = await bcrypt.compare(password, foundUser.password);

  if (!match) return res.status(401).json({ message: 'Unauthorized' });

  const accessToken = jwt.sign(
    {
      UserInfo: {
        id: foundUser.id,
        username: foundUser.username,
        name: foundUser.name,
      },
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '7d' }
  );

  const refreshToken = jwt.sign(
    { username: foundUser.username },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }
  );

  // Create secure cookie with refresh token
  res.cookie('jwt', refreshToken, {
    httpOnly: true, //accessible only by web server
    secure: true, //https
    sameSite: 'None', //cross-site cookie
    maxAge: 7 * 24 * 60 * 60 * 1000, //cookie expiry: set to match rT
  });

  // Send accessToken containing username and roles
  res.json({ accessToken });
});

// @desc Refresh
// @route GET /auth/refresh
// @access Public - because access token has expired
const refresh = (req, res) => {
  const cookies = req.cookies;

  if (!cookies?.jwt) return res.status(401).json({ message: 'Unauthorised' });

  const refreshToken = cookies.jwt;

  jwt.verify(
    refreshToken,
    process.env.REFRESH_TOKEN_SECRET,
    asyncHandler(async (err, decoded) => {
      if (err) return res.status(403).json({ message: 'Forbidden' });

      const foundUser = await User.findOne({
        username: decoded.username,
      }).exec();

      if (!foundUser) return res.status(401).json({ message: 'Unauthorized' });

      const accessToken = jwt.sign(
        {
          UserInfo: {
            id: foundUser.id,
            username: foundUser.username,
            name: foundUser.name,
          },
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: '7d' }
      );

      res.json({ accessToken });
    })
  );
};

// @desc Logout
// @route POST /auth/logout
// @access Public - just to clear cookie if exists
const logout = (req, res) => {
  const cookies = req.cookies;
  if (!cookies?.jwt) return res.sendStatus(204); //No content
  res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true });
  res.json({ message: 'Cookie cleared' });
};

// @desc Forgot Password
// @route POST /auth/forgot-password
// @access Public
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const foundUser = await User.findOne({ email }).exec();

  if (!foundUser) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Generate a reset token
  const resetToken = jwt.sign(
    { userId: foundUser.id },
    process.env.RESET_TOKEN_SECRET,
    { expiresIn: '1h' }
  );

  // Create the password reset URL
  const resetUrl = `https://localhost:3000/reset-password/${resetToken}`;

  // Compose the email
  const mailOptions = {
    from: 'simpan.app.mail@gmail.com',
    to: email,
    subject: 'Password Reset',
    text: `Please click the following link to reset your password: ${resetUrl}`,
  };

  // Send the email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log('Error sending email:', error);
      return res.status(500).json({ message: 'Failed to send email' });
    }
    console.log('Email sent:', info.response);
    res.json({ message: 'Password reset email sent' });
  });
});

// @desc Signup
// @route POST /auth/signup
// @access Public
const signup = asyncHandler(async (req, res) => {
  const { username, password, name, email } = req.body;

  if (!username || !password || !name || !email) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  if (!/(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}/.test(password)) {
    return res.status(400).json({
      message:
        'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one special character.',
    });
  }

  const existingUser = await User.findOne({ username }).exec();

  if (existingUser) {
    return res.status(409).json({ message: 'Username already exists' });
  }

  const existingEmail = await User.findOne({ email }).exec();

  if (existingEmail) {
    return res.status(409).json({ message: 'Email already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await User.create({
    username,
    password: hashedPassword,
    name,
    email,
  });

  // Generate an access token
  const accessToken = jwt.sign(
    {
      UserInfo: {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
      },
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '7d' }
  );

  const refreshToken = jwt.sign(
    { username: newUser.username },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }
  );

  // Create secure cookie with refresh token
  res.cookie('jwt', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  // Send accessToken containing username and roles
  res.json({ accessToken });
});

module.exports = {
  login,
  refresh,
  logout,
  forgotPassword,
  signup,
};
