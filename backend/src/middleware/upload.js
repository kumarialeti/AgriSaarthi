import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { mkdirSync } from 'fs';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10);

// Ensure upload directories exist
const ensureDir = (dir) => {
  try { mkdirSync(dir, { recursive: true }); } catch {}
};
ensureDir(`${UPLOAD_DIR}/images`);
ensureDir(`${UPLOAD_DIR}/documents`);
ensureDir(`${UPLOAD_DIR}/soil-reports`);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isImage = file.mimetype.startsWith('image/');
    const dir = isImage ? `${UPLOAD_DIR}/images` : `${UPLOAD_DIR}/documents`;
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const imageFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.mimetype)) {
    const err = new Error('Only JPEG, PNG, and WebP images are allowed.');
    err.code = 'INVALID_FILE_TYPE';
    return cb(err, false);
  }
  cb(null, true);
};

const documentFilter = (req, file, cb) => {
  const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
  if (!allowed.includes(file.mimetype)) {
    const err = new Error('Only PDF and image files are allowed.');
    err.code = 'INVALID_FILE_TYPE';
    return cb(err, false);
  }
  cb(null, true);
};

export const uploadCropImage = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
}).single('image');

export const uploadSoilReport = multer({
  storage,
  fileFilter: documentFilter,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
}).single('report');

export const uploadProfileAvatar = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB for avatars
}).single('avatar');
