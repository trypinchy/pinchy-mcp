import { describe, expect, it } from 'vitest';
import { parseStoreDomain } from './store-domain.js';

describe('parseStoreDomain', () => {
  it.each([
    ['momcozy.com', 'momcozy.com'],
    ['  WWW.Momcozy.com ', 'momcozy.com'],
    ['https://www.momcozy.com/products/x?ref=1', 'momcozy.com'],
    ['shop.example.co.uk/cart', 'shop.example.co.uk'],
  ])('reads %s as %s', (input, expected) => {
    expect(parseStoreDomain(input)).toBe(expected);
  });

  it.each(['', 'localhost', 'not a domain', 'http://127.0.0.1/', 'https://exa_mple.com', 'a'.repeat(3000)])(
    'rejects %s',
    (input) => {
      expect(parseStoreDomain(input)).toBeNull();
    },
  );
});
