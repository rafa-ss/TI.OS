const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const getSupabase = require('../config/supabase');
const env = require('../config/env');

const uploadDir = path.resolve(env.UPLOAD_LOCAL_DIR);

async function uploadFile(file, folder = 'misc') {
  const ext = path.extname(file.originalname);
  const id = crypto.randomBytes(8).toString('hex');
  const filename = `${Date.now()}-${id}${ext}`;
  const objectPath = `${folder}/${filename}`;

  const supabase = getSupabase();

  if (supabase) {
    const { error } = await supabase.storage
      .from(env.SUPABASE_BUCKET)
      .upload(objectPath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });
    if (error) throw new Error(`Supabase upload error: ${error.message}`);
    const { data } = supabase.storage.from(env.SUPABASE_BUCKET).getPublicUrl(objectPath);
    return {
      name: file.originalname,
      url: data.publicUrl,
      path: objectPath,
      storage: 'supabase',
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  const folderDir = path.join(uploadDir, folder);
  if (!fs.existsSync(folderDir)) fs.mkdirSync(folderDir, { recursive: true });
  const localPath = path.join(folderDir, filename);
  fs.writeFileSync(localPath, file.buffer);

  return {
    name: file.originalname,
    url: `/uploads/${folder}/${filename}`,
    path: localPath,
    storage: 'local',
    mimeType: file.mimetype,
    size: file.size,
  };
}

async function deleteFile(att) {
  try {
    const supabase = getSupabase();
    if (att.storage === 'supabase' && supabase) {
      await supabase.storage.from(env.SUPABASE_BUCKET).remove([att.path]);
    } else if (att.path && fs.existsSync(att.path)) {
      fs.unlinkSync(att.path);
    }
  } catch (_) { /* ignore */ }
}

module.exports = { uploadFile, deleteFile };