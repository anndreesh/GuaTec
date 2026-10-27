import { STORAGE_KEYS } from "@/config/gameConfig";

// A browser may deny reads entirely or allow reads while rejecting writes.
// Keep the current session usable in either case; nothing is persisted elsewhere.
const memory = new Map<string,string|null>();
const volatile = new Set<string>();
function read(key:string):string|null {
  if(volatile.has(key))return memory.get(key)??null;
  try { const value=localStorage.getItem(key);memory.set(key,value);return value; }
  catch { return memory.get(key)??null; }
}
function write(key:string,value:string|null):void {
  memory.set(key,value);
  try {
    if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);
    volatile.delete(key);
  }catch{volatile.add(key);}
}
if(typeof window!=='undefined')window.addEventListener('storage',event=>{
  if(event.key===null){memory.clear();volatile.clear();}
  else{memory.delete(event.key);volatile.delete(event.key);}
});

/** Persistent account preferences, with an in-memory session if storage is denied. */
export const AuthStore = {
  getToken(): string | null {
    return read(STORAGE_KEYS.authToken);
  },
  setToken(token: string): void {
    write(STORAGE_KEYS.authToken, token);
  },
  clearToken(): void {
    write(STORAGE_KEYS.authToken,null);
  },
  getCachedUsername(): string | null {
    return read(STORAGE_KEYS.username);
  },
  setCachedUsername(username: string): void {
    write(STORAGE_KEYS.username, username);
  },
  getPendingOAuthEmail(): string | null {
    return read("mm.pendingOAuthEmail");
  },
  setPendingOAuthEmail(email: string): void {
    write("mm.pendingOAuthEmail", email);
  },
  clearPendingOAuthEmail(): void {
    write("mm.pendingOAuthEmail",null);
  },
};
