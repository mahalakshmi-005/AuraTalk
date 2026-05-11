const mongoose = require('mongoose');
const connectRequestSchema = new mongoose.Schema({
  from:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status:  { type: String, enum: ['pending','accepted','rejected'], default: 'pending' },
  message: { type: String, default: '', maxlength: 100 }, // optional note when requesting
}, { timestamps: true });

// Unique: one request per pair
connectRequestSchema.index({ from: 1, to: 1 }, { unique: true });
module.exports = mongoose.model('ConnectRequest', connectRequestSchema);