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
