import { getWikiModStatus, checkWikiModAvailability } from '../wikiService';

describe('WikiService', () => {
  describe('getWikiModStatus', () => {
    it('should return available: false when no health data', () => {
      const result = getWikiModStatus(null);
      expect(result.available).toBe(false);
    });

    it('should return available: false when no mods in health data', () => {
      const healthData = { version: '1.0.0' };
      const result = getWikiModStatus(healthData);
      expect(result.available).toBe(false);
    });

    it('should return available: true when wiki mod is present (string format)', () => {
      const healthData = {
        version: '1.0.0',
        mods: ['openagents.mods.workspace.messaging', 'openagents.mods.workspace.wiki']
      };
      const result = getWikiModStatus(healthData);
      expect(result.available).toBe(true);
      expect(result.version).toBe('1.0.0');
    });

    it('should return available: true when wiki mod is present (object format)', () => {
      const healthData = {
        version: '1.0.0',
        mods: [
          { name: 'openagents.mods.workspace.messaging' },
          { name: 'openagents.mods.workspace.wiki' }
        ]
      };
      const result = getWikiModStatus(healthData);
      expect(result.available).toBe(true);
      expect(result.version).toBe('1.0.0');
    });

    it('should return available: true when wiki is in mod name (partial match)', () => {
      const healthData = {
        version: '1.0.0',
        mods: ['messaging', 'wiki']
      };
      const result = getWikiModStatus(healthData);
      expect(result.available).toBe(true);
    });

    it('should return available: false when wiki mod is not present', () => {
      const healthData = {
        version: '1.0.0',
        mods: ['openagents.mods.workspace.messaging', 'openagents.mods.workspace.forum']
      };
      const result = getWikiModStatus(healthData);
      expect(result.available).toBe(false);
    });
  });

  describe('checkWikiModAvailability', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('should return available: false when fetch fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      const result = await checkWikiModAvailability('http://localhost:8080');
      expect(result.available).toBe(false);
    });

    it('should return available: false when response is not ok', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404
      });
      
      const result = await checkWikiModAvailability('http://localhost:8080');
      expect(result.available).toBe(false);
    });

    it('should return available: true when wiki mod is detected', async () => {
      const mockHealthData = {
        version: '1.0.0',
        mods: ['openagents.mods.workspace.wiki']
      };
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockHealthData)
      });
      
      const result = await checkWikiModAvailability('http://localhost:8080');
      expect(result.available).toBe(true);
      expect(result.version).toBe('1.0.0');
    });

    it('should return available: false when wiki mod is not detected', async () => {
      const mockHealthData = {
        version: '1.0.0',
        mods: ['openagents.mods.workspace.messaging']
      };
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockHealthData)
      });
      
      const result = await checkWikiModAvailability('http://localhost:8080');
      expect(result.available).toBe(false);
    });
  });
});
