import mongoose from 'mongoose';

const hotelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Hotel name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    enum: ['1', '2', '3', '4', 'Resort', 'Hotel', 'Guest House', 'Boutique Hotel', 'Luxury Hotel', 'Motel', 'Homestay', 'Bed and Breakfast', 'Vacation Rental', 'Apartment', 'Cottage', 'Farmhouse'],
    required: [true, 'Hotel category is required']
  },
  registrationNumber: {
    type: String,
    required: [true, 'Registration number is required'],
    unique: true
  },
  totalRooms: {
    type: Number,
    required: [true, 'Total number of rooms is required'],
    min: [1, 'Must have at least 1 room']
  },
  contact: {
    name: {
      type: String,
      required: [true, 'Owner/Manager name is required']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, 'Please enter a valid email']
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required']
    },
    address: {
      type: String,
      required: [true, 'Address is required']
    },
    city: {
      type: String,
      required: [true, 'City is required']
    },
    country: {
      type: String,
      required: [true, 'Country is required']
    },
    postalCode: String,
    mapLocation: {
      type: String,
      required: [true, 'Map location is required']
    }
  },
  website: String,
  facilities: {
    hasWifi: {
      type: Boolean,
      default: false
    },
    hasPool: {
      type: Boolean,
      default: false
    },
    hasRestaurant: {
      type: Boolean,
      default: false
    }
  },
  additionalInfo: String,
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
hotelSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Hotel = mongoose.model('Hotel', hotelSchema);

export default Hotel;
