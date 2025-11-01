import DynamicField from '../models/dynamicField.model.js';
import asyncHandler from 'express-async-handler';

// @desc    Get media gallery tags
// @route   GET /api/v1/admin/media-tags
// @access  Private/Admin
export const getMediaTags = asyncHandler(async (req, res) => {
  // Find or create the tags document
  let tagsDoc = await DynamicField.findOne();
  if (!tagsDoc) {
    tagsDoc = await DynamicField.create({});
  }
  res.json(tagsDoc.mediaGalaryTags);
});

// @desc    Add a new tag to media gallery
// @route   POST /api/v1/admin/media-tags
// @access  Private/Admin
export const addMediaTag = asyncHandler(async (req, res) => {
  const { tag } = req.body;
  
  if (!tag || typeof tag !== 'string' || tag.trim() === '') {
    res.status(400);
    throw new Error('Please provide a valid tag');
  }

  // Find or create the tags document
  let tagsDoc = await DynamicField.findOne();
  if (!tagsDoc) {
    tagsDoc = new DynamicField({ mediaGalaryTags: [tag] });
  } else if (!tagsDoc.mediaGalaryTags.includes(tag)) {
    tagsDoc.mediaGalaryTags.push(tag);
  } else {
    res.status(400);
    throw new Error('Tag already exists');
  }

  await tagsDoc.save();
  res.status(201).json(tagsDoc.mediaGalaryTags);
});

// @desc    Remove a tag from media gallery
// @route   DELETE /api/v1/admin/media-tags/:tag
// @access  Private/Admin
export const removeMediaTag = asyncHandler(async (req, res) => {
  const { tag } = req.params;
  
  const tagsDoc = await DynamicField.findOne();
  if (!tagsDoc) {
    res.status(404);
    throw new Error('No tags found');
  }

  const tagIndex = tagsDoc.mediaGalaryTags.indexOf(tag);
  if (tagIndex === -1) {
    res.status(404);
    throw new Error('Tag not found');
  }

  tagsDoc.mediaGalaryTags.splice(tagIndex, 1);
  await tagsDoc.save();
  
  res.json(tagsDoc.mediaGalaryTags);
});

// @desc    Update all media gallery tags
// @route   PUT /api/v1/admin/media-tags
// @access  Private/Admin
export const updateMediaTags = asyncHandler(async (req, res) => {
  const { tags } = req.body;
  
  if (!Array.isArray(tags)) {
    res.status(400);
    throw new Error('Tags must be an array');
  }

  // Remove duplicates
  const uniqueTags = [...new Set(tags)];

  let tagsDoc = await DynamicField.findOne();
  if (!tagsDoc) {
    tagsDoc = new DynamicField({ mediaGalaryTags: uniqueTags });
  } else {
    tagsDoc.mediaGalaryTags = uniqueTags;
  }

  await tagsDoc.save();
  res.json(tagsDoc.mediaGalaryTags);
});
