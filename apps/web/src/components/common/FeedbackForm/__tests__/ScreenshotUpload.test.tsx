/**
 * Tests for ScreenshotUpload component
 *
 * Tests file upload, drag & drop, clipboard paste, and screenshot management.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ScreenshotUpload } from '../ScreenshotUpload';

// Mock MUI icons
jest.mock('@mui/icons-material/CloudUpload', () => {
  const MockIcon = () => <span data-testid="upload-icon" />;
  MockIcon.displayName = 'MockCloudUploadIcon';
  return MockIcon;
});

jest.mock('@mui/icons-material/Delete', () => {
  const MockIcon = () => <span data-testid="delete-icon" />;
  MockIcon.displayName = 'MockDeleteIcon';
  return MockIcon;
});

describe('ScreenshotUpload', () => {
  const mockOnAdd = jest.fn();
  const mockOnRemove = jest.fn();

  const defaultProps = {
    screenshots: [],
    onAdd: mockOnAdd,
    onRemove: mockOnRemove,
    isUploading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render upload zone with instructions', () => {
      render(<ScreenshotUpload {...defaultProps} />);

      expect(screen.getByText(/Drag and drop/i)).toBeInTheDocument();
      expect(screen.getByText(/paste from clipboard/i)).toBeInTheDocument();
      expect(screen.getByText(/Supports PNG, JPG, GIF/i)).toBeInTheDocument();
    });

    it('should render file input as hidden', () => {
      render(<ScreenshotUpload {...defaultProps} />);

      const fileInput = document.getElementById('screenshot-upload') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();
      expect(fileInput.type).toBe('file');
      expect(fileInput.accept).toBe('image/*');
      expect(fileInput.style.display).toBe('none');
    });

    it('should show uploading state', () => {
      render(<ScreenshotUpload {...defaultProps} isUploading={true} />);

      expect(screen.getByText('Uploading...')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should render existing screenshots', () => {
      const screenshots = [
        'https://example.com/screenshot1.png',
        'https://example.com/screenshot2.png',
      ];

      render(<ScreenshotUpload {...defaultProps} screenshots={screenshots} />);

      const images = screen.getAllByRole('img');
      expect(images).toHaveLength(2);
      expect(images[0]).toHaveAttribute('src', screenshots[0]);
      expect(images[1]).toHaveAttribute('src', screenshots[1]);
    });

    it('should render delete buttons for each screenshot', () => {
      const screenshots = ['https://example.com/screenshot1.png'];

      render(<ScreenshotUpload {...defaultProps} screenshots={screenshots} />);

      expect(screen.getByLabelText('Remove screenshot 1')).toBeInTheDocument();
    });
  });

  describe('File Selection', () => {
    it('should call onAdd when file is selected via input', async () => {
      render(<ScreenshotUpload {...defaultProps} />);

      const fileInput = document.getElementById('screenshot-upload') as HTMLInputElement;
      const file = new File(['test'], 'test.png', { type: 'image/png' });

      Object.defineProperty(fileInput, 'files', {
        value: [file],
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith(file);
      });
    });

    it('should reset input after file selection', async () => {
      render(<ScreenshotUpload {...defaultProps} />);

      const fileInput = document.getElementById('screenshot-upload') as HTMLInputElement;
      const file = new File(['test'], 'test.png', { type: 'image/png' });

      // Set a value
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        configurable: true,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(fileInput.value).toBe('');
      });
    });

    it('should open file dialog when clicking upload zone', () => {
      render(<ScreenshotUpload {...defaultProps} />);

      const fileInput = document.getElementById('screenshot-upload') as HTMLInputElement;
      const clickSpy = jest.spyOn(fileInput, 'click');

      const uploadZone = screen.getByText(/Drag and drop/i).closest('div');
      fireEvent.click(uploadZone!);

      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe('Drag and Drop', () => {
    it('should call onAdd when image file is dropped', async () => {
      render(<ScreenshotUpload {...defaultProps} />);

      const uploadZone = screen.getByText(/Drag and drop/i).closest('[tabindex]');
      const file = new File(['test'], 'test.png', { type: 'image/png' });

      fireEvent.drop(uploadZone!, {
        dataTransfer: {
          files: [file],
        },
      });

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith(file);
      });
    });

    it('should NOT call onAdd when non-image file is dropped', async () => {
      render(<ScreenshotUpload {...defaultProps} />);

      const uploadZone = screen.getByText(/Drag and drop/i).closest('[tabindex]');
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });

      fireEvent.drop(uploadZone!, {
        dataTransfer: {
          files: [file],
        },
      });

      expect(mockOnAdd).not.toHaveBeenCalled();
    });

    it('should handle dragOver event without errors', () => {
      render(<ScreenshotUpload {...defaultProps} />);

      const uploadZone = screen.getByText(/Drag and drop/i).closest('[tabindex]');

      // Simply ensure dragOver doesn't throw an error
      expect(() => {
        fireEvent.dragOver(uploadZone!);
      }).not.toThrow();
    });
  });

  describe('Clipboard Paste', () => {
    it('should show paste ready message when focused', () => {
      render(<ScreenshotUpload {...defaultProps} />);

      const uploadZone = screen.getByText(/Drag and drop/i).closest('[tabindex]');
      fireEvent.focus(uploadZone!);

      expect(screen.getByText(/Ready to paste/i)).toBeInTheDocument();
    });

    it('should hide paste ready message when blurred', () => {
      render(<ScreenshotUpload {...defaultProps} />);

      const uploadZone = screen.getByText(/Drag and drop/i).closest('[tabindex]');
      fireEvent.focus(uploadZone!);

      expect(screen.getByText(/Ready to paste/i)).toBeInTheDocument();

      fireEvent.blur(uploadZone!);

      expect(screen.queryByText(/Ready to paste/i)).not.toBeInTheDocument();
    });

    it('should call onAdd when image is pasted from clipboard', async () => {
      render(<ScreenshotUpload {...defaultProps} />);

      const uploadZone = screen.getByText(/Drag and drop/i).closest('[tabindex]');
      const file = new File(['test'], 'screenshot.png', { type: 'image/png' });

      // Focus the upload zone to enable paste
      fireEvent.focus(uploadZone!);

      // Simulate paste event
      const clipboardData = {
        items: [
          {
            type: 'image/png',
            getAsFile: () => file,
          },
        ],
      };

      const pasteEvent = new Event('paste', { bubbles: true });
      Object.defineProperty(pasteEvent, 'clipboardData', { value: clipboardData });

      document.dispatchEvent(pasteEvent);

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith(file);
      });
    });

    it('should NOT call onAdd when non-image is pasted', async () => {
      render(<ScreenshotUpload {...defaultProps} />);

      const uploadZone = screen.getByText(/Drag and drop/i).closest('[tabindex]');
      fireEvent.focus(uploadZone!);

      const clipboardData = {
        items: [
          {
            type: 'text/plain',
            getAsFile: () => null,
          },
        ],
      };

      const pasteEvent = new Event('paste', { bubbles: true });
      Object.defineProperty(pasteEvent, 'clipboardData', { value: clipboardData });

      document.dispatchEvent(pasteEvent);

      expect(mockOnAdd).not.toHaveBeenCalled();
    });
  });

  describe('Screenshot Removal', () => {
    it('should call onRemove when delete button is clicked', async () => {
      const screenshots = [
        'https://example.com/screenshot1.png',
        'https://example.com/screenshot2.png',
      ];

      render(<ScreenshotUpload {...defaultProps} screenshots={screenshots} />);

      const deleteButton = screen.getByLabelText('Remove screenshot 1');
      fireEvent.click(deleteButton);

      expect(mockOnRemove).toHaveBeenCalledWith(0);
    });

    it('should call onRemove with correct index for second screenshot', async () => {
      const screenshots = [
        'https://example.com/screenshot1.png',
        'https://example.com/screenshot2.png',
      ];

      render(<ScreenshotUpload {...defaultProps} screenshots={screenshots} />);

      const deleteButton = screen.getByLabelText('Remove screenshot 2');
      fireEvent.click(deleteButton);

      expect(mockOnRemove).toHaveBeenCalledWith(1);
    });
  });

  describe('Accessibility', () => {
    it('should have tabIndex on upload zone', () => {
      render(<ScreenshotUpload {...defaultProps} />);

      const uploadZone = screen.getByText(/Drag and drop/i).closest('[tabindex]');
      expect(uploadZone).toHaveAttribute('tabindex', '0');
    });

    it('should have accessible labels for delete buttons', () => {
      const screenshots = ['https://example.com/screenshot1.png'];

      render(<ScreenshotUpload {...defaultProps} screenshots={screenshots} />);

      expect(screen.getByLabelText('Remove screenshot 1')).toBeInTheDocument();
    });

    it('should have alt text for screenshots', () => {
      const screenshots = [
        'https://example.com/screenshot1.png',
        'https://example.com/screenshot2.png',
      ];

      render(<ScreenshotUpload {...defaultProps} screenshots={screenshots} />);

      expect(screen.getByAltText('Screenshot 1')).toBeInTheDocument();
      expect(screen.getByAltText('Screenshot 2')).toBeInTheDocument();
    });
  });

  describe('Visual States', () => {
    it('should not show screenshots section when empty', () => {
      render(<ScreenshotUpload {...defaultProps} screenshots={[]} />);

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('should hide upload instructions when uploading', () => {
      render(<ScreenshotUpload {...defaultProps} isUploading={true} />);

      expect(screen.queryByText(/Drag and drop/i)).not.toBeInTheDocument();
      expect(screen.getByText('Uploading...')).toBeInTheDocument();
    });
  });
});
