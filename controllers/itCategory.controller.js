import ITCategory from '../models/itCategory.model.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';

// @desc    Get all IT categories
// @route   GET /api/v1/it-categories
// @access  Private/Admin
export const getAllCategories = catchAsync(async (req, res, next) => {
  const categories = await ITCategory.find().sort('order');

  res.status(200).json({
    status: 'success',
    results: categories.length,
    data: {
      categories
    }
  });
});

// @desc    Get single IT category
// @route   GET /api/v1/it-categories/:id
// @access  Private/Admin
export const getCategory = catchAsync(async (req, res, next) => {
  const category = await ITCategory.findById(req.params.id);

  if (!category) {
    return next(new AppError('No category found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      category
    }
  });
});

// @desc    Create IT category
// @route   POST /api/v1/it-categories
// @access  Private/Admin
export const createCategory = catchAsync(async (req, res, next) => {
  const newCategory = await ITCategory.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      category: newCategory
    }
  });
});

// @desc    Update IT category
// @route   PATCH /api/v1/it-categories/:id
// @access  Private/Admin
export const updateCategory = catchAsync(async (req, res, next) => {
  const category = await ITCategory.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );

  if (!category) {
    return next(new AppError('No category found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      category
    }
  });
});

// @desc    Delete IT category
// @route   DELETE /api/v1/it-categories/:id
// @access  Private/Admin
export const deleteCategory = catchAsync(async (req, res, next) => {
  const category = await ITCategory.findByIdAndDelete(req.params.id);

  if (!category) {
    return next(new AppError('No category found with that ID', 404));
  }

  // TODO: Handle any cleanup when a category is deleted (e.g., update skills that reference this category)

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// @desc    Reorder categories
// @route   PATCH /api/v1/it-categories/reorder
// @access  Private/Admin
export const reorderCategories = catchAsync(async (req, res, next) => {
  const { categories } = req.body;
  
  if (!Array.isArray(categories)) {
    return next(new AppError('Please provide an array of categories with their new order', 400));
  }

  const bulkOps = categories.map(cat => ({
    updateOne: {
      filter: { _id: cat._id },
      update: { $set: { order: cat.order } }
    }
  }));

  await ITCategory.bulkWrite(bulkOps);

  const updatedCategories = await ITCategory.find().sort('order');

  res.status(200).json({
    status: 'success',
    data: {
      categories: updatedCategories
    }
  });
});
