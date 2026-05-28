const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, default: '' },
    type: {
      type: String,
      enum: ['info', 'success', 'warning', 'danger'],
      default: 'info',
    },
    link: { type: String, default: '' },
    read: { type: Boolean, default: false, index: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
