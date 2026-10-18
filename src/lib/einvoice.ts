// src/lib/einvoice.ts
import { ConfidentialTxPayload } from './crypto';

export function buildLhdnMyInvoisPayload(
  txType: 'BUY_FARMER' | 'SELL_RESELLER',
  receiptNo: string,
  issuedAtIso: string,
  wholesaler: { businessName: string; tin: string; ssmBrn: string; msicCode: string; phone: string },
  data: ConfidentialTxPayload
) {
  const isSelfBilled = txType === 'BUY_FARMER';

  return {
    eInvoiceVersion: '1.0',
    eInvoiceTypeCode: isSelfBilled ? '11' : '01', // 11 = Self-Billed (Farmer), 01 = Standard Invoice (Reseller)
    eInvoiceCodeNumber: receiptNo,
    eInvoiceDateTime: issuedAtIso,
    invoiceCurrencyCode: 'MYR',
    
    // In Self-Billed e-Invoice, the Farmer is the Supplier and the Wholesaler is the Buyer!
    supplier: isSelfBilled
      ? {
          name: data.counterpartyName,
          tin: data.counterpartyTin || 'EI00000000010', // General Individual TIN fallback if applicable
          idType: 'NRIC',
          idValue: data.counterpartyIdValue,
          contactNumber: data.counterpartyPhone,
          msicCode: '01222', // Growing of tropical fruits (Durian Farmer)
        }
      : {
          name: wholesaler.businessName,
          tin: wholesaler.tin,
          idType: 'BRN',
          idValue: wholesaler.ssmBrn,
          contactNumber: wholesaler.phone,
          msicCode: wholesaler.msicCode, // 46312 Wholesale of fruits
        },

    buyer: isSelfBilled
      ? {
          name: wholesaler.businessName,
          tin: wholesaler.tin,
          idType: 'BRN',
          idValue: wholesaler.ssmBrn,
          contactNumber: wholesaler.phone,
        }
      : {
          name: data.counterpartyName,
          tin: data.counterpartyTin,
          idType: 'BRN',
          idValue: data.counterpartyIdValue,
          contactNumber: data.counterpartyPhone,
        },

    invoiceLines: data.items.map((item, idx) => ({
      lineId: idx + 1,
      classificationCode: isSelfBilled ? '036' : '004', // 036 = Self-Billed, 004 = General Goods
      description: `${item.varietyName} (${item.varietyCode}) - Grade ${item.grade} [Gross: ${item.grossWeightKg}kg, Tare: -${item.basketTareKg}kg]`,
      quantity: item.netWeightKg,
      unitCode: 'KGM', // UN/ECE Recommendation 20 code for Kilogram
      unitPrice: item.pricePerKgRm,
      taxType: '06',   // 06 = Not Applicable / Exempt (Fresh agricultural fruits)
      taxRate: 0,
      taxAmount: 0,
      subtotal: item.subtotalRm,
    })),

    totalPayableAmount: data.grandTotalRm,
  };
}