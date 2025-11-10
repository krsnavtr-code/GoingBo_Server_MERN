import mongoose from 'mongoose';

const cabSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Cab name is required'],
    trim: true,
  },
  type: {
    type: String,
    required: [true, 'Cab type is required'],
    enum: ['economy', 'premium', 'luxury', 'suv', 'minivan'],
    default: 'economy',
  },
  capacity: {
    type: Number,
    required: [true, 'Cab capacity is required'],
    min: [1, 'Capacity must be at least 1'],
    max: [10, 'Capacity cannot exceed 10'],
  },
  registrationNumber: {
    type: String,
    required: [true, 'Registration number is required'],
    unique: true,
    trim: true,
    uppercase: true,
  },
  driver: {
    name: {
      type: String,
      required: [true, 'Driver name is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Driver phone number is required'],
      trim: true,
    },
    licenseNumber: {
      type: String,
      required: [true, 'Driver license number is required'],
      trim: true,
    },
  },
  isAvailable: {
    type: Boolean,
    default: true,
  },
  routes: [{
    from: {
      type: String,
      required: [true, 'Source city is required'],
      trim: true
    },
    to: {
      type: String,
      required: [true, 'Destination city is required'],
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  pricePerKm: {
    type: Number,
    required: [true, 'Price per km is required'],
    min: [0, 'Price cannot be negative'],
  },
  features: [{
    type: String,
    trim: true,
  }],
  images: [String],
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Create geospatial index for location-based queries
cabSchema.index({ location: '2dsphere' });

const Cab = mongoose.model('Cab', cabSchema);

export default Cab;
