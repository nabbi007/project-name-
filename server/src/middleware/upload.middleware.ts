import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Request } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { AppError } from '../utils/AppError';

const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');

function ensureDir(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Map of accepted MIME types to a canonical, safe file extension. We never
// trust the original extension - the stored extension is derived here.
const AUDIO_MIME_EXTENSIONS: Record<string, string> = {
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/wave': '.wav',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/aac': '.aac',
  'audio/ogg': '.ogg',
  'audio/webm': '.webm',
  'audio/3gpp': '.3gp',
};

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB

function makeStorage(subdir: string, extMap: Record<string, string>) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, ensureDir(path.join(UPLOADS_ROOT, subdir)));
    },
    filename: (_req, file, cb) => {
      // Safe, unguessable filename - original name is discarded.
      const ext = extMap[file.mimetype] ?? '.bin';
      const name = `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${ext}`;
      cb(null, name);
    },
  });
}

function mimeFilter(extMap: Record<string, string>) {
  return (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (extMap[file.mimetype]) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          `Unsupported file type: ${file.mimetype}`,
          422,
          'INVALID_FILE_TYPE'
        )
      );
    }
  };
}

export const audioUpload = multer({
  storage: makeStorage('audio', AUDIO_MIME_EXTENSIONS),
  limits: { fileSize: MAX_AUDIO_BYTES },
  fileFilter: mimeFilter(AUDIO_MIME_EXTENSIONS),
});

export const audioRelativePath = (filename: string): string =>
  path.posix.join('uploads', 'audio', filename);
