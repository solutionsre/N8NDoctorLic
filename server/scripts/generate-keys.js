// Prints the public key your LICENSE_PRIVATE_KEY_HEX produces. It must equal
// PUBLIC_KEY_HEX in n8n Doctor's app/backend/license/public_key.py.
import 'dotenv/config';
import { publicKeyHex } from '../src/lib/signing.js';
console.log('Public key:', publicKeyHex());
