import mongoose, { Document, Schema, Model } from "mongoose";

export interface IMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: Date;
}

export interface IMemory {
  budget: { min?: number; max?: number };
  preferredCategory?: string;
  preferredShape?: string;
  preferredColor?: string;
  preferredSize: { min?: number; max?: number };
  certification?: string;
  purpose?: string;
  viewedProductIds: string[];
}

export interface IChatSession extends Document {
  sessionId: string;
  messages: IMessage[];
  memory: IMemory;
  converted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    role: { type: String, enum: ["user", "assistant", "tool"], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const MemorySchema = new Schema<IMemory>(
  {
    budget: {
      min: { type: Number },
      max: { type: Number },
    },
    preferredCategory: { type: String },
    preferredShape: { type: String },
    preferredColor: { type: String },
    preferredSize: {
      min: { type: Number },
      max: { type: Number },
    },
    certification: { type: String },
    purpose: { type: String },
    viewedProductIds: { type: [String], default: [] },
  },
  { _id: false }
);

const ChatSessionSchema = new Schema<IChatSession>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    messages: { type: [MessageSchema], default: [] },
    memory: {
      type: MemorySchema,
      default: () => ({
        budget: {},
        preferredSize: {},
        viewedProductIds: [],
      }),
    },
    converted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const ChatSession: Model<IChatSession> =
  mongoose.models.ChatSession ||
  mongoose.model<IChatSession>("ChatSession", ChatSessionSchema);

export default ChatSession;