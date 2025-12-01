const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// If Cloudinary credentials are present, configure Cloudinary storage.
if (process.env.CLOUD_NAME && process.env.CLOUD_API_KEY && process.env.CLOUD_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
  });

  const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'wanderlust_DEV',
      allowedFormats: ['png', 'jpg', 'jpeg'],
    },
  });

  module.exports = {
    cloudinary,
    storage,
    usingCloudinary: true,
  };

} else {
  // Fallback to local disk storage for development when Cloudinary is not configured or account is disabled.
  console.log('Cloudinary not configured or disabled — using local disk storage for uploads.');

  const uploadDir = path.join(__dirname, 'public', 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const safeName = Date.now() + '-' + file.originalname.replace(/\s+/g, '-');
      cb(null, safeName);
    }
  });

  module.exports = {
    cloudinary: null,
    storage,
    usingCloudinary: false,
  };
}