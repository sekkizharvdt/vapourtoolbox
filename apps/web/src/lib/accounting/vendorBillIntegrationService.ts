import {
  collection,
  addDoc,
  doc,
  getDoc,
  Timestamp,
  Firestore,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { VendorBill, InvoiceLineItem } from '@vapour/types';
import { logger } from '@vapour/logger';

/**
 * Create a vendor bill from an approved 3-way match
 */
export async function createVendorBillFromMatch(
  db: Firestore,
  threeWayMatchId: string,
  userId: string,
  userName: string
): Promise<string> {
  try {
    // Get the 3-way match
    const matchDoc = await getDoc(doc(db, COLLECTIONS.THREE_WAY_MATCHES, threeWayMatchId));
    if (!matchDoc.exists()) {
      throw new Error('Three-way match not found');
    }

    const match = matchDoc.data();

    // Check if vendor bill already exists for this match
    const existingBillQuery = query(
      collection(db, COLLECTIONS.TRANSACTIONS),
      where('sourceDocumentId', '==', threeWayMatchId),
      where('sourceModule', '==', 'procurement')
    );
    const existingBillSnapshot = await getDocs(existingBillQuery);

    if (!existingBillSnapshot.empty) {
      const existingBill = existingBillSnapshot.docs[0];
      if (existingBill) {
        logger.info('Vendor bill already exists for this match', {
          threeWayMatchId,
          billId: existingBill.id,
        });
        return existingBill.id;
      }
    }

    // Get the match line items to build invoice line items
    const lineItemsRef = collection(db, COLLECTIONS.MATCH_LINE_ITEMS);
    const lineItemsQuery = query(lineItemsRef, where('threeWayMatchId', '==', threeWayMatchId));
    const lineItemsSnapshot = await getDocs(lineItemsQuery);

    const invoiceLineItems: InvoiceLineItem[] = lineItemsSnapshot.docs.map((doc) => {
      const item = doc.data();
      const lineAmount = (item.acceptedQuantity || item.invoicedQuantity) * item.invoiceUnitPrice;
      return {
        id: doc.id,
        description: item.description,
        quantity: item.acceptedQuantity || item.invoicedQuantity,
        unitPrice: item.invoiceUnitPrice,
        amount: lineAmount,
        gstRate: item.taxRate || 0,
        gstAmount: item.taxAmount || 0,
        accountId: item.accountId,
        costCentreId: match.costCentreId,
      };
    });

    // Calculate totals
    const subtotal = invoiceLineItems.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = invoiceLineItems.reduce((sum, item) => sum + (item.gstAmount || 0), 0);
    const totalAmount = subtotal + taxAmount;

    const now = Timestamp.now();
    const transactionNumber = 'VB-' + now.toMillis().toString();

    // Create vendor bill
    const vendorBillData: Omit<VendorBill, 'id'> = {
      // BaseTransaction fields
      type: 'VENDOR_BILL',
      transactionNumber,
      date: now as unknown as Date,
      description: 'Vendor bill for PO ' + match.poNumber + ' - ' + match.vendorName,
      amount: totalAmount,
      currency: 'INR',
      baseAmount: totalAmount,
      entries: [], // Ledger entries to be created separately
      status: 'POSTED',
      attachments: [],
      entityId: match.vendorId || '',
      costCentreId: match.costCentreId,
      reference: 'Match: ' + match.matchNumber,

      // VendorBill specific fields
      vendorGSTIN: match.vendorGSTIN,
      billDate: now as unknown as Date,
      vendorInvoiceNumber: match.vendorInvoiceNumber,
      lineItems: invoiceLineItems,
      subtotal,
      taxAmount,
      totalAmount,
      paidAmount: 0,
      outstandingAmount: totalAmount,
      paymentStatus: 'UNPAID',
      tdsDeducted: false,
      sourceModule: 'procurement',
      sourceDocumentId: threeWayMatchId,
      sourceDocumentType: 'vendorInvoice',

      // Metadata
      createdAt: now as unknown as Date,
      createdBy: userId,
      updatedAt: now as unknown as Date,
      updatedBy: userId,
    };

    const billRef = await addDoc(collection(db, COLLECTIONS.TRANSACTIONS), vendorBillData);

    logger.info('Vendor bill created from 3-way match', {
      threeWayMatchId,
      billId: billRef.id,
      vendorInvoiceNumber: match.vendorInvoiceNumber,
      totalAmount,
      userName,
    });

    return billRef.id;
  } catch (error) {
    logger.error('Failed to create vendor bill from match', {
      error,
      threeWayMatchId,
      userName,
    });
    throw error;
  }
}

/**
 * Get vendor bill for a 3-way match
 */
export async function getVendorBillForMatch(
  db: Firestore,
  threeWayMatchId: string
): Promise<VendorBill | null> {
  try {
    const billQuery = query(
      collection(db, COLLECTIONS.TRANSACTIONS),
      where('sourceDocumentId', '==', threeWayMatchId),
      where('sourceModule', '==', 'procurement')
    );
    const snapshot = await getDocs(billQuery);

    if (snapshot.empty) {
      return null;
    }

    const docSnapshot = snapshot.docs[0];
    if (!docSnapshot) {
      return null;
    }
    const data = docSnapshot.data();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return {
      id: docSnapshot.id,
      ...data,
    } as VendorBill;
  } catch (error) {
    logger.error('Failed to get vendor bill for match', { error, threeWayMatchId });
    throw error;
  }
}
