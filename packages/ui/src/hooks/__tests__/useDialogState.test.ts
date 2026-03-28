import { renderHook, act } from '@testing-library/react';
import { useDialogState } from '../useDialogState';

interface TestItem {
  id: string;
  name: string;
}

describe('useDialogState', () => {
  it('starts with dialog closed', () => {
    const { result } = renderHook(() => useDialogState<TestItem>());

    expect(result.current.dialog.open).toBe(false);
    expect(result.current.dialog.item).toBeNull();
  });

  it('opens in create mode', () => {
    const { result } = renderHook(() => useDialogState<TestItem>());

    act(() => {
      result.current.openCreate();
    });

    expect(result.current.dialog.open).toBe(true);
    expect(result.current.dialog.mode).toBe('create');
    expect(result.current.dialog.item).toBeNull();
  });

  it('opens in edit mode with item', () => {
    const { result } = renderHook(() => useDialogState<TestItem>());
    const item = { id: '1', name: 'Test' };

    act(() => {
      result.current.openEdit(item);
    });

    expect(result.current.dialog.open).toBe(true);
    expect(result.current.dialog.mode).toBe('edit');
    expect(result.current.dialog.item).toEqual(item);
  });

  it('opens in view mode with item', () => {
    const { result } = renderHook(() => useDialogState<TestItem>());
    const item = { id: '2', name: 'View Test' };

    act(() => {
      result.current.openView(item);
    });

    expect(result.current.dialog.open).toBe(true);
    expect(result.current.dialog.mode).toBe('view');
    expect(result.current.dialog.item).toEqual(item);
  });

  it('closes the dialog', () => {
    const { result } = renderHook(() => useDialogState<TestItem>());

    act(() => {
      result.current.openCreate();
    });

    expect(result.current.dialog.open).toBe(true);

    act(() => {
      result.current.close();
    });

    expect(result.current.dialog.open).toBe(false);
  });

  it('preserves item after close (for exit animations)', () => {
    const { result } = renderHook(() => useDialogState<TestItem>());
    const item = { id: '1', name: 'Test' };

    act(() => {
      result.current.openEdit(item);
    });

    act(() => {
      result.current.close();
    });

    // Item should be preserved so dialog content doesn't flash during close animation
    expect(result.current.dialog.open).toBe(false);
    expect(result.current.dialog.item).toEqual(item);
  });

  it('transitions between modes correctly', () => {
    const { result } = renderHook(() => useDialogState<TestItem>());
    const item1 = { id: '1', name: 'First' };
    const item2 = { id: '2', name: 'Second' };

    // Open for edit
    act(() => {
      result.current.openEdit(item1);
    });
    expect(result.current.dialog.item).toEqual(item1);

    // Switch to different item
    act(() => {
      result.current.openEdit(item2);
    });
    expect(result.current.dialog.item).toEqual(item2);
    expect(result.current.dialog.mode).toBe('edit');

    // Switch to create
    act(() => {
      result.current.openCreate();
    });
    expect(result.current.dialog.item).toBeNull();
    expect(result.current.dialog.mode).toBe('create');
  });
});
