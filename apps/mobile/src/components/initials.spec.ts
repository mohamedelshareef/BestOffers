import { initials } from './initials';

describe('avatar initials fallback (N3)', () => {
  it('takes first + last initial for multi-word names', () => {
    expect(initials('Mohamed Elshareef')).toBe('ME');
    expect(initials('  Sara  Al Ali  ')).toBe('SA');
  });
  it('takes up to two letters for a single word', () => {
    expect(initials('Reem')).toBe('RE');
    expect(initials('x')).toBe('X');
  });
  it('falls back to ؟ when nothing is known', () => {
    expect(initials(null)).toBe('؟');
    expect(initials('')).toBe('؟');
    expect(initials('   ')).toBe('؟');
  });
});
