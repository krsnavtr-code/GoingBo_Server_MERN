import mongoose from 'mongoose';

const cabBookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
  },
  cab: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cab',
    required: [true, 'Cab ID is required'],
  },
  bookingReference: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
  },
  pickupLocation: {
    type: {
      type: String,
      default: 'Point',
      enum: ['Point'],
    },
    coordinates: [Number],
    address: String,
    name: String,
    contactNumber: String,
  },
  dropoffLocation: {
    type: {
      type: String,
      default: 'Point',
      enum: ['Point'],
    },
    coordinates: [Number],
    address: String,
    name: String,
  },
  pickupTime: {
    type: Date,
    required: [true, 'Pickup time is required'],
  },
  dropoffTime: Date,
  distance: {
    type: Number,
    required: [true, 'Distance is required'],
    min: [0, 'Distance cannot be negative'],
  },
  fare: {
    type: Number,
    required: [true, 'Fare is required'],
    min: [0, 'Fare cannot be negative'],
  },
  status: {
    type: String,
    enum: [
      'pending',
      'confirmed',
      'driver_assigned',
      'driver_en_route',
      'arrived',
      'in_progress',
      'completed',
      'cancelled',
      'rejected',
    ],
    default: 'pending',
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'],
    default: 'pending',
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'wallet', 'upi', 'net_banking'],
    default: 'cash',
  },
  notes: String,
  cancellationReason: String,
  rating: {
    type: Number,
    min: 1,
    max: 5,
  },
  review: String,
  estimatedDuration: Number, // in minutes
  actualDuration: Number,    // in minutes
  routePolyline: String,     // For showing route on map
  waypoints: [{
    location: {
      type: {
        type: String,
        default: 'Point',
        enum: ['Point'],
      },
      coordinates: [Number],
      address: String,
      name: String,
    },
    stopType: {
      type: String,
      enum: ['pickup', 'dropoff', 'waypoint'],
      default: 'waypoint',
    },
    sequence: Number,
  }],
  extras: {
    tollCharges: {
      type: Number,
      default: 0,
    },
    waitingCharges: {
      type: Number,
      default: 0,
    },
    nightCharges: {
      type: Number,
      default: 0,
    },
    peakTimeCharges: {
      type: Number,
      default: 0,
    },
  },
  promoCode: String,
  discount: {
    type: Number,
    default: 0,
  },
  tax: {
    type: Number,
    default: 0,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for better query performance
cabBookingSchema.index({ user: 1, status: 1 });
cabBookingSchema.index({ cab: 1, status: 1 });
cabBookingSchema.index({ status: 1 });
cabBookingSchema.index({ pickupTime: 1 });

// Virtual for duration in hours
cabBookingSchema.virtual('durationHours').get(function() {
  if (!this.actualDuration) return null;
  return (this.actualDuration / 60).toFixed(1);
});

// Pre-save hook to generate booking reference
cabBookingSchema.pre('save', function(next) {
  if (!this.bookingReference) {
    this.bookingReference = `CAB${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  }
  next();
});

const CabBooking = mongoose.model('CabBooking', cabBookingSchema);

export default CabBooking;
