import Skill from '../models/skill.model.js';
import AppError from '../utils/appError.js';
import catchAsync from '../utils/catchAsync.js';

// Get all skills (public access)
export const getAllPublicSkills = catchAsync(async (req, res, next) => {
  const skills = await Skill.find({ active: true }).select('-__v');

  res.status(200).json({
    status: 'success',
    results: skills.length,
    data: {
      skills
    }
  });
});

export const createSkill = catchAsync(async (req, res, next) => {
  const newSkill = await Skill.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      skill: newSkill
    }
  });
});

export const getAllSkills = catchAsync(async (req, res, next) => {
  const skills = await Skill.find({ active: true });

  res.status(200).json({
    status: 'success',
    results: skills.length,
    data: {
      skills
    }
  });
});

export const getSkill = catchAsync(async (req, res, next) => {
  const skill = await Skill.findById(req.params.id);

  if (!skill) {
    return next(new AppError('No skill found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      skill
    }
  });
});

export const updateSkill = catchAsync(async (req, res, next) => {
  const skill = await Skill.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!skill) {
    return next(new AppError('No skill found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      skill
    }
  });
});

export const deleteSkill = catchAsync(async (req, res, next) => {
  const skill = await Skill.findByIdAndUpdate(
    req.params.id,
    { active: false },
    { new: true }
  );

  if (!skill) {
    return next(new AppError('No skill found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});

export const getSkillStats = catchAsync(async (req, res, next) => {
  const stats = await Skill.aggregate([
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        avgLevel: { $avg: '$level' }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      stats
    }
  });
});
