/**
 * Document Browser Components
 *
 * Module-scoped folder-based document browser with dual view modes
 */

export { DocumentBrowser } from './DocumentBrowser';
export { FolderTree } from './FolderTree';
export { FileList } from './FileList';
export { BreadcrumbNav } from './BreadcrumbNav';
export { ViewModeToggle } from './ViewModeToggle';
export { CreateFolderDialog } from './CreateFolderDialog';
export { useDocumentBrowser } from './hooks/useDocumentBrowser';

// Re-export types for convenience
export type {
  UseDocumentBrowserOptions,
  UseDocumentBrowserReturn,
} from './hooks/useDocumentBrowser';
