/**
 * Purchase Request Form Hook
 *
 * Manages form state, validation, and line items for purchase request creation
 */

import { useState } from 'react';
import type { CreatePurchaseRequestItemInput } from '@/lib/procurement/purchaseRequestService';

export interface FormData {
  type: 'PROJECT' | 'BUDGETARY' | 'INTERNAL';
  category: 'SERVICE' | 'RAW_MATERIAL' | 'BOUGHT_OUT';
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  requiredBy: string;
}

export interface UsePurchaseRequestFormReturn {
  formData: FormData;
  lineItems: CreatePurchaseRequestItemInput[];
  activeStep: number;
  error: string | null;
  handleInputChange: (field: string, value: string) => void;
  handleProjectSelect: (projectId: string | null, projectName?: string) => void;
  handleLineItemChange: (index: number, field: string, value: string | number) => void;
  handleAddLineItem: () => void;
  handleRemoveLineItem: (index: number) => void;
  handleImportFromExcel: (importedItems: CreatePurchaseRequestItemInput[]) => void;
  validateStep: (step: number) => boolean;
  setActiveStep: (step: number) => void;
  setError: (error: string | null) => void;
  setLineItems: (items: CreatePurchaseRequestItemInput[]) => void;
}

export function usePurchaseRequestForm(): UsePurchaseRequestFormReturn {
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    type: 'PROJECT',
    category: 'RAW_MATERIAL',
    projectId: '',
    projectName: '',
    title: '',
    description: '',
    priority: 'MEDIUM',
    requiredBy: '',
  });

  const [lineItems, setLineItems] = useState<CreatePurchaseRequestItemInput[]>([
    {
      description: '',
      quantity: 1,
      unit: 'NOS',
      equipmentCode: '',
    },
  ]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleProjectSelect = (projectId: string | null, projectName?: string) => {
    setFormData((prev) => ({
      ...prev,
      projectId: projectId || '',
      projectName: projectName || '',
    }));
  };

  const handleLineItemChange = (index: number, field: string, value: string | number) => {
    const updatedItems = [...lineItems];
    const item = updatedItems[index];
    if (item) {
      updatedItems[index] = {
        ...item,
        [field]: value,
      };
      setLineItems(updatedItems);
    }
  };

  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        description: '',
        quantity: 1,
        unit: 'NOS',
        equipmentCode: '',
      },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImportFromExcel = (importedItems: CreatePurchaseRequestItemInput[]) => {
    setLineItems(importedItems);
  };

  const validateStep = (step: number): boolean => {
    setError(null);

    if (step === 0) {
      // Validate basic information
      if (formData.type === 'PROJECT' && !formData.projectId) {
        setError('Please select a project');
        return false;
      }
      if (!formData.title.trim()) {
        setError('Please enter title');
        return false;
      }
      if (!formData.description.trim()) {
        setError('Please enter description');
        return false;
      }
      return true;
    }

    if (step === 1) {
      // Validate line items
      if (lineItems.length === 0) {
        setError('Please add at least one line item');
        return false;
      }

      for (let i = 0; i < lineItems.length; i++) {
        const item = lineItems[i];
        if (!item) continue;
        if (!item.description.trim()) {
          setError(`Line ${i + 1}: Description is required`);
          return false;
        }
        if (item.quantity <= 0) {
          setError(`Line ${i + 1}: Quantity must be greater than 0`);
          return false;
        }
        if (!item.unit.trim()) {
          setError(`Line ${i + 1}: Unit is required`);
          return false;
        }
      }
      return true;
    }

    return true;
  };

  return {
    formData,
    lineItems,
    activeStep,
    error,
    handleInputChange,
    handleProjectSelect,
    handleLineItemChange,
    handleAddLineItem,
    handleRemoveLineItem,
    handleImportFromExcel,
    validateStep,
    setActiveStep,
    setError,
    setLineItems,
  };
}
