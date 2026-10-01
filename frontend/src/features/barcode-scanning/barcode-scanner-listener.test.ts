import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBarcodeScannerListener } from './barcode-scanner-listener.hook';

// §6: a scanner types faster than 30 ms per key and ends with Enter; a person cannot.
let clock = 0;
const pressKeys = (text: string, gapMs: number, target: EventTarget = window) => {
  for (const key of text) {
    clock += gapMs;
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  }
};
const pressEnter = () => {
  clock += 5;
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
};

describe('useBarcodeScannerListener', () => {
  beforeEach(() => {
    clock = 1_000;
    // Fake timers would also freeze performance.now(); the key gaps are driven by `clock` instead.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
  });
  afterEach(() => vi.useRealTimers());

  it('turns a fast burst of keys ending in Enter into one scan, with no field focused', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScannerListener({ isEnabled: true, onScan }));
    pressKeys('LOC-SR1-R1-L1', 8);
    pressEnter();
    expect(onScan).toHaveBeenCalledWith('LOC-SR1-R1-L1');
  });

  it('flushes after 100 ms of silence when the scanner sends no Enter', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScannerListener({ isEnabled: true, onScan }));
    pressKeys('6290360501231', 8);
    vi.advanceTimersByTime(120);
    expect(onScan).toHaveBeenCalledWith('6290360501231');
  });

  it('ignores a person typing at human speed', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScannerListener({ isEnabled: true, onScan }));
    pressKeys('LOC-SR1', 150);
    pressEnter();
    expect(onScan).not.toHaveBeenCalled();
  });

  it('reports the same code within 1.5 s as a duplicate, not a second scan', () => {
    const onScan = vi.fn();
    const onDuplicate = vi.fn();
    vi.setSystemTime(new Date('2026-10-01T09:00:00Z'));
    renderHook(() => useBarcodeScannerListener({ isEnabled: true, onScan, onDuplicate }));
    pressKeys('LOC-SR1-R1-L1', 8);
    pressEnter();
    vi.setSystemTime(new Date('2026-10-01T09:00:01Z'));
    pressKeys('LOC-SR1-R1-L1', 8);
    pressEnter();
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onDuplicate).toHaveBeenCalledWith('LOC-SR1-R1-L1');
  });

  it('never treats typing inside a form field as a scan', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScannerListener({ isEnabled: true, onScan }));
    const input = document.createElement('input');
    document.body.append(input);
    pressKeys('LOC-SR1-R1-L1', 8, input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onScan).not.toHaveBeenCalled();
    input.remove();
  });

  it('does nothing while disabled', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScannerListener({ isEnabled: false, onScan }));
    pressKeys('LOC-SR1-R1-L1', 8);
    pressEnter();
    expect(onScan).not.toHaveBeenCalled();
  });
});
