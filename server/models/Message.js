const mongoose = require('mongoose');
const messageSchema = new mongoose.Schema({
  senderId:   { type: String, required: true },
  senderName: { type: String, required: true },
  receiverId: { type: String, default: '' },
  content:    { type: String, default: '' },
  imageData:  { type: String, default: '' },
  imageType:  { type: String, default: '' },
  type:       { type: String, enum: ['public','private'], default: 'public' },
  status:     { type: String, enum: ['sent','delivered','seen'], default: 'sent' },
  forwarded:  { type: Boolean, default: false },
  seenAt:     { type: Date }
}, { timestamps: true });
module.exports = mongoose.model('Message', messageSchema);