const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  reminder: {
    type: Date,
    default: () => {
      const date = new Date();
      date.setHours(8, 0, 0, 0); // Set time to 8 am
      return date;
    },
    verified: {
      type: Boolean,
      default: false,
    },
  },
});

mongoose.set('strictQuery', false);

module.exports = mongoose.model('User', userSchema);
