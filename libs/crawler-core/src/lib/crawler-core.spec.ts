import { NewsCrawler } from '../crawlers/NewsCrawler';

describe('crawlerCore', () => {
  it('should export main components', () => {
    expect(NewsCrawler).toBeDefined();
    expect(typeof NewsCrawler).toBe('function');
  });
});
