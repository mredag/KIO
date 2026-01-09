import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

/**
 * MediaService handles file upload and management operations
 * - File upload handling with multer
 * - File type validation (MP4, JPEG, PNG only)
 * - File size validation (50MB video, 5MB images)
 * - Unique filename generation
 * - File deletion for cleanup
 * - Disk usage monitoring
 * Requirements: 4.3
 */
export class MediaService {
  private uploadDir: string;
  private readonly MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_VIDEO_TYPES = ['video/mp4'];
  private readonly ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png'];
  private readonly ALLOWED_EXTENSIONS = ['.mp4', '.jpg', '.jpeg', '.png'];

  constructor(uploadDir: string) {
    if (!uploadDir) {
      throw new Error('uploadDir is required - must be provided from centralized config');
    }
    this.uploadDir = uploadDir;
    this.ensureUploadDirectory();
  }

  /**
   * Ensure upload directory exists
   */
  private ensureUploadDirectory(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Configure multer storage with unique filename generation
   */
  private getStorage(): multer.StorageEngine {
    return multer.diskStorage({
      destination: (_req, _file, cb) => {
        cb(null, this.uploadDir);
      },
      filename: (_req, file, cb) => {
        // Generate unique filename to prevent overwrites
        const ext = path.extname(file.originalname).toLowerCase();
        const uniqueName = `${randomUUID()}${ext}`;
        cb(null, uniqueName);
      },
    });
  }

  /**
   * File filter for type validation
   * Requirements: 4.3 - MP4, JPEG, PNG only
   */
  private fileFilter(
    _req: Express.Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ): void {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype.toLowerCase();

    // Check if extension is allowed
    if (!this.ALLOWED_EXTENSIONS.includes(ext)) {
      cb(new Error(`Invalid file type. Only MP4, JPEG, and PNG files are allowed.`));
      return;
    }

    // Check if mime type matches
    const isValidVideo = this.ALLOWED_VIDEO_TYPES.includes(mimeType);
    const isValidImage = this.ALLOWED_IMAGE_TYPES.includes(mimeType);

    if (!isValidVideo && !isValidImage) {
      cb(new Error(`Invalid file type. Only MP4, JPEG, and PNG files are allowed.`));
      return;
    }

    cb(null, true);
  }

  /**
   * Create multer upload middleware
   * Requirements: 4.3 - 50MB video, 5MB images
   */
  getUploadMiddleware(): multer.Multer {
    return multer({
      storage: this.getStorage(),
      fileFilter: this.fileFilter.bind(this),
      limits: {
        fileSize: this.MAX_VIDEO_SIZE, // Maximum size (will be checked per file type)
      },
    });
  }

  /**
   * Validate file size based on type
   * Requirements: 4.3 - 50MB video, 5MB images
   */
  validateFileSize(file: Express.Multer.File): { valid: boolean; error?: string } {
    const isVideo = this.ALLOWED_VIDEO_TYPES.includes(file.mimetype.toLowerCase());
    const isImage = this.ALLOWED_IMAGE_TYPES.includes(file.mimetype.toLowerCase());

    if (isVideo && file.size > this.MAX_VIDEO_SIZE) {
      return {
        valid: false,
        error: `Video file size exceeds maximum of ${this.MAX_VIDEO_SIZE / (1024 * 1024)}MB`,
      };
    }

    if (isImage && file.size > this.MAX_IMAGE_SIZE) {
      return {
        valid: false,
        error: `Image file size exceeds maximum of ${this.MAX_IMAGE_SIZE / (1024 * 1024)}MB`,
      };
    }

    return { valid: true };
  }

  /**
   * Upload media file from memory buffer
   * Used when multer is configured with memoryStorage
   */
  async uploadMedia(file: Express.Multer.File): Promise<string> {
    // Validate file type
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype.toLowerCase();

    if (!this.ALLOWED_EXTENSIONS.includes(ext)) {
      throw new Error('Invalid file type. Only MP4, JPEG, and PNG files are allowed.');
    }

    const isValidVideo = this.ALLOWED_VIDEO_TYPES.includes(mimeType);
    const isValidImage = this.ALLOWED_IMAGE_TYPES.includes(mimeType);

    if (!isValidVideo && !isValidImage) {
      throw new Error('Invalid file type. Only MP4, JPEG, and PNG files are allowed.');
    }

    // Validate file size
    const sizeValidation = this.validateFileSize(file);
    if (!sizeValidation.valid) {
      throw new Error(sizeValidation.error);
    }

    // Generate unique filename
    const uniqueName = `${randomUUID()}${ext}`;
    const filePath = path.join(this.uploadDir, uniqueName);

    // Write file to disk
    fs.writeFileSync(filePath, file.buffer);

    // Return public URL
    return this.getPublicUrl(uniqueName);
  }

  /**
   * Get public URL path for uploaded file
   */
  getPublicUrl(filename: string): string {
    return `/uploads/${filename}`;
  }

  /**
   * Delete media file
   * Requirements: 4.3 - File deletion for cleanup
   */
  async deleteMedia(fileUrl: string): Promise<void> {
    try {
      // Extract filename from URL (e.g., "/uploads/filename.jpg" -> "filename.jpg")
      const filename = path.basename(fileUrl);
      const filePath = path.join(this.uploadDir, filename);

      // Check if file exists before attempting deletion
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('Error deleting media file:', error);
      throw new Error('Failed to delete media file');
    }
  }

  /**
   * Get disk usage information
   * Requirements: 4.3 - Disk usage monitoring
   */
  getDiskUsage(): { used: number; available: number; total: number } {
    try {
      // Get upload directory size
      const used = this.getDirectorySize(this.uploadDir);

      // Get filesystem stats (platform-specific)
      // For cross-platform compatibility, we'll use a simple approach
      // In production, consider using a library like 'diskusage' for accurate stats
      const stats = fs.statfsSync ? fs.statfsSync(this.uploadDir) : null;

      if (stats) {
        const total = stats.blocks * stats.bsize;
        const available = stats.bavail * stats.bsize;
        return { used, available, total };
      }

      // Fallback if statfs is not available
      return { used, available: 0, total: 0 };
    } catch (error) {
      console.error('Error getting disk usage:', error);
      return { used: 0, available: 0, total: 0 };
    }
  }

  /**
   * Calculate directory size recursively
   */
  private getDirectorySize(dirPath: string): number {
    let size = 0;

    try {
      if (!fs.existsSync(dirPath)) {
        return 0;
      }

      const files = fs.readdirSync(dirPath);

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
          size += this.getDirectorySize(filePath);
        } else {
          size += stats.size;
        }
      }
    } catch (error) {
      console.error('Error calculating directory size:', error);
    }

    return size;
  }

  /**
   * Get upload directory path
   */
  getUploadDir(): string {
    return this.uploadDir;
  }
}
