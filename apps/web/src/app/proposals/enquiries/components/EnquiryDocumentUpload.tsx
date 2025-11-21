'use client';

import { useFirestore, useStorage } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { uploadEnquiryDocument, deleteEnquiryDocument } from '@/lib/enquiry/enquiryService';
import DocumentUploadWidget from '@/components/procurement/DocumentUploadWidget';
import type { Enquiry } from '@vapour/types';
import { Timestamp } from 'firebase/firestore';

interface EnquiryDocumentUploadProps {
  enquiry: Enquiry;
  onUpdate: (updatedEnquiry: Enquiry) => void;
}

export function EnquiryDocumentUpload({ enquiry, onUpdate }: EnquiryDocumentUploadProps) {
  const db = useFirestore();
  const storage = useStorage();
  const { user } = useAuth();

  const handleUpload = async (file: File) => {
    if (!db || !storage || !user?.uid) return;

    try {
      const newDoc = await uploadEnquiryDocument(db, storage, enquiry.id, file, user.uid);

      // Update local state
      const updatedDocs = [...(enquiry.attachedDocuments || []), newDoc];
      onUpdate({ ...enquiry, attachedDocuments: updatedDocs });
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error; // Re-throw for widget to handle
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!db || !storage || !user?.uid) return;

    try {
      await deleteEnquiryDocument(db, storage, enquiry.id, documentId, user.uid);

      // Update local state
      const updatedDocs = (enquiry.attachedDocuments || []).filter((d) => d.id !== documentId);
      onUpdate({ ...enquiry, attachedDocuments: updatedDocs });
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  };

  const handleDownload = (doc: { fileUrl: string }) => {
    window.open(doc.fileUrl, '_blank');
  };

  // Map EnquiryDocument to widget's expected format
  const documents = (enquiry.attachedDocuments || []).map((doc) => ({
    id: doc.id,
    fileName: doc.fileName,
    fileUrl: doc.fileUrl,
    fileSize: doc.fileSize,
    uploadedAt:
      doc.uploadedAt instanceof Timestamp ? doc.uploadedAt.toDate() : new Date(doc.uploadedAt),
  }));

  return (
    <DocumentUploadWidget
      documents={documents}
      onUpload={handleUpload}
      onDelete={handleDelete}
      onDownload={handleDownload}
      maxFiles={10}
      maxFileSizeMB={25}
      disabled={enquiry.status === 'CANCELLED'}
    />
  );
}
