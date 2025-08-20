describe('Simple Test Suite', () => {
  it('should pass basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle TypeScript types', () => {
    const testObj: any = { name: 'test', value: 42 };
    expect(testObj.name).toBe('test');
    expect(testObj.value).toBe(42);
  });
});