const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  username:    { type: String, required: true, unique: true, trim: true },
  email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:    { type: String, required: true },
  about:       { type: String, default: 'Hey there! I am using AuraTalk.', maxlength: 120 },
  avatar:      { type: String, default: '' },
  lastSeen:    { type: Date, default: Date.now },

  // Privacy: who can DM me
  // 'everyone' | 'connected' (default: connected)
  dmPrivacy:   { type: String, enum: ['everyone','connected'], default: 'connected' },

  // Connect system
  connections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],  // accepted
  blocked:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],  // blocked users

  // General chat anonymity
  publicAlias: { type: String, default: '' }, // if set, shown instead of username in general chat
}, { timestamps: true });
module.exports = mongoose.model('User', userSchema);