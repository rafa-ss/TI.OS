const multer = require('multer');
const path = require('path');
const fs = require('fs');
const env = require('../config/env');

const uploadDir = path.resolve(env.UPLOAD_LOCAL_DIR);
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const memoryStorage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp|gif|pdf|doc|docx|xls|xlsx|csv|txt/i;
  if (allowed.test(path.extname(file.originalname)) || allowed.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo não permitido'));
  }
};

const upload = multer({
  storage: memoryStorage,
  fileFilter,
  limits: { fileSize: env.UPLOAD_MAX_SIZE_MB * 1024 * 1024 },
});

module.exports = upload;
