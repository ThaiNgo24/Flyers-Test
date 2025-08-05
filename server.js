require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// Test Schema with English fields
const partSchema = new mongoose.Schema({
  partNumber: { type: Number, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  imageUrl: { type: String },
  timeLimit: { type: Number, required: true }, // in seconds
  audioPath: { type: String, required: true },
  recordedAt: { type: Date, default: Date.now },
});

const testSchema = new mongoose.Schema(
  {
    studentName: { type: String, required: true },
    parts: [partSchema],
    completed: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Test = mongoose.model("Test", testSchema);

// File Upload Configuration
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// API Endpoints
app.post("/api/submit-part", upload.single("audio"), async (req, res) => {
  try {
    const { studentName, partNumber, title, description, timeLimit, imageUrl } =
      req.body;

    const test = await Test.findOneAndUpdate(
      { studentName, completed: false },
      {
        $push: {
          parts: {
            partNumber: parseInt(partNumber),
            title,
            description,
            imageUrl,
            timeLimit: parseInt(timeLimit),
            audioPath: req.file.path,
          },
        },
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, testId: test._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () =>
  console.log("🚀 Server running at http://localhost:3000")
);
