/**
 * Editable List Hook
 *
 * Reusable hook for managing list items with add/edit/delete operations
 */

import { useState } from 'react';

export interface UseEditableListReturn {
  items: string[];
  newItem: string;
  editingIndex: number | null;
  editText: string;
  setNewItem: (value: string) => void;
  setEditText: (value: string) => void;
  handleAdd: () => void;
  handleEdit: (index: number) => void;
  handleSaveEdit: () => void;
  handleCancelEdit: () => void;
  handleDelete: (index: number) => void;
  setItems: (items: string[]) => void;
}

export function useEditableList(initialItems: string[] = []): UseEditableListReturn {
  const [items, setItems] = useState<string[]>(initialItems);
  const [newItem, setNewItem] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  const handleAdd = () => {
    if (newItem.trim()) {
      setItems([...items, newItem.trim()]);
      setNewItem('');
    }
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditText(items[index] || '');
  };

  const handleSaveEdit = () => {
    if (editingIndex !== null && editText.trim()) {
      const updated = [...items];
      updated[editingIndex] = editText.trim();
      setItems(updated);
      setEditingIndex(null);
      setEditText('');
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditText('');
  };

  const handleDelete = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  return {
    items,
    newItem,
    editingIndex,
    editText,
    setNewItem,
    setEditText,
    setItems,
    handleAdd,
    handleEdit,
    handleSaveEdit,
    handleCancelEdit,
    handleDelete,
  };
}
