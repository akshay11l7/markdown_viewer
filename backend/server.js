global.crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
require('dotenv').config();
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// ─── S3 / Backblaze B2 Client ─────────────────────────────────────────────────
const s3Client = new S3Client({
  endpoint: process.env.B2_ENDPOINT,
  region: process.env.B2_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APP_KEY,
  },
  forcePathStyle: true,
});

const B2_BUCKET = process.env.B2_BUCKET_NAME;

// ─── Express App ───────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-markdown-viewer';

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow larger payloads for file content

// ─── MongoDB Connection ────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// ─── Mongoose Schemas ──────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },  // null for Google users
  authProvider: { type: String, default: 'local' },
}, { timestamps: true });

const fileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fileName: { type: String, required: true },
  b2Key: { type: String, required: true },       // Key in the B2 bucket
  b2Url: { type: String },                        // Public URL of the file
  fileType: { type: String, default: 'text/markdown' },
  sizeBytes: { type: Number, default: 0 },
  lastModified: { type: Date, default: Date.now },
}, { timestamps: true });

// Compound index: a user can't have two files with the same name
fileSchema.index({ userId: 1, fileName: 1 }, { unique: true });

const User = mongoose.model('User', userSchema);
const File = mongoose.model('File', fileSchema);

// ─── Helper: Generate JWT ──────────────────────────────────────────────────────
const generateToken = (user) => {
  return jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
};

// ─── Middleware: Auth Guard ────────────────────────────────────────────────────
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// ─── Auth Endpoints ────────────────────────────────────────────────────────────

// Sign Up
app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword, authProvider: 'local' });
    const token = generateToken(user);
    res.status(201).json({ message: 'User created successfully', token, user: { id: user._id, name, email } });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Sign In
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid email or password' });
    if (user.authProvider !== 'local') return res.status(400).json({ error: 'Please sign in with Google' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid email or password' });

    const token = generateToken(user);
    res.json({ message: 'Login successful', token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Google Sign-In
app.post('/api/google-login', async (req, res) => {
  const { email, name } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required from Google' });
  }

  try {
    let user = await User.findOne({ email });
    if (user) {
      const token = generateToken(user);
      return res.json({ message: 'Google Login successful', token, user: { id: user._id, name: user.name, email: user.email } });
    }

    // Create new Google user
    user = await User.create({ name: name || 'Google User', email, authProvider: 'google' });
    const token = generateToken(user);
    res.status(201).json({ message: 'Google User created', token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── File Endpoints ────────────────────────────────────────────────────────────

// Save file — uploads content to B2 and records metadata in MongoDB
app.post('/api/files/save', authMiddleware, async (req, res) => {
  const { fileName, content } = req.body;
  if (!fileName) {
    return res.status(400).json({ error: 'fileName is required' });
  }

  try {
    const fileContent = content || '';
    const b2Key = `users/${req.userId}/${fileName}`;

    // Upload to Backblaze B2
    await s3Client.send(new PutObjectCommand({
      Bucket: B2_BUCKET,
      Key: b2Key,
      Body: fileContent,
      ContentType: 'text/markdown',
    }));

    // Build the public URL
    const endpointStr = process.env.B2_ENDPOINT || '';
    const b2Url = `${endpointStr}/${B2_BUCKET}/${b2Key}`;

    // Upsert file metadata in MongoDB
    const fileDoc = await File.findOneAndUpdate(
      { userId: req.userId, fileName },
      {
        b2Key,
        b2Url,
        fileType: 'text/markdown',
        sizeBytes: Buffer.byteLength(fileContent, 'utf8'),
        lastModified: new Date(),
      },
      { upsert: true, new: true }
    );

    res.json({ message: 'File saved', file: fileDoc });
  } catch (error) {
    console.error('File save error:', error);
    res.status(500).json({ error: 'Failed to save file' });
  }
});

// List all files for the logged-in user
app.get('/api/files', authMiddleware, async (req, res) => {
  try {
    const files = await File.find({ userId: req.userId }).sort({ lastModified: -1 });
    res.json({ files });
  } catch (error) {
    console.error('File list error:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Get a single file's content from B2
app.get('/api/files/:fileId', authMiddleware, async (req, res) => {
  try {
    const fileDoc = await File.findOne({ _id: req.params.fileId, userId: req.userId });
    if (!fileDoc) return res.status(404).json({ error: 'File not found' });

    // Fetch from Backblaze
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: B2_BUCKET,
      Key: fileDoc.b2Key,
    }));

    // Stream body to string
    const content = await response.Body.transformToString('utf-8');

    res.json({
      file: {
        id: fileDoc._id,
        fileName: fileDoc.fileName,
        content,
        lastModified: fileDoc.lastModified,
        sizeBytes: fileDoc.sizeBytes,
      }
    });
  } catch (error) {
    console.error('File get error:', error);
    res.status(500).json({ error: 'Failed to get file' });
  }
});

// Delete a file from B2 and MongoDB
app.delete('/api/files/:fileId', authMiddleware, async (req, res) => {
  try {
    const fileDoc = await File.findOne({ _id: req.params.fileId, userId: req.userId });
    if (!fileDoc) return res.status(404).json({ error: 'File not found' });

    // Delete from B2
    await s3Client.send(new DeleteObjectCommand({
      Bucket: B2_BUCKET,
      Key: fileDoc.b2Key,
    }));

    // Delete from MongoDB
    await File.deleteOne({ _id: fileDoc._id });

    res.json({ message: 'File deleted' });
  } catch (error) {
    console.error('File delete error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// ─── Presigned URL for Image Upload (drag & drop) ──────────────────────────────
app.post('/api/upload-url', authMiddleware, async (req, res) => {
  const { fileName, fileType } = req.body;
  if (!fileName || !fileType) {
    return res.status(400).json({ error: 'fileName and fileType are required' });
  }

  try {
    const extension = fileName.split('.').pop();
    const uniqueFileName = `images/${req.userId}/${crypto.randomUUID()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: B2_BUCKET,
      Key: uniqueFileName,
      ContentType: fileType,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    const endpointStr = process.env.B2_ENDPOINT || '';
    const fileUrl = `${endpointStr}/${B2_BUCKET}/${uniqueFileName}`;

    res.json({ uploadUrl: url, fileUrl, fileName: uniqueFileName });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

// ─── Start Server ──────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
