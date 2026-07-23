import {mongoose} from "mongoose";

const issueSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['guest', 'host'],
      required: true,
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home', default: null },
    issueType: {
      type: String,
      enum: ['booking', 'payment', 'account', 'listing', 'other'],
      required: true,
    },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'closed'],
      default: 'open',
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolution: {
      note: { type: String, default: '' },
      resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      resolvedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);
issueSchema.index({ status: 1, role: 1, createdAt: -1 });

export default mongoose.model('Issue', issueSchema);