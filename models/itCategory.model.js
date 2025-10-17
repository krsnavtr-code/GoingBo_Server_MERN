import mongoose from 'mongoose';

const itCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A category must have a name'],
      trim: true,
      unique: true,
      maxlength: [50, 'A category name must have less or equal than 50 characters'],
      minlength: [2, 'A category name must have more or equal than 2 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot be longer than 500 characters']
    },
    icon: {
      type: String,
      default: 'folder'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    order: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
itCategorySchema.index({ name: 1 }, { unique: true });

// Virtual for skills in this category
itCategorySchema.virtual('skills', {
  ref: 'Skill',
  foreignField: 'category',
  localField: 'name'
});

const ITCategory = mongoose.model('ITCategory', itCategorySchema);

export default ITCategory;
