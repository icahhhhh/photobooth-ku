/**
 * Cloudinary Upload Helper
 * PhotoBooth Studio Pro
 * Cloud name: dhgv8evvo
 * Upload preset: photobooth_upload (Unsigned)
 */

const CLOUDINARY_CLOUD  = 'dhgv8evvo';
const CLOUDINARY_PRESET = 'photobooth_upload';
const HOSTING_URL       = 'https://photobooth-ku.vercel.app';

// Upload gambar (base64 dataURL) ke Cloudinary
async function uploadToCloudinary(base64DataUrl, publicId) {
  const formData = new FormData();
  formData.append('file', base64DataUrl);
  formData.append('upload_preset', CLOUDINARY_PRESET);
  formData.append('public_id', publicId);
  formData.append('folder', 'photobooth');

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) throw new Error('Cloudinary upload gagal: ' + res.status);
  const data = await res.json();
  return data.secure_url;
}

// Upload video/GIF (blob URL) ke Cloudinary sebagai video
async function uploadVideoToCloudinary(blobUrl, publicId) {
  const blobRes  = await fetch(blobUrl);
  const blob     = await blobRes.blob();

  const formData = new FormData();
  formData.append('file', blob, publicId + '.webm');
  formData.append('upload_preset', CLOUDINARY_PRESET);
  formData.append('public_id', publicId);
  formData.append('folder', 'photobooth');
  formData.append('resource_type', 'video');

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/video/upload`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) throw new Error('Cloudinary video upload gagal: ' + res.status);
  const data = await res.json();
  return data.secure_url;
}

window.uploadPhotoToFirebase = async function(base64DataUrl, rawShots = [], gifBlobUrl = null) {
  try {
    const photoId = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);

    if (typeof notify === 'function') notify('📤 Mengupload foto...', 'info');

    // 1. Upload foto frame
    const frameUrl = await uploadToCloudinary(base64DataUrl, `${photoId}_frame`);

    // 2. Upload foto mentah
    const rawUrls = [];
    for (let i = 0; i < rawShots.length; i++) {
      const url = await uploadToCloudinary(rawShots[i], `${photoId}_raw${i}`);
      rawUrls.push(url);
    }

    // 3. Upload GIF/video jika ada
    let gifUrl = null;
    if (gifBlobUrl) {
      try {
        if (typeof notify === 'function') notify('📤 Mengupload GIF...', 'info');
        gifUrl = await uploadVideoToCloudinary(gifBlobUrl, `${photoId}_gif`);
      } catch (e) {
        console.warn('[Cloudinary] GIF upload gagal (dilanjutkan tanpa GIF):', e);
      }
    }

    if (typeof notify === 'function') notify('✅ Upload selesai!', 'success');

    // 4. Return URL halaman download
    let downloadPageUrl = `${HOSTING_URL}/download.html?id=${photoId}&frame=${encodeURIComponent(frameUrl)}&raws=${encodeURIComponent(rawUrls.join('|'))}`;
    if (gifUrl) downloadPageUrl += `&gif=${encodeURIComponent(gifUrl)}`;

    console.log('[Cloudinary] Upload sukses:', downloadPageUrl);
    return downloadPageUrl;

  } catch (err) {
    console.error('[Cloudinary] Upload gagal:', err);
    if (typeof notify === 'function') notify('⚠️ Upload gagal: ' + err.message, 'error');
    return null;
  }
};
