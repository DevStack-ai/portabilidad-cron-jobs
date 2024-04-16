import { createHmac } from 'crypto';

export function authHMAC(str: string){

    if(!process.env.CONTRACT_API_SECRET) throw new Error('CONTRACT_API_SECRET is not defined');
    const hmac = createHmac('sha256', process.env.CONTRACT_API_SECRET).update(str).digest('hex');

    return hmac;
}