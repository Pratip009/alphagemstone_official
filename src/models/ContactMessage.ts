import mongoose, { Schema, Document } from "mongoose";

export interface IContactMessage extends Document {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: "unread" | "read" | "replied";
  createdAt: Date;
}

const ContactMessageSchema = new Schema<IContactMessage>(
  {
    name:    { type: String, required: true, trim: true },
    email:   { type: String, required: true, trim: true, lowercase: true },
    phone:   { type: String, trim: true },
    subject: { type: String, required: true },
    message: { type: String, required: true, trim: true },
    status:  { type: String, enum: ["unread", "read", "replied"], default: "unread" },
  },
  { timestamps: true }
);

ContactMessageSchema.index({ status: 1, createdAt: -1 });

export default mongoose.models.ContactMessage ||
  mongoose.model<IContactMessage>("ContactMessage", ContactMessageSchema);