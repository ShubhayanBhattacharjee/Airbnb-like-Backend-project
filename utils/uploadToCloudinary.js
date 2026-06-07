import cloudinary from '../config/cloudinary.js';
import { fileTypeFromBuffer } from 'file-type';

export const uploadToCloudinary = async (fileBuffer, folder, width, height) => {
    const type = await fileTypeFromBuffer(fileBuffer);
    if (!type || !['image/jpeg', 'image/png'].includes(type.mime)) {
        throw new Error('Only JPG and PNG images are allowed');
    }
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder,
                transformation: [
                    { width, height, crop: 'fill', gravity: 'auto' },
                    { quality: 80, fetch_format: 'auto' }
                ]
            },
            (err, result) => {
                if (err) return reject(err);
                resolve(result.secure_url);
            }
        );
        stream.end(fileBuffer);
    });
};