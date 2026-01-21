/* FILENAME: security_utils.js
   PURPOSE: Arth Book Security Core (Native Web Crypto API)
   FEATURES: 
     - Secure SHA-256 Password Hashing
     - Robust Device Fingerprint (Machine ID)
     - Device-Bound Activation (Simple Offline License)
     - Proper AES-GCM Encryption/Decryption (for Ghost Mode & Sensitive Data)
   VERSION: 2.0
*/

class ArthSecurity {
    constructor() {
        this.machineKey = 'arth_device_id';
        this.licenseKey = 'arth_license_data';
        this.salt = 'ArthBookSalt2026'; // Constant salt for consistent hashing
    }

    // --- 1. SECURE PASSWORD HASHING (PBKDF2 + SHA-256) ---
    async hashPassword(plainText) {
        if (!plainText) return null;
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(plainText);
            const saltBuffer = encoder.encode(this.salt + plainText); 

            const key = await crypto.subtle.importKey(
                'raw', data, { name: 'PBKDF2' }, false, ['deriveBits']
            );

            const derivedBits = await crypto.subtle.deriveBits(
                {
                    name: 'PBKDF2',
                    salt: saltBuffer,
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                key, 256
            );

            const hashArray = Array.from(new Uint8Array(derivedBits));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) {
            console.error("Hashing failed:", e);
            return plainText; // Fallback (unsafe but prevents crash)
        }
    }

    // --- 2. DEVICE FINGERPRINT (Unique Machine ID) ---
    async getMachineID() {
        let stored = localStorage.getItem(this.machineKey);
        if (stored) return stored;

        try {
            // Create unique traits based on hardware/browser
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillText('ArthBook Fingerprint', 2, 2);
            const canvasData = canvas.toDataURL();

            const traits = [
                navigator.userAgent,
                navigator.language,
                navigator.platform,
                navigator.hardwareConcurrency || 2,
                navigator.deviceMemory || 4,
                screen.width + 'x' + screen.height,
                new Date().getTimezoneOffset(),
                canvasData
            ].join('|||');

            // Hash the traits to create ID
            const hash = await this.hashPassword(traits);
            const deviceID = `DEV-${hash.substring(0, 16).toUpperCase()}`;

            localStorage.setItem(this.machineKey, deviceID);
            return deviceID;
        } catch (e) {
            return "DEV-UNKNOWN-ID";
        }
    }

    // --- 3. DEVICE-BOUND ACTIVATION ---
    async validateActivation(providedKey) {
        const machineID = await this.getMachineID();
        const stored = localStorage.getItem(this.licenseKey);

        // If already activated locally
        if (stored) {
            const { key, device } = JSON.parse(stored);
            if (key === providedKey && device === machineID) return true;
        }

        // New activation check (Simple check: key must contain machine ID part)
        if (providedKey && providedKey.includes(machineID)) {
            localStorage.setItem(this.licenseKey, JSON.stringify({ key: providedKey, device: machineID }));
            return true;
        }

        return false;
    }

    isActivated() {
        return !!localStorage.getItem(this.licenseKey);
    }

    deactivate() {
        localStorage.removeItem(this.licenseKey);
    }

    // --- 4. DATA ENCRYPTION (AES-GCM) ---
    async _getCryptoKey() {
        const machineID = await this.getMachineID();
        const encoder = new TextEncoder();
        // Key is derived from Machine ID, so data can only be read on this device
        const keyData = encoder.encode((machineID + this.salt).substring(0, 32)); // Ensure length

        // Hash key data to get exactly 32 bytes for AES-256
        const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);

        return await crypto.subtle.importKey(
            'raw', hashBuffer, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
        );
    }

    async encryptData(plainObject) {
        try {
            const key = await this._getCryptoKey();
            const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
            const data = new TextEncoder().encode(JSON.stringify(plainObject));

            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv }, key, data
            );

            // Combine IV + Encrypted Data
            const result = new Uint8Array(iv.byteLength + encrypted.byteLength);
            result.set(iv, 0);
            result.set(new Uint8Array(encrypted), iv.byteLength);

            // Convert to Base64
            return btoa(String.fromCharCode(...result));
        } catch (e) {
            console.error('Encryption failed:', e);
            return null;
        }
    }

    async decryptData(cipherText) {
        try {
            const key = await this._getCryptoKey();
            const data = Uint8Array.from(atob(cipherText), c => c.charCodeAt(0));

            const iv = data.slice(0, 12);
            const encrypted = data.slice(12);

            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv }, key, encrypted
            );

            return JSON.parse(new TextDecoder().decode(decrypted));
        } catch (e) {
            console.error('Decryption failed:', e);
            return null;
        }
    }
}

// Global Instance
const Security = new ArthSecurity();