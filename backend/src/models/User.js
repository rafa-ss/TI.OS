const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['admin', 'tecnico', 'atendente'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ROLES, default: 'atendente', index: true },
    permissions: { type: [String], default: [] },
    active: { type: Boolean, default: true, index: true },
    phone: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

userSchema.statics.ROLES = ROLES;

module.exports = mongoose.model('User', userSchema);
