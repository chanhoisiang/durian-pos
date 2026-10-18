// src/lib/crypto.ts

export interface ConfidentialTxPayload {
    counterpartyName: string;      // Farmer or Reseller Name
    counterpartyTin: string;       // LHDN TIN (e.g., IG1234567890 or C1234567890)
    counterpartyIdValue: string;   // NRIC (for Farmer) or SSM BRN (for Reseller)
    counterpartyPhone: string;
    paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'EWALLET' | 'CREDIT_TERM';
    items: {
      varietyCode: string;         // e.g., D197-MK
      varietyName: string;         // Musang King
      grade: string;               // A, B, C
      grossWeightKg: number;       // Weight including basket (raga)
      basketTareKg: number;        // Raga deduction weight
      netWeightKg: number;         // Actual durian weight
      pricePerKgRm: number;        // Confidential RM/kg
      subtotalRm: number;
    }[];
    grandTotalRm: number;
    remarks?: string;
  }
  
  // Derive an AES-256-GCM key from the Wholesaler's Vault Passphrase + Tenant Salt
  async function deriveVaultKey(passphrase: string, saltBase64: string): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
  
    const salt = Uint8Array.from(atob(saltBase64), (c) => c.charCodeAt(0));
  
    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }
  
  // Encrypt confidential transaction before sending to Supabase
  export async function encryptTransactionPayload(
    payload: ConfidentialTxPayload,
    vaultPin: string,
    saltBase64: string
  ): Promise<{ encryptedPayload: string; iv: string }> {
    const key = await deriveVaultKey(vaultPin, saltBase64);
    const ivArray = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(JSON.stringify(payload));
  
    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: ivArray },
      key,
      encodedData
    );
  
    const encryptedPayload = btoa(String.fromCharCode(...new Uint8Array(ciphertextBuffer)));
    const iv = btoa(String.fromCharCode(...ivArray));
  
    return { encryptedPayload, iv };
  }
  
  // Decrypt transaction in the browser when the Wholesaler views their own history
  export async function decryptTransactionPayload(
    encryptedPayload: string,
    ivBase64: string,
    vaultPin: string,
    saltBase64: string
  ): Promise<ConfidentialTxPayload> {
    const key = await deriveVaultKey(vaultPin, saltBase64);
    const iv = Uint8Array.from(atob(ivBase64), (c) => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(encryptedPayload), (c) => c.charCodeAt(0));
  
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
  
    const jsonString = new TextDecoder().decode(decryptedBuffer);
    return JSON.parse(jsonString) as ConfidentialTxPayload;
  }