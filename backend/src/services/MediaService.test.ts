import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MediaService } from './MediaService.js';
import fs from 'fs';
import path from 'path';

describe('MediaService', () => {
  let mediaService: MediaService;
  const testUploadDir = './test-uploads';

  beforeEach(() => {
    // Create test upload directory
    if (!fs.existsSync(testUploadDir)) {
      fs.mkdirSync(testUploadDir, { recursive: true });
    }
    mediaService = new MediaService(testUploadDir);
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testUploadDir)) {
      fs.rmSync(testUploadDir, { recursive: true, force: true });
    }
  });

  describe('File Size Validation', () => {
    it('should accept video files under 50MB', () => {
      const mockFile = {
        mimetype: 'video/mp4',
        size: 40 * 1024 * 1024, // 40MB
      } as Express.Multer.File;

      const result = mediaService.validateFileSize(mockFile);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject video files over 50MB', () => {
      const mockFile = {
        mimetype: 'video/mp4',
        size: 60 * 1024 * 1024, // 60MB
      } as Express.Multer.File;

      const result = mediaService.validateFileSize(mockFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('50MB');
    });

    it('should accept image files under 5MB', () => {
      const mockFile = {
        mimetype: 'image/jpeg',
        size: 3 * 1024 * 1024, // 3MB
      } as Express.Multer.File;

      const result = mediaService.validateFileSize(mockFile);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject image files over 5MB', () => {
      const mockFile = {
        mimetype: 'image/png',
        size: 7 * 1024 * 1024, // 7MB
      } as Express.Multer.File;

      const result = mediaService.validateFileSize(mockFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('5MB');
    });
  });

  describe('File Deletion', () => {
    it('should delete existing file', async () => {
      // Create a test file
      const testFileName = 'test-file.jpg';
      const testFilePath = path.join(testUploadDir, testFileName);
      fs.writeFileSync(testFilePath, 'test content');

      // Verify file exists
      expect(fs.existsSync(testFilePath)).toBe(true);

      // Delete file
      await mediaService.deleteMedia(`/uploads/${testFileName}`);

      // Verify file is deleted
      expect(fs.existsSync(testFilePath)).toBe(false);
    });

    it('should not throw error when deleting non-existent file', async () => {
      await expect(
        mediaService.deleteMedia('/uploads/non-existent.jpg')
      ).resolves.not.toThrow();
    });
  });

  describe('Public URL Generation', () => {
    it('should generate correct public URL', () => {
      const filename = 'test-image.jpg';
      const url = mediaService.getPublicUrl(filename);
      expect(url).toBe('/uploads/test-image.jpg');
    });
  });

  describe('Disk Usage Monitoring', () => {
    it('should return disk usage information', () => {
      const usage = mediaService.getDiskUsage();
      expect(usage).toHaveProperty('used');
      expect(usage).toHaveProperty('available');
      expect(usage).toHaveProperty('total');
      expect(typeof usage.used).toBe('number');
      expect(usage.used).toBeGreaterThanOrEqual(0);
    });

    it('should calculate directory size correctly', () => {
      // Create test files
      fs.writeFileSync(path.join(testUploadDir, 'file1.txt'), 'a'.repeat(100));
      fs.writeFileSync(path.join(testUploadDir, 'file2.txt'), 'b'.repeat(200));

      const usage = mediaService.getDiskUsage();
      expect(usage.used).toBeGreaterThanOrEqual(300); // At least 300 bytes
    });
  });

  describe('Upload Directory', () => {
    it('should create upload directory if it does not exist', () => {
      const newDir = './test-new-uploads';
      
      // Ensure directory doesn't exist
      if (fs.existsSync(newDir)) {
        fs.rmSync(newDir, { recursive: true, force: true });
      }

      // Create service (should create directory)
      new MediaService(newDir);
      
      // Verify directory was created
      expect(fs.existsSync(newDir)).toBe(true);

      // Clean up
      fs.rmSync(newDir, { recursive: true, force: true });
    });

    it('should return correct upload directory path', () => {
      const dir = mediaService.getUploadDir();
      expect(dir).toBe(testUploadDir);
    });
  });

  describe('Multer Middleware', () => {
    it('should create multer upload middleware', () => {
      const middleware = mediaService.getUploadMiddleware();
      expect(middleware).toBeDefined();
      expect(typeof middleware.single).toBe('function');
      expect(typeof middleware.array).toBe('function');
    });
  });
});
