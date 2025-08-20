/**
 * Root page tests
 */
describe('Root Page', () => {
  it('should redirect to dashboard', async () => {
    // Mock Next.js redirect function
    const mockRedirect = jest.fn();
    jest.doMock('next/navigation', () => ({
      redirect: mockRedirect,
    }));

    // Import the page component after mocking
    const { default: Page } = await import('../src/app/page');

    // Call the page function
    Page();

    // Verify redirect was called
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });
});
