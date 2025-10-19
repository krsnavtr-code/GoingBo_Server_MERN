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
    technologies: [{
      type: String,
      trim: true
    }],
    projectUrl: {
      type: String,
      trim: true
    },
    githubUrl: {
      type: String,
      trim: true
    },
    githubUrl2: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['planning', 'in_progress', 'completed', 'on_hold', 'cancelled'],
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
    itcategories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ITCategory'
    }]
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
