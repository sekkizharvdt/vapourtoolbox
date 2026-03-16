/**
 * Service Order CRUD and Workflow Operations
 */

import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  Timestamp,
  type Firestore,
  type QueryConstraint,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { docToTyped } from '../../firebase/typeHelpers';
import type { ServiceOrder, ServiceOrderStatus } from '@vapour/types';
import { requireValidTransition } from '@/lib/utils/stateMachine';
import { serviceOrderStateMachine } from '@/lib/workflow/stateMachines';

const logger = createLogger({ context: 'serviceOrder:crud' });

/**
 * Generate a service order number: SO/YYYY/MM/XXXX
 */
async function generateServiceOrderNumber(db: Firestore): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  const q = query(
    collection(db, COLLECTIONS.SERVICE_ORDERS),
    where('number', '>=', `SO/${year}/${month}/`),
    where('number', '<=', `SO/${year}/${month}/\uf8ff`)
  );
  const snap = await getDocs(q);
  const seq = String(snap.size + 1).padStart(4, '0');

  return `SO/${year}/${month}/${seq}`;
}

export interface CreateServiceOrderInput {
  purchaseOrderId: string;
  poNumber: string;
  purchaseOrderItemId?: string;
  vendorId: string;
  vendorName: string;
  projectId?: string;
  projectName?: string;
  serviceId?: string;
  serviceCode?: string;
  serviceName: string;
  serviceCategory?: string;
  description?: string;
  estimatedTurnaroundDays?: number;
  expectedCompletionDate?: Date;
}

/**
 * Create a new service order
 */
export async function createServiceOrder(
  db: Firestore,
  input: CreateServiceOrderInput,
  userId: string,
  userName: string
): Promise<ServiceOrder> {
  const number = await generateServiceOrderNumber(db);
  const now = Timestamp.now();

  const data: Omit<ServiceOrder, 'id'> = {
    number,
    purchaseOrderId: input.purchaseOrderId,
    poNumber: input.poNumber,
    ...(input.purchaseOrderItemId && { purchaseOrderItemId: input.purchaseOrderItemId }),
    vendorId: input.vendorId,
    vendorName: input.vendorName,
    ...(input.projectId && { projectId: input.projectId }),
    ...(input.projectName && { projectName: input.projectName }),
    ...(input.serviceId && { serviceId: input.serviceId }),
    ...(input.serviceCode && { serviceCode: input.serviceCode }),
    serviceName: input.serviceName,
    ...(input.serviceCategory && { serviceCategory: input.serviceCategory }),
    ...(input.description && { description: input.description }),
    ...(input.estimatedTurnaroundDays && {
      estimatedTurnaroundDays: input.estimatedTurnaroundDays,
    }),
    ...(input.expectedCompletionDate && {
      expectedCompletionDate: Timestamp.fromDate(input.expectedCompletionDate),
    }),
    status: 'DRAFT',
    createdBy: userId,
    createdByName: userName,
    createdAt: now,
    updatedAt: now,
    updatedBy: userId,
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.SERVICE_ORDERS), data);
  logger.info('Service order created', { id: docRef.id, number });

  const created: ServiceOrder = { ...data, id: docRef.id };
  return created;
}

/**
 * Get a service order by ID
 */
export async function getServiceOrderById(
  db: Firestore,
  soId: string
): Promise<ServiceOrder | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.SERVICE_ORDERS, soId));
  if (!snap.exists()) return null;
  return docToTyped<ServiceOrder>(snap.id, snap.data());
}

/**
 * List service orders with optional filters
 */
export async function listServiceOrders(
  db: Firestore,
  filters?: {
    status?: ServiceOrderStatus;
    purchaseOrderId?: string;
    projectId?: string;
  }
): Promise<ServiceOrder[]> {
  const constraints: QueryConstraint[] = [];

  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }
  if (filters?.purchaseOrderId) {
    constraints.push(where('purchaseOrderId', '==', filters.purchaseOrderId));
  }
  if (filters?.projectId) {
    constraints.push(where('projectId', '==', filters.projectId));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(collection(db, COLLECTIONS.SERVICE_ORDERS), ...constraints);
  const snap = await getDocs(q);

  return snap.docs.map((d) => docToTyped<ServiceOrder>(d.id, d.data()));
}

/**
 * Transition a service order to a new status
 */
export async function updateServiceOrderStatus(
  db: Firestore,
  soId: string,
  targetStatus: ServiceOrderStatus,
  userId: string,
  updates?: Partial<ServiceOrder>
): Promise<void> {
  const soRef = doc(db, COLLECTIONS.SERVICE_ORDERS, soId);
  const snap = await getDoc(soRef);

  if (!snap.exists()) throw new Error('Service order not found');

  const so = snap.data() as ServiceOrder;

  // Validate transition using state machine
  requireValidTransition(serviceOrderStateMachine, so.status, targetStatus, 'ServiceOrder');

  const updateData: Record<string, unknown> = {
    status: targetStatus,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
    ...updates,
  };

  // Set completion fields on terminal states
  if (targetStatus === 'COMPLETED') {
    updateData.completedBy = userId;
    updateData.completedAt = Timestamp.now();
    updateData.actualCompletionDate = Timestamp.now();
  }

  await updateDoc(soRef, updateData);
  logger.info('Service order status updated', { soId, from: so.status, to: targetStatus });
}

/**
 * Update service order fields (non-status updates)
 */
export async function updateServiceOrder(
  db: Firestore,
  soId: string,
  updates: Partial<Omit<ServiceOrder, 'id' | 'number' | 'createdAt' | 'createdBy'>>,
  userId: string
): Promise<void> {
  const soRef = doc(db, COLLECTIONS.SERVICE_ORDERS, soId);
  await updateDoc(soRef, {
    ...updates,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });
}
