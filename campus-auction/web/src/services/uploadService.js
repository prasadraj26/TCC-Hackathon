import { API_BASE } from './apiConfig';

/**
 * Uploads an image using Cloudinary signed upload flow,
 * with fallback to client-side data URL preview in demo/setup mode.
 */
export async function uploadImage(file, headers) {
  try {
    // 1. Request signature from server
    const signRes = await fetch(`${API_BASE}/uploads/sign`, {
      method: 'POST',
      headers
    });
    const signData = await signRes.json();

    if (signData.isConfigured && signData.signature) {
      // Direct signed upload to Cloudinary CDN
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', signData.apiKey);
      formData.append('timestamp', signData.timestamp);
      formData.append('signature', signData.signature);
      formData.append('folder', signData.folder);

      const cloudRes = await fetch(
        `https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData
        }
      );
      const cloudData = await cloudRes.json();
      if (!cloudRes.ok) throw new Error(cloudData.error?.message || 'Cloudinary upload failed');
      return cloudData.secure_url;
    }
  } catch (err) {
    console.warn('[UploadService] Cloudinary signing unavailable, generating local image preview:', err.message);
  }

  // Fallback: Read file locally as Data URL
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
