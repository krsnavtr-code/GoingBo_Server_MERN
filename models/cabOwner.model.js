import mongoose from 'mongoose';

const cabOwnerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
    unique: true
  },
  companyName: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true
  },
  contactPerson: {
    name: {
      type: String,
      required: [true, 'Contact person name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Contact email is required'],
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: [true, 'Contact phone is required'],
      trim: true
    }
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    pincode: String,
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        default: [0, 0]
      }
    }
  },
  document: {
    gstNumber: String,
    panNumber: {
      type: String,
      required: [true, 'PAN number is required'],
      uppercase: true
    },
    aadharNumber: String,
    tradeLicense: String,
    documentVerified: {
      type: Boolean,
      default: false
    }
  },
  bankDetails: {
    accountHolderName: String,
    accountNumber: String,
    bankName: String,
    branch: String,
    ifscCode: String,
    upiId: String
  },
  cabs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cab'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  commissionRate: {
    type: Number,
    default: 15, // 15% commission by default
    min: 0,
    max: 100
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  totalPayouts: {
    type: Number,
    default: 0
  },
  currentBalance: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  totalRatings: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for geospatial queries
cabOwnerSchema.index({ 'address.location': '2dsphere' });

// Virtual for total cabs
cabOwnerSchema.virtual('totalCabs').get(function() {
  return this.cabs.length;
});

// Virtual for active cabs
cabOwnerSchema.virtual('activeCabs').get(function() {
  // This would be populated when querying
  return this.cabs ? this.cabs.filter(cab => cab.isActive).length : 0;
});

const CabOwner = mongoose.model('CabOwner', cabOwnerSchema);

export default CabOwner;
