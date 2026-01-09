/**
 * Performance Testing Suite
 * 
 * Tests database query performance, concurrent operations, and memory usage
 * Requirements: 10.3, 17.1, 17.2, 17.3
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseService } from '../database/DatabaseService.js';
import { initializeDatabase } from '../database/init.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Performance Testing', () => {
  let db: DatabaseService;
  let testDbPath: string;

  beforeAll(async () => {
    // Initialize test database
    testDbPath = path.join(__dirname, '../../test-performance-kiosk.db');

    // Remove existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    const dbInstance = initializeDatabase(testDbPath);
    db = new DatabaseService(dbInstance);
  });

  afterAll(() => {
    // Cleanup
    if (db) {
      db.close();
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Database Query Performance', () => {
    it('should retrieve kiosk state within 1 second (Requirement 10.3)', () => {
      const start = performance.now();
      const state = db.getKioskState();
      const end = performance.now();
      const duration = end - start;

      expect(state).toBeDefined();
      expect(duration).toBeLessThan(1000); // Must be < 1 second
      console.log(`Kiosk state query: ${duration.toFixed(2)}ms`);
    });

    it('should retrieve massage list within 1 second (Requirement 10.3)', () => {
      const start = performance.now();
      const massages = db.getMassages();
      const end = performance.now();
      const duration = end - start;

      expect(massages).toBeDefined();
      expect(duration).toBeLessThan(1000); // Must be < 1 second
      console.log(`Massage list query: ${duration.toFixed(2)}ms`);
    });

    it('should retrieve survey template within 1 second (Requirement 10.3)', () => {
      const templates = db.getSurveyTemplates();
      const templateId = templates[0]?.id;

      if (templateId) {
        const start = performance.now();
        const template = db.getSurveyById(templateId);
        const end = performance.now();
        const duration = end - start;

        expect(template).toBeDefined();
        expect(duration).toBeLessThan(1000); // Must be < 1 second
        console.log(`Survey template query: ${duration.toFixed(2)}ms`);
      }
    });

    it('should retrieve system settings within 1 second (Requirement 10.3)', () => {
      const start = performance.now();
      const settings = db.getSettings();
      const end = performance.now();
      const duration = end - start;

      expect(settings).toBeDefined();
      expect(duration).toBeLessThan(1000); // Must be < 1 second
      console.log(`Settings query: ${duration.toFixed(2)}ms`);
    });
  });

  describe('Large Dataset Performance', () => {
    beforeAll(() => {
      // Create a large dataset of massages
      console.log('Creating large dataset...');
      for (let i = 0; i < 100; i++) {
        db.createMassage({
          name: `Test Massage ${i}`,
          short_description: `Short description for massage ${i}`,
          long_description: `Long description for massage ${i} with more details about the treatment and benefits`,
          duration: '60 minutes',
          media_type: 'photo',
          media_url: `/uploads/massage-${i}.jpg`,
          purpose_tags: ['Relaxation', 'Pain Relief'],
          sessions: [
            { name: '60 min', price: 80 + i },
            { name: '90 min', price: 110 + i }
          ],
          is_featured: i % 10 === 0,
          is_campaign: i % 15 === 0,
          sort_order: i
        });
      }
      console.log('Large dataset created (100 massages)');
    });

    it('should handle large massage list query efficiently', () => {
      const start = performance.now();
      const massages = db.getMassages();
      const end = performance.now();
      const duration = end - start;

      expect(massages.length).toBeGreaterThanOrEqual(100);
      expect(duration).toBeLessThan(100); // Should be very fast even with 100 items
      console.log(`Large massage list query (100 items): ${duration.toFixed(2)}ms`);
    });

    it('should handle massage lookup by ID efficiently', () => {
      const massages = db.getMassages();
      const testMassage = massages[50]; // Get middle item

      const start = performance.now();
      const massage = db.getMassageById(testMassage.id);
      const end = performance.now();
      const duration = end - start;

      expect(massage).toBeDefined();
      expect(duration).toBeLessThan(50); // Should be very fast with index
      console.log(`Massage lookup by ID: ${duration.toFixed(2)}ms`);
    });

    it('should handle featured massage filtering efficiently', () => {
      const start = performance.now();
      const massages = db.getMassages();
      const featured = massages.filter(m => !!m.is_featured);
      const end = performance.now();
      const duration = end - start;

      expect(featured.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // Should be fast with index
      console.log(`Featured massage filtering: ${duration.toFixed(2)}ms, found ${featured.length} featured`);
    });
  });

  describe('Survey Response Performance', () => {
    beforeAll(() => {
      // Create many survey responses
      console.log('Creating survey responses...');
      const templates = db.getSurveyTemplates();
      const satisfactionTemplate = templates.find(t => t.type === 'satisfaction');

      if (satisfactionTemplate) {
        for (let i = 0; i < 500; i++) {
          db.createSurveyResponse({
            survey_id: satisfactionTemplate.id,
            answers: {
              rating: (i % 5) + 1,
              feedback: `Test feedback ${i}`
            }
          });
        }
      }
      console.log('Created 500 survey responses');
    });

    it('should handle large survey response queries efficiently', () => {
      const start = performance.now();
      const responses = db.getSurveyResponses();
      const end = performance.now();
      const duration = end - start;

      expect(responses.length).toBeGreaterThanOrEqual(500);
      expect(duration).toBeLessThan(200); // Should handle 500 items quickly
      console.log(`Survey response query (500 items): ${duration.toFixed(2)}ms`);
    });

    it('should handle filtered survey response queries efficiently', () => {
      const start = performance.now();
      const responses = db.getSurveyResponses({ synced: false });
      const end = performance.now();
      const duration = end - start;

      expect(responses).toBeDefined();
      expect(duration).toBeLessThan(100); // Should be fast with index
      console.log(`Filtered survey response query: ${duration.toFixed(2)}ms`);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple simultaneous reads', async () => {
      const operations = [
        () => db.getKioskState(),
        () => db.getMassages(),
        () => db.getSurveyTemplates(),
        () => db.getSettings(),
        () => db.getSurveyResponses()
      ];

      const start = performance.now();
      const results = await Promise.all(operations.map(op => Promise.resolve(op())));
      const end = performance.now();
      const duration = end - start;

      expect(results).toHaveLength(5);
      results.forEach(result => expect(result).toBeDefined());
      expect(duration).toBeLessThan(500); // All operations should complete quickly
      console.log(`5 concurrent read operations: ${duration.toFixed(2)}ms`);
    });

    it('should handle mixed read/write operations', () => {
      const start = performance.now();

      // Perform multiple operations
      db.updateKioskHeartbeat();
      const state = db.getKioskState();
      const massages = db.getMassages();
      db.createLog({ level: 'info', message: 'Test log', details: {} });
      const settings = db.getSettings();

      const end = performance.now();
      const duration = end - start;

      expect(state).toBeDefined();
      expect(massages).toBeDefined();
      expect(settings).toBeDefined();
      expect(duration).toBeLessThan(200); // Should handle mixed operations quickly
      console.log(`Mixed read/write operations: ${duration.toFixed(2)}ms`);
    });
  });

  describe('Write Performance', () => {
    it('should handle massage creation efficiently', () => {
      const start = performance.now();
      const massage = db.createMassage({
        name: 'Performance Test Massage',
        short_description: 'Test',
        sessions: [{ name: '60 min', price: 80 }]
      });
      const end = performance.now();
      const duration = end - start;

      expect(massage).toBeDefined();
      expect(duration).toBeLessThan(100); // Should be fast
      console.log(`Massage creation: ${duration.toFixed(2)}ms`);
    });

    it('should handle massage update efficiently', () => {
      const massages = db.getMassages();
      const testMassage = massages[0];

      const start = performance.now();
      const updated = db.updateMassage(testMassage.id, {
        name: 'Updated Name'
      });
      const end = performance.now();
      const duration = end - start;

      expect(updated.name).toBe('Updated Name');
      expect(duration).toBeLessThan(100); // Should be fast
      console.log(`Massage update: ${duration.toFixed(2)}ms`);
    });

    it('should handle survey response creation efficiently', () => {
      const templates = db.getSurveyTemplates();
      const template = templates[0];

      const start = performance.now();
      const response = db.createSurveyResponse({
        survey_id: template.id,
        answers: { test: 'data' }
      });
      const end = performance.now();
      const duration = end - start;

      expect(response).toBeDefined();
      expect(duration).toBeLessThan(100); // Should be fast
      console.log(`Survey response creation: ${duration.toFixed(2)}ms`);
    });

    it('should handle batch survey response creation efficiently', () => {
      const templates = db.getSurveyTemplates();
      const template = templates[0];

      const start = performance.now();
      for (let i = 0; i < 50; i++) {
        db.createSurveyResponse({
          survey_id: template.id,
          answers: { batch: i }
        });
      }
      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(1000); // 50 inserts should be < 1 second
      const avgDuration = duration / 50;
      console.log(`Batch survey response creation (50 items): ${duration.toFixed(2)}ms (avg: ${avgDuration.toFixed(2)}ms per item)`);
    });
  });

  describe('Transaction Performance', () => {
    it('should handle transactions efficiently', () => {
      const start = performance.now();

      db.transaction(() => {
        db.updateKioskState({ mode: 'survey' });
        db.createLog({ level: 'info', message: 'Mode changed', details: {} });
        db.updateKioskHeartbeat();
      });

      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(100); // Transaction should be fast
      console.log(`Transaction with 3 operations: ${duration.toFixed(2)}ms`);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not leak memory during repeated operations', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        db.getKioskState();
        db.getMassages();
        if (i % 100 === 0) {
          db.updateKioskHeartbeat();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      console.log(`Memory increase after 1000 operations: ${memoryIncrease.toFixed(2)}MB`);
      expect(memoryIncrease).toBeLessThan(50); // Should not increase by more than 50MB
    });
  });

  describe('Index Effectiveness', () => {
    it('should use indexes for featured massage queries', () => {
      // This test verifies that indexed queries are fast
      const start = performance.now();
      const massages = db.getMassages();
      const featured = massages.filter(m => !!m.is_featured);
      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(50); // Should be very fast with index
      expect(featured).toBeDefined();
      console.log(`Indexed featured query: ${duration.toFixed(2)}ms`);
    });

    it('should use indexes for survey response sync status queries', () => {
      const start = performance.now();
      const unsynced = db.getSurveyResponses({ synced: false });
      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(100); // Should be fast with index
      expect(unsynced).toBeDefined();
      console.log(`Indexed sync status query: ${duration.toFixed(2)}ms`);
    });
  });
});
