import mongoose, { Document, Schema } from 'mongoose';

export interface IHeroSlide extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  subtitle?: string;
  description?: string;
  desktopImage: string;
  mobileImage?: string;
  accent?: string;
  accentGlow?: string;
  buttonText?: string;
  buttonLink?: string;
  openInNewTab: boolean;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const HeroSlideSchema = new Schema<IHeroSlide>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    subtitle: {
      type: String,
      trim: true,
      maxlength: [200, 'Subtitle cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    desktopImage: {
      type: String,
      required: [true, 'Desktop image is required'],
    },
    mobileImage: {
      type: String,
    },
    accent: {
      type: String,
      default: '#b8c9d4',
    },
    accentGlow: {
      type: String,
      default: '#5a8fa8',
    },
    buttonText: {
      type: String,
      trim: true,
      maxlength: [80, 'Button text cannot exceed 80 characters'],
    },
    buttonLink: {
      type: String,
      trim: true,
      maxlength: [2000, 'Button link cannot exceed 2000 characters'],
    },
    openInNewTab: {
      type: Boolean,
      default: false,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

HeroSlideSchema.index({ isActive: 1, displayOrder: 1 });
HeroSlideSchema.index({ displayOrder: 1 });

const HeroSlide = (() => {
  if (mongoose.models && mongoose.models.HeroSlide) {
    return mongoose.models.HeroSlide as mongoose.Model<IHeroSlide>;
  }
  return mongoose.model<IHeroSlide>('HeroSlide', HeroSlideSchema);
})();

export default HeroSlide;