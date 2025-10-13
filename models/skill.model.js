import mongoose from 'mongoose';

const skillSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A skill must have a name'],
      trim: true,
      unique: true,
      maxlength: [50, 'A skill name must have less or equal than 50 characters'],
      minlength: [2, 'A skill name must have more or equal than 2 characters']
    },
    category: {
      type: String,
      required: [true, 'A skill must belong to a category'],
      enum: {
        values: ['frontend', 'backend', 'database', 'devops', 'mobile', 'other'],
        message: 'Category is either: frontend, backend, database, devops, mobile, or other'
      }
    },
    level: {
      type: Number,
      required: [true, 'A skill must have a proficiency level'],
      min: [1, 'Level must be between 1 and 5'],
      max: [5, 'Level must be between 1 and 5']
    },
    icon: {
      type: String,
      default: 'code'
    },
    active: {
      type: Boolean,
      default: true,
      select: false
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
skillSchema.index({ name: 1, category: 1 }, { unique: true });

const Skill = mongoose.model('Skill', skillSchema);

export default Skill;
