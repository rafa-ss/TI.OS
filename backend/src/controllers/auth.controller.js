const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/auth.service');

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const data = await authService.login(email, password);
  res.json({ success: true, ...data });
});

exports.me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
});
