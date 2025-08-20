import { analyzer } from './analyzer';

describe('analyzer', () => {
  it('should have correct version and ready state', () => {
    expect(analyzer.version).toEqual('0.0.1');
    expect(analyzer.ready).toEqual(false);
  });
});
