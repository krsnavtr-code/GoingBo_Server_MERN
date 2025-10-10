import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema({
  image: { type: String, default: '/avatar.png' },
  role: { type: String, default: 'Software Engineer – Web Development' },
  name: { type: String, default: 'Krishna Avtar' },
  description: { type: String, default: 'Making The Impossible Possible. Using 1\'s and 0\'s.' },
  sortDescription: { type: String, default: 'Problem solving is what makes me unique.' },
  experience: { type: Number, default: 2.5 },
  projects: { type: Number, default: 203 },
  cvPdf: { type: String, default: '/resume.pdf' },
}, { timestamps: true });

// Create a single document if it doesn't exist
profileSchema.statics.initializeProfile = async function() {
  const count = await this.countDocuments();
  if (count === 0) {
    await this.create({});
  }
};

const Profile = mongoose.models.Profile || mongoose.model('Profile', profileSchema);

export default Profile;
