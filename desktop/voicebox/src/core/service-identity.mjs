export const businessKey=name=>String(name??'').normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase().replace(/\s+[-–—]\s+(?:buy|sell(?: magic items)?|repair|identify)$/i,'');
export const genericBusiness=name=>['merchant','innkeeper','repair shop','bank','the tavern'].includes(businessKey(name));
