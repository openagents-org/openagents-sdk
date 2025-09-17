import { checkForumModAvailability, getForumModStatus } from '../forumService';

// Mock fetch
global.fetch = jest.fn();

describe('forumService', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  describe('checkForumModAvailability', () => {
    it('should return available: true when forum mod is present', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          mods: [
            { name: 'openagents.mods.workspace.messaging' },
            { name: 'openagents.mods.workspace.forum' }
          ],
          version: '1.0.0'
        })
      });

      const result = await checkForumModAvailability('http://localhost:8080');
      
      expect(result).toEqual({
        available: true,
        version: '1.0.0'
      });
    });

    it('should return available: false when forum mod is not present', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          mods: [
            { name: 'openagents.mods.workspace.messaging' }
          ],
          version: '1.0.0'
        })
      });

      const result = await checkForumModAvailability('http://localhost:8080');
      
      expect(result).toEqual({
        available: false,
        version: '1.0.0'
      });
    });

    it('should return available: false when fetch fails', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await checkForumModAvailability('http://localhost:8080');
      
      expect(result).toEqual({
        available: false
      });
    });
  });

  describe('getForumModStatus', () => {
    it('should return available: true when forum mod is in mods list', () => {
      const healthData = {
        mods: [
          { name: 'openagents.mods.workspace.messaging' },
          { name: 'openagents.mods.workspace.forum' }
        ],
        version: '1.0.0'
      };

      const result = getForumModStatus(healthData);
      
      expect(result).toEqual({
        available: true,
        version: '1.0.0'
      });
    });

    it('should return available: true when mod name contains "forum"', () => {
      const healthData = {
        mods: [
          { name: 'openagents.mods.workspace.messaging' },
          { name: 'custom.forum.mod' }
        ],
        version: '1.0.0'
      };

      const result = getForumModStatus(healthData);
      
      expect(result).toEqual({
        available: true,
        version: '1.0.0'
      });
    });

    it('should return available: false when no forum mod is present', () => {
      const healthData = {
        mods: [
          { name: 'openagents.mods.workspace.messaging' }
        ],
        version: '1.0.0'
      };

      const result = getForumModStatus(healthData);
      
      expect(result).toEqual({
        available: false,
        version: '1.0.0'
      });
    });

    it('should return available: false when healthData is invalid', () => {
      const result = getForumModStatus(null);
      
      expect(result).toEqual({
        available: false
      });
    });
  });
});
