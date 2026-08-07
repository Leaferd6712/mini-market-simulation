import { describe, it, expect } from 'vitest';
import {
  sanitizePlayerName,
  clampScore,
  clampDay,
  clampLevel,
  clampScorePayload,
  escapeHtml,
} from '../../src/utils/sanitize.js';

describe('sanitizePlayerName', () => {
  it('strips HTML tags', () => {
    expect(sanitizePlayerName('<script>alert(1)</script>Bob')).toBe('alert1Bob');
  });

  it('allows alphanumeric, spaces, underscore, hyphen, apostrophe', () => {
    expect(sanitizePlayerName("Ada_Lovelace-42")).toBe('Ada_Lovelace-42');
    expect(sanitizePlayerName("O'Brien-2")).toBe("O'Brien-2");
  });

  it('removes other punctuation', () => {
    expect(sanitizePlayerName('Bob!!! @#$')).toBe('Bob');
  });

  it('trims and collapses whitespace', () => {
    expect(sanitizePlayerName('  Ann   Marie  ')).toBe('Ann Marie');
  });

  it('caps length at 30', () => {
    expect(sanitizePlayerName('A'.repeat(50)).length).toBe(30);
  });

  it('handles null/undefined', () => {
    expect(sanitizePlayerName(null)).toBe('');
    expect(sanitizePlayerName(undefined)).toBe('');
  });
});

describe('clamp helpers', () => {
  it('clamps score/day/level', () => {
    expect(clampScore(-5)).toBe(0);
    expect(clampDay(99999)).toBe(10000);
    expect(clampLevel(9)).toBe(4);
  });

  it('clampScorePayload', () => {
    expect(clampScorePayload({ score: -5, day: -1, level: 99 })).toEqual({
      score: 0,
      day: 0,
      level: 4,
    });
  });

  it('escapeHtml', () => {
    expect(escapeHtml('<b>x</b>')).toBe('&lt;b&gt;x&lt;/b&gt;');
  });
});
