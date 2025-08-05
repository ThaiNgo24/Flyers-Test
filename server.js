require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const multer = require('multer');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB Connection with GridFS
mongoose.connect(process.env.MONGO_URI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
});

const conn = mongoose.connection;
let gfs;

conn.once('open', () => {
  gfs = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: 'speaking_audio'
  });
  console.log('✅ MongoDB & GridFS connected');
});

// Schema (unchanged from your version)
const partSchema = new mongoose.Schema({
  partNumber: { type: Number, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  imageUrl: { type: String },
  timeLimit: { type: Number, required: true },
  audioId: { type: mongoose.Schema.Types.ObjectId }, // Changed from audioPath
  recordedAt: { type: Date, default: Date.now }
});

const testSchema = new mongoose.Schema({
  studentName: { type: String, required: true },
  parts: [partSchema],
  completed: { type: Boolean, default: false }
}, { timestamps: true });

const Test = mongoose.model('Test', testSchema);

// Middleware for GridFS upload
const upload = multer({ storage: multer.memoryStorage() });

// API Endpoint (modified for GridFS)
app.post('/api/submit-part', upload.single('audio'), async (req, res) => {
  try {
    const { studentName, partNumber, title, description, timeLimit, imageUrl } = req.body;
    
    // Upload to GridFS
    const audioId = await new Promise((resolve, reject) => {
      const uploadStream = gfs.openUploadStream(
        `${studentName}-part${partNumber}-${Date.now()}.wav`,
        { contentType: req.file.mimetype }
      );
      
      uploadStream.write(req.file.buffer);
      uploadStream.end(() => resolve(uploadStream.id));
      uploadStream.on('error', reject);
    });

    // Save test data
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
            audioId // Store GridFS file ID
          }
        }
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, testId: test._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add this for audio retrieval (optional)
app.get('/api/audio/:id', (req, res) => {
  const fileId = new mongoose.Types.ObjectId(req.params.id);
  const downloadStream = gfs.openDownloadStream(fileId);
  downloadStream.pipe(res);
});

app.listen(process.env.PORT || 3000, () => 
  console.log(`🚀 Server running on port ${process.env.PORT || 3000}`)
);