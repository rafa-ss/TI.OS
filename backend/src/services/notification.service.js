const Notification = require('../models/Notification');
const User = require('../models/User');

async function notifyUser(userId, payload) {
  if (!userId) return null;
  return Notification.create({ user: userId, ...payload });
}

async function notifyRoles(roles, payload) {
  const users = await User.find({ role: { $in: roles }, active: true }).select('_id');
  if (!users.length) return;
  await Notification.insertMany(
    users.map((u) => ({ user: u._id, ...payload }))
  );
}

module.exports = { notifyUser, notifyRoles };
