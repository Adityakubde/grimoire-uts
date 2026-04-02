const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    colour: {
      type: String,
      default: '#7c3aed',
      trim: true,
    },
    icon: {
      type: String,
      default: 'folder',
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Category', categorySchema);
