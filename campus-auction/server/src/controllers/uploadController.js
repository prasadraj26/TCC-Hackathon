import { v2 as cloudinary } from 'cloudinary';

export function signUpload(req, res, next) {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    const isConfigured = cloudName && 
      apiKey && 
      apiSecret && 
      cloudName !== 'your-cloudinary-cloud-name' &&
      apiKey !== 'your-cloudinary-api-key';

    if (!isConfigured) {
      return res.json({
        success: true,
        isConfigured: false,
        message: 'Cloudinary credentials not configured in server/.env. Using client-side image preview / sample images.'
      });
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = 'campus_auction';

    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        folder
      },
      apiSecret
    );

    res.json({
      success: true,
      isConfigured: true,
      signature,
      timestamp,
      apiKey,
      cloudName,
      folder
    });
  } catch (error) {
    next(error);
  }
}
