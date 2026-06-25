const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const getStorage = (folderName) => new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: folderName,
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'pdf']
  }
});

const uploadAvatar = multer({ 
  storage: getStorage('tiaraschedule_avatars'),
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});

const uploadProof = multer({ 
  storage: getStorage('tiaraschedule_proofs'),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

module.exports = {
  cloudinary,
  uploadAvatar,
  uploadProof
};
