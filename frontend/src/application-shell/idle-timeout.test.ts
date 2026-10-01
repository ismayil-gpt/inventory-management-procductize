import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIdleTimeout, writeLastActivity } from './idle-timeout.hook';

// DESC #6: warn in the last minute, sign out after the idle period, and any
// activity — in this tab or another — resets the clock.
describe('useIdleTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T09:00:00Z'));
    localStorage.clear();
    writeLastActivity(Date.now());
  });
  afterEach(() => vi.useRealTimers());

  it('warns with a countdown in the final minute, then signs out', () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useIdleTimeout(30, onTimeout));
    act(() => vi.advanceTimersByTime(29 * 60_000 + 5_000));
    expect(result.current.secondsLeft).not.toBeNull();
    expect(result.current.secondsLeft!).toBeLessThanOrEqual(60);
    expect(onTimeout).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(60_000));
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('keeps the session while the person is working', () => {
    const onTimeout = vi.fn();
    renderHook(() => useIdleTimeout(30, onTimeout));
    for (let minute = 0; minute < 45; minute += 10) {
      act(() => vi.advanceTimersByTime(10 * 60_000));
      act(() => {
        window.dispatchEvent(new Event('pointerdown'));
      });
    }
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('counts activity in another tab (shared through localStorage)', () => {
    const onTimeout = vi.fn();
    renderHook(() => useIdleTimeout(30, onTimeout));
    act(() => vi.advanceTimersByTime(25 * 60_000));
    writeLastActivity(Date.now());
    act(() => vi.advanceTimersByTime(25 * 60_000));
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('"Stay signed in" clears the warning', () => {
    const { result } = renderHook(() => useIdleTimeout(30, vi.fn()));
    act(() => vi.advanceTimersByTime(29 * 60_000 + 10_000));
    expect(result.current.secondsLeft).not.toBeNull();
    act(() => result.current.stayActive());
    expect(result.current.secondsLeft).toBeNull();
  });

  it('is off when no timeout is configured', () => {
    const onTimeout = vi.fn();
    renderHook(() => useIdleTimeout(undefined, onTimeout));
    act(() => vi.advanceTimersByTime(120 * 60_000));
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
