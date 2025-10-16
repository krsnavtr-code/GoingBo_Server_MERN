import mongoose from 'mongoose';

const blogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  slug: {
    type: String,
    required: [true, 'Slug is required'],
    unique: true,
    trim: true,
    lowercase: true
  },
  excerpt: {
    type: String,
    trim: true,
    maxlength: [300, 'Excerpt cannot be more than 300 characters']
  },
  content: {
    type: String,
    required: [true, 'Content is required']
  },
  featuredImage: {
    type: String,
    default: ''
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  categories: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BlogCategory'
    }],
    required: [true, 'At least one category is required'],
    validate: {
      validator: async function(categories) {
        // Convert single category to array if needed
        const categoriesArray = Array.isArray(categories) ? categories : [categories];
        
        if (categoriesArray.length === 0) {
          console.log('Validation failed: No categories provided');
          return false;
        }
        
        try {
          // Convert all IDs to strings for consistent comparison
          const categoryIds = categoriesArray.map(id => id.toString());
          console.log('Looking for categories with IDs:', categoryIds);
          
          // Find all categories that match the IDs
          const existingCategories = await mongoose.model('BlogCategory').find({
            _id: { $in: categoryIds }
          });
          
          console.log('Found categories:', existingCategories.map(c => c._id.toString()));
          
          // Check if we found all categories
          const isValid = existingCategories.length === categoryIds.length;
          if (!isValid) {
            console.log('Validation failed: Not all categories found');
          }
          return isValid;
        } catch (error) {
          console.error('Error validating categories:', error);
          return false;
        }
      },
      message: 'One or more categories are invalid. Please ensure all categories exist.'
    }
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  published: {
    type: Boolean,
    default: false
  },
  publishedAt: {
    type: Date,
    default: null
  },
  meta: {
    title: {
      type: String,
      trim: true,
      maxlength: [60, 'Meta title cannot be more than 60 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [160, 'Meta description cannot be more than 160 characters']
    },
    keywords: [String]
  },
  views: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
blogSchema.index({ title: 'text', content: 'text', tags: 'text' });
blogSchema.index({ slug: 1 });
blogSchema.index({ published: 1, publishedAt: -1 });

// Middleware to set publishedAt when published is set to true
blogSchema.pre('save', function(next) {
  if (this.isModified('published') && this.published && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

// Virtual for formatted date
blogSchema.virtual('formattedDate').get(function() {
  return this.publishedAt ? this.publishedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : '';
});

// Static method to generate slug
blogSchema.statics.generateSlug = async function(title) {
  let slug = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // remove special characters
    .replace(/\s+/g, '-') // replace spaces with -
    .replace(/--+/g, '-') // replace multiple - with single -
    .trim();

  // Check if slug already exists
  const existingBlog = await this.findOne({ slug });
  
  if (existingBlog) {
    // If slug exists, add a random string to make it unique
    const randomString = Math.random().toString(36).substring(2, 8);
    slug = `${slug}-${randomString}`;
  }

  return slug;
};

const Blog = mongoose.model('Blog', blogSchema);

export { Blog };
