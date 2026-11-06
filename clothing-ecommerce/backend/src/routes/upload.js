const router = require('express').Router();
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const multer = require('multer');
const { protect, adminOnly } = require('../middleware/auth');
const { httpError } = require('../utils/helpers');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) =>
    ALLOWED.includes(file.mimetype) ? cb(null, true) : cb(httpError(400, 'Only JPG, PNG, WEBP, AVIF or GIF images are allowed')),
});

const useCloudinary = () =>
  !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

function toCloudinary(file) {
  const { v2: cloudinary } = require('cloudinary');
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: 'clothing-store', resource_type: 'image' }, (err, result) =>
        err ? reject(err) : resolve(result.secure_url)
      )
      .end(file.buffer);
  });
}

async function toDisk(file, req) {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/avif': '.avif', 'image/gif': '.gif' }[file.mimetype];
  const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, name), file.buffer);
  const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  return `${base.replace(/\/$/, '')}/uploads/${name}`;
}

// POST /api/upload  (multipart field name: "images")
router.post('/', protect, adminOnly, upload.array('images', 10), async (req, res) => {
  if (!req.files?.length) throw httpError(400, 'No images received');
  const urls = await Promise.all(req.files.map((f) => (useCloudinary() ? toCloudinary(f) : toDisk(f, req))));
  res.status(201).json({ urls });
});

module.exports = router;
