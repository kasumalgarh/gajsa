/* FILENAME: security_utils.js
   PURPOSE: Arth Book Security Core (Native Crypto)
   FEATURES: Device Locking, SHA-256 Hashing, License Validation
   DEPENDENCIES: None (Uses Native Browser API)
*/

class ArthSecurity {
    constructor() {
        this.storageKey = "arth_book_license";
        this.machineKey = "arth_device_id";
    }

    // --- 1. PASSWORD HASHING (SHA-256) ---
    // Converts "123" -> "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3"
    async hashPassword(plainText) {
        const msgBuffer = new TextEncoder().encode(plainText);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    // --- 2. DEVICE FINGERPRINTING (The Lock) ---
    // Generates a unique ID based on hardware traits
    async getMachineID() {
        let storedID = localStorage.getItem(this.machineKey);
        if (storedID) return storedID;

        // Collect Hardware Traits
        const traits = [
            navigator.userAgent,
            navigator.language,
            screen.colorDepth,
            screen.width + 'x' + screen.height,
            navigator.hardwareConcurrency || '2', // CPU Cores
            new Date().getTimezoneOffset()
        ].join('||');

        // Hash the traits to create a short ID
        const hash = await this.hashPassword(traits);
        const shortID = `DEV-${hash.substring(0, 12).toUpperCase()}`;
        
        // Lock it to this browser
        localStorage.setItem(this.machineKey, shortID);
        return shortID;
    }

    // --- 3. LICENSE MANAGEMENT ---
    
    // Checks if the software is activated
    isActivated() {
        const license = localStorage.getItem(this.storageKey);
        // In real world, verify signature. Here checking existence for simple lock.
        return !!license; 
    }

    // Call this when user enters the key you gave them
    async activateLicense(key) {
        const machineID = await this.getMachineID();
        // Simple logic: Key must contain the MachineID reversed or specific pattern
        // FOR PROD: You would generate this key using your own separate "KeyGen" tool
        // Here, we simulate a valid key check
        
        if (key && key.length > 5) {
            localStorage.setItem(this.storageKey, key);
            return true;
        }
        return false;
    }

    // --- 4. DATA ENCRYPTION HOOK (For Ghost Mode) ---
    // Simple XOR cipher for local data (Fast & Offline)
    encryptData(data) {
        const str = JSON.stringify(data);
        let result = '';
        for (let i = 0; i < str.length; i++) {
            result += String.fromCharCode(str.charCodeAt(i) ^ 123); // Simple XOR Key
        }
        return btoa(result); // Base64 Encode
    }

    decryptData(cipherText) {
        try {
            const str = atob(cipherText);
            let result = '';
            for (let i = 0; i < str.length; i++) {
                result += String.fromCharCode(str.charCodeAt(i) ^ 123);
            }
            return JSON.parse(result);
        } catch (e) {
            console.error("Decryption Failed", e);
            return null;
        }
    }
}

// Global Instance
const Security = new ArthSecurity();