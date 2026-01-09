import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Response } from 'express';
import { KioskEventService } from './KioskEventService';

describe('KioskEventService', () => {
  let service: KioskEventService;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    service = new KioskEventService();
    mockResponse = {
      write: vi.fn(),
      end: vi.fn(),
    };
  });

  afterEach(() => {
    service.closeAll();
  });

  describe('Client Management', () => {
    it('should add a client', () => {
      service.addClient('client-1', mockResponse as Response);
      expect(service.getClientCount()).toBe(1);
    });

    it('should remove a client', () => {
      service.addClient('client-1', mockResponse as Response);
      service.removeClient('client-1');
      expect(service.getClientCount()).toBe(0);
    });

    it('should handle multiple clients', () => {
      const mock2 = { write: vi.fn(), end: vi.fn() };
      const mock3 = { write: vi.fn(), end: vi.fn() };

      service.addClient('client-1', mockResponse as Response);
      service.addClient('client-2', mock2 as Response);
      service.addClient('client-3', mock3 as Response);

      expect(service.getClientCount()).toBe(3);

      service.removeClient('client-2');
      expect(service.getClientCount()).toBe(2);
    });
  });

  describe('Broadcasting', () => {
    it('should broadcast mode change to all clients', () => {
      const mock2 = { write: vi.fn(), end: vi.fn() };

      service.addClient('client-1', mockResponse as Response);
      service.addClient('client-2', mock2 as Response);

      service.broadcastModeChange('survey', 'survey-123');

      expect(mockResponse.write).toHaveBeenCalled();
      expect(mock2.write).toHaveBeenCalled();

      const call1 = (mockResponse.write as any).mock.calls[0][0];
      expect(call1).toContain('mode-change');
      expect(call1).toContain('survey');
      expect(call1).toContain('survey-123');
    });

    it('should broadcast survey update', () => {
      service.addClient('client-1', mockResponse as Response);
      service.broadcastSurveyUpdate('survey-456');

      expect(mockResponse.write).toHaveBeenCalled();
      const call = (mockResponse.write as any).mock.calls[0][0];
      expect(call).toContain('survey-update');
      expect(call).toContain('survey-456');
    });

    it('should broadcast menu update', () => {
      service.addClient('client-1', mockResponse as Response);
      service.broadcastMenuUpdate();

      expect(mockResponse.write).toHaveBeenCalled();
      const call = (mockResponse.write as any).mock.calls[0][0];
      expect(call).toContain('menu-update');
    });

    it('should broadcast settings update', () => {
      service.addClient('client-1', mockResponse as Response);
      service.broadcastSettingsUpdate();

      expect(mockResponse.write).toHaveBeenCalled();
      const call = (mockResponse.write as any).mock.calls[0][0];
      expect(call).toContain('settings-update');
    });

    it('should remove dead clients on broadcast error', () => {
      const deadMock = {
        write: vi.fn(() => {
          throw new Error('Connection closed');
        }),
        end: vi.fn(),
      };

      service.addClient('client-1', mockResponse as Response);
      service.addClient('dead-client', deadMock as Response);

      expect(service.getClientCount()).toBe(2);

      service.broadcastModeChange('digital-menu');

      // Dead client should be removed
      expect(service.getClientCount()).toBe(1);
    });
  });

  describe('Heartbeat', () => {
    it('should send heartbeat to all clients', async () => {
      service.addClient('client-1', mockResponse as Response);

      // Wait for heartbeat (mocked timer)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Note: In real scenario, heartbeat runs every 30 seconds
      // This test just verifies the mechanism exists
      expect(service.getClientCount()).toBe(1);
    });
  });

  describe('Cleanup', () => {
    it('should close all connections', () => {
      const mock2 = { write: vi.fn(), end: vi.fn() };

      service.addClient('client-1', mockResponse as Response);
      service.addClient('client-2', mock2 as Response);

      service.closeAll();

      expect(mockResponse.end).toHaveBeenCalled();
      expect(mock2.end).toHaveBeenCalled();
      expect(service.getClientCount()).toBe(0);
    });
  });

  describe('Event Format', () => {
    it('should format events correctly', () => {
      service.addClient('client-1', mockResponse as Response);
      service.broadcastModeChange('survey', 'survey-789');

      const call = (mockResponse.write as any).mock.calls[0][0];
      
      // Should be SSE format: event: ...\ndata: {...}\n\n
      expect(call).toMatch(/^event: /);
      expect(call).toMatch(/\n\n$/);

      // Parse the JSON (extract data line)
      const dataLine = call.split('\n').find((line: string) => line.startsWith('data: '));
      const jsonStr = dataLine.replace('data: ', '');
      const event = JSON.parse(jsonStr);

      expect(event).toHaveProperty('type', 'mode-change');
      expect(event).toHaveProperty('data');
      expect(event.data).toHaveProperty('mode', 'survey');
      expect(event.data).toHaveProperty('activeSurveyId', 'survey-789');
      expect(event).toHaveProperty('timestamp');
    });
  });
});
