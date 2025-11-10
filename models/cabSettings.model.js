import mongoose from 'mongoose';

const cabSettingsSchema = new mongoose.Schema({
  minBookingNotice: {
    type: Number,
    required: [true, 'Minimum booking notice is required'],
    min: [0, 'Minimum booking notice cannot be negative'],
    default: 60, // 1 hour in minutes
  },
  maxBookingDaysInAdvance: {
    type: Number,
    required: [true, 'Maximum booking days in advance is required'],
    min: [1, 'Maximum booking days must be at least 1'],
    default: 30, // 30 days
  },
  cancellationPolicy: {
    type: String,
    required: [true, 'Cancellation policy is required'],
    default: 'Free cancellation up to 1 hour before pickup',
  },
  baseFare: {
    type: Number,
    required: [true, 'Base fare is required'],
    min: [0, 'Base fare cannot be negative'],
    default: 50,
  },
  perKmRate: {
    type: Number,
    required: [true, 'Per km rate is required'],
    min: [0, 'Per km rate cannot be negative'],
    default: 10,
  },
  perMinuteRate: {
    type: Number,
    required: [true, 'Per minute rate is required'],
    min: [0, 'Per minute rate cannot be negative'],
    default: 1,
  },
  nightSurcharge: {
    type: Number,
    required: [true, 'Night surcharge is required'],
    min: [1, 'Night surcharge must be at least 1 (no surcharge)'],
    default: 1.2, // 20% surcharge
  },
  peakHourSurcharge: {
    type: Number,
    required: [true, 'Peak hour surcharge is required'],
    min: [1, 'Peak hour surcharge must be at least 1 (no surcharge)'],
    default: 1.1, // 10% surcharge
  },
  taxRate: {
    type: Number,
    required: [true, 'Tax rate is required'],
    min: [0, 'Tax rate cannot be negative'],
    max: [1, 'Tax rate cannot exceed 1 (100%)'],
    default: 0.18, // 18% tax
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt timestamp before saving
cabSettingsSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const CabSettings = mongoose.model('CabSettings', cabSettingsSchema);

export default CabSettings;
