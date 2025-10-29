import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'A project must have a title'],
      trim: true,
      maxlength: [100, 'A project title must have less or equal than 100 characters'],
      minlength: [5, 'A project title must have more or equal than 5 characters']
    },
    description: {
      type: String,
      required: [true, 'A project must have a description'],
      trim: true
    },
    shortDescription: {
      type: String,
      trim: true,
      maxlength: [250, 'Short description cannot be longer than 250 characters']
    },
    status: {
      type: String,
      enum: ['planning', 'in_progress', 'completed', 'on_hold'],
      default: 'planning'
    },
    priority: {
      type: Number,
      default: 0,
      min: 0,
      max: 10
    },
    startDate: {
      type: Date
    },
    endDate: {
      type: Date
    },
    tags: [{
      type: String,
      trim: true
    }],
    isPublished: {
      type: Boolean,
      default: false
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true
    },
    order: {
      type: Number,
      default: 0
    },
    mainImage: {
      type: String,
      trim: true
    },
    imageGallery: [{
      type: String,
      trim: true
    }],
    // Package Categories as itcategories
    itcategories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ITCategory'
    }],
    packageType: {
      type: String,
      enum: ['project', 'travel'],
      default: 'project'
    },
    destination: {
      type: String,
      trim: true
    },
    duration: {  // Duration Night
      type: Number,
      min: 0,
      default: 0
    },
    durationDay: {
      type: Number,
      min: 0,
      default: 0
    },
    price: {
      type: Number,
      min: 0,
      default: 0
    },
    discount: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    // Location details
    location: {
      country: {
        type: String,
        trim: true
      },
      state: {
        type: String,
        trim: true
      },
      city: {
        type: String,
        trim: true
      },
      address: {
        type: String,
        trim: true
      },
    },
    // Highlights of the package
    highlights: [{
      type: String,
      trim: true
    }],
    // Ratings and reviews
    ratings: {
      average: {
        type: Number,
        min: 1,
        max: 5,
        default: 0
      },
      count: {
        type: Number,
        default: 0
      },
      reviews: [{
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        rating: {
          type: Number,
          required: true,
          min: 1,
          max: 5
        },
        comment: {
          type: String,
          trim: true
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }]
    },
    // Frequently Asked Questions
    faqs: [{
      question: {
        type: String,
        required: true,
        trim: true
      },
      answer: {
        type: String,
        required: true,
        trim: true
      },
      isActive: {
        type: Boolean,
        default: true
      }
    }],
    availableSeats: {
      type: Number,
      min: 0,
      default: 0
    },
    // SEO Meta Fields
    metaTitle: {
      type: String,
      trim: true,
      maxlength: 100
    },
    metaDescription: {
      type: String,
      trim: true,
      maxlength: 160
    },
    metaKeywords: [{
      type: String,
      trim: true
    }],
    maxTravelers: {
      type: Number,
      min: 1,
      default: 1
    },
    included: [{
      type: String,
      trim: true
    }],
    excluded: [{
      type: String,
      trim: true
    }],
    itinerary: [{
      title: {
        type: String,
        trim: true,
        required: true
      },
      location: {
        type: String,
        trim: true
      },
      locationMapLink: {
        type: String,
        trim: true
      },
      description: {
        type: String,
        trim: true
      },
      meals: [{
        type: String,
        enum: ['breakfast', 'lunch', 'dinner']
      }]
    }],
    accommodation: {
      type: String,
      trim: true
    },
    transportation: {
      type: String,
      trim: true
    },
    mealPlan: {
      type: String,
      trim: true
    },
    cancellationPolicy: {
      type: String,
      trim: true
    },
    bookingDeadline: {
      type: Date
    },
    minTravelersRequired: {
      type: Number,
      min: 1,
      default: 1
    },
    isFeatured: {
      type: Boolean,
      default: false
    },
    isGroupDiscountAvailable: {
      type: Boolean,
      default: false
    },
    groupDiscountDetails: {
      type: String,
      trim: true
    },
    ageRestrictions: {
      type: String,
      trim: true
    },
    physicalRating: {
      type: String,
      trim: true
    },
    specialRequirements: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
projectSchema.index({ title: 'text', description: 'text', tags: 'text' });
projectSchema.index({ slug: 1 });
projectSchema.index({ isPublished: 1 });
projectSchema.index({ order: 1 });

// Pre-save hook to generate slug from title
projectSchema.pre('save', function(next) {
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // remove non-word [a-z0-9_], non-whitespace, non-hyphen characters
      .replace(/[\s_-]+/g, '-') // swap any length of whitespace, underscore, hyphen characters with a single -
      .replace(/^-+|-+$/g, ''); // remove leading, trailing -
  }
  next();
});

const Project = mongoose.model('Project', projectSchema);

export default Project;
