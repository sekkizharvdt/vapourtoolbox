/**
 * GST Report Exporters
 *
 * Functions to export GST reports to JSON format compatible with GST portal
 */

import type { GSTR1Data, GSTR3BData } from './types';

/** Safely convert a value that may be a Firestore Timestamp, Date, or string to YYYY-MM-DD */
function toDateString(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().toISOString().split('T')[0] || '';
  }
  if (value instanceof Date) {
    return value.toISOString().split('T')[0] || '';
  }
  if (typeof value === 'string') {
    return value;
  }
  return '';
}

/**
 * Export GSTR-1 to JSON format compatible with GST portal
 */
export function exportGSTR1ToJSON(data: GSTR1Data): string {
  const json = {
    gstin: data.gstin,
    fp: `${data.period.month.toString().padStart(2, '0')}${data.period.year}`,
    b2b: data.b2b.invoices.map((inv) => ({
      ctin: inv.customerGSTIN,
      inv: [
        {
          inum: inv.invoiceNumber,
          idt: toDateString(inv.invoiceDate),
          val: inv.invoiceValue,
          pos: inv.placeOfSupply,
          rchrg: inv.reverseCharge ? 'Y' : 'N',
          inv_typ: 'R',
          itms: [
            {
              num: 1,
              itm_det: {
                txval: inv.taxableValue,
                rt: ((inv.cgst + inv.sgst + inv.igst) / inv.taxableValue) * 100,
                camt: inv.cgst,
                samt: inv.sgst,
                iamt: inv.igst,
                csamt: inv.cess,
              },
            },
          ],
        },
      ],
    })),
    b2cl: data.b2c.invoices
      .filter((inv) => inv.invoiceValue > 250000)
      .map((inv) => ({
        pos: inv.placeOfSupply,
        inv: [
          {
            inum: inv.invoiceNumber,
            idt: toDateString(inv.invoiceDate),
            val: inv.invoiceValue,
            itms: [
              {
                num: 1,
                itm_det: {
                  txval: inv.taxableValue,
                  rt: inv.gstRate,
                  camt: inv.cgst,
                  samt: inv.sgst,
                  iamt: inv.igst,
                  csamt: inv.cess,
                },
              },
            ],
          },
        ],
      })),
    b2cs: [
      {
        typ: 'OE',
        pos: '27', // Default - would need actual place of supply
        sply_ty: 'INTRA',
        rt: 18,
        txval: data.b2c.summary.taxableValue,
        camt: data.b2c.summary.cgst,
        samt: data.b2c.summary.sgst,
        iamt: data.b2c.summary.igst,
        csamt: data.b2c.summary.cess,
      },
    ],
    hsn: {
      data: data.hsnSummary.map((hsn) => ({
        hsn_sc: hsn.hsnCode,
        desc: hsn.description,
        uqc: hsn.uqc,
        qty: hsn.totalQuantity,
        val: hsn.totalValue,
        txval: hsn.taxableValue,
        camt: hsn.cgst,
        samt: hsn.sgst,
        iamt: hsn.igst,
        csamt: hsn.cess,
      })),
    },
  };

  return JSON.stringify(json, null, 2);
}

/**
 * Export GSTR-3B to JSON format compatible with GST portal
 */
export function exportGSTR3BToJSON(data: GSTR3BData): string {
  const json = {
    gstin: data.gstin,
    ret_period: `${data.period.month.toString().padStart(2, '0')}${data.period.year}`,
    sup_details: {
      osup_det: {
        txval: data.outwardSupplies.taxableValue,
        iamt: data.outwardSupplies.igst,
        camt: data.outwardSupplies.cgst,
        samt: data.outwardSupplies.sgst,
        csamt: data.outwardSupplies.cess,
      },
    },
    inter_sup: {
      unreg_details: [],
      comp_details: [],
      uin_details: [],
    },
    itc_elg: {
      itc_avl: [
        {
          ty: 'IMPG',
          iamt: data.itcAvailable.igst,
          camt: data.itcAvailable.cgst,
          samt: data.itcAvailable.sgst,
          csamt: data.itcAvailable.cess,
        },
      ],
      itc_rev: [
        {
          ty: 'RUL',
          iamt: data.itcReversed.igst,
          camt: data.itcReversed.cgst,
          samt: data.itcReversed.sgst,
          csamt: data.itcReversed.cess,
        },
      ],
      itc_net: {
        iamt: data.netITC.igst,
        camt: data.netITC.cgst,
        samt: data.netITC.sgst,
        csamt: data.netITC.cess,
      },
    },
    inward_sup: {
      isup_details: [
        {
          ty: 'GST',
          inter: data.inwardSupplies.igst > 0 ? data.inwardSupplies.taxableValue : 0,
          intra: data.inwardSupplies.cgst > 0 ? data.inwardSupplies.taxableValue : 0,
        },
      ],
    },
    interest: {
      intr_details: {
        iamt: data.interestLatePayment.igst,
        camt: data.interestLatePayment.cgst,
        samt: data.interestLatePayment.sgst,
        csamt: data.interestLatePayment.cess,
      },
    },
  };

  return JSON.stringify(json, null, 2);
}
