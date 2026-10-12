const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },
    passwordChangedAt: { type: Date, default: null },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },

    reminder: {
      type: Date,
      default: () => {
        const date = new Date();
        date.setHours(8, 0, 0, 0);
        return date;
      },
    },

    verified: {
      type: Boolean,
      default: false,
    },

    emailVerificationExpires: {
      type: Date,
      default: null,
    },

    resetPasswordExpires: {
      type: Date,
      default: null,
    },

    emailVerificationToken: { type: String, default: null, select: false },
    resetPasswordToken: { type: String, default: null, select: false },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('User', userSchema);
