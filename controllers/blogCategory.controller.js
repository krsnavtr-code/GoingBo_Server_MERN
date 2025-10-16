import mongoose from 'mongoose';
import { BlogCategory } from '../models/blogCategory.model.js';
import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from 'express-async-handler';
import slugify from '../utils/slugify.js';

// @desc    Get all blog categories
// @route   GET /api/v1/blog-categories
// @access  Public
const getBlogCategories = asyncHandler(async (req, res, next) => {
  const categories = await BlogCategory.find({ isActive: true })
    .sort({ name: 1 });
  
  res.status(200).json({
    success: true,
    count: categories.length,
    data: categories
  });
});

// @desc    Get single blog category
// @route   GET /api/v1/blog-categories/:id
// @access  Public
const getBlogCategory = asyncHandler(async (req, res, next) => {
  const category = await BlogCategory.findById(req.params.id);

  if (!category) {
    return next(
      new ErrorResponse(`Category not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: category
  });
});

// @desc    Create new blog category
// @route   POST /api/v1/blog-categories
// @access  Private/Admin
const createBlogCategory = asyncHandler(async (req, res, next) => {
  const { name, description, slug } = req.body;

  // Create category with or without provided slug
  const categoryData = {
    name,
    description: description || '',
    slug: slug || slugify(name)
  };

  const category = await BlogCategory.create(categoryData);

  res.status(201).json({
    success: true,
    data: category
  });
});

// @desc    Update blog category
// @route   PUT /api/v1/blog-categories/:id
// @access  Private/Admin
const updateBlogCategory = asyncHandler(async (req, res, next) => {
  const { name, description, slug } = req.body;
  const category = await BlogCategory.findById(req.params.id);

  if (!category) {
    return next(
      new ErrorResponse(`Category not found with id of ${req.params.id}`, 404)
    );
  }

  // Update fields if they exist in the request
  if (name) category.name = name;
  if (description) category.description = description;
  if (slug) category.slug = slugify(slug);

  const updatedCategory = await category.save();

  res.status(200).json({
    success: true,
    data: updatedCategory
  });
});

// @desc    Delete blog category
// @route   DELETE /api/v1/blog-categories/:id
// @access  Private/Admin
const deleteBlogCategory = asyncHandler(async (req, res, next) => {
  // First check if any blog posts are using this category
  const blogCount = await mongoose.model('Blog').countDocuments({ 
    categories: req.params.id 
  });

  if (blogCount > 0) {
    return next(
      new ErrorResponse(
        `Cannot delete category as it is being used by ${blogCount} blog posts`,
        400
      )
    );
  }

  const category = await BlogCategory.findByIdAndDelete(req.params.id);

  if (!category) {
    return next(
      new ErrorResponse(`Category not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: {}
  });
});

export {
  getBlogCategories,
  getBlogCategory,
  createBlogCategory,
  updateBlogCategory,
  deleteBlogCategory
};
