const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const foodSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    name: {
      type: String,
      required: true,
    },
    dateExpiry: {
      type: Date,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    place: {
      type: String,
      required: true,
    },
    quantity: {
      type: String,
      required: false,
    },
    active: {
      type: Boolean,
      default: true,
    },
    completed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

foodSchema.plugin(AutoIncrement, {
  inc_field: 'ticket',
  id: 'ticketNums',
  start_seq: 500,
});

module.exports = mongoose.model('Food', foodSchema);
