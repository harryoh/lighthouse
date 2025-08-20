import { prisma, contentService } from '../index';

describe('database library', () => {
  it('should export main components', () => {
    expect(prisma).toBeDefined();
    expect(contentService).toBeDefined();
    expect(typeof contentService.saveContent).toBe('function');
  });
});
