// Browser-only demonstration. This is not a security or account-access boundary.
const PROFILES_KEY = 'confety-demo-profiles-v1';
const SESSION_KEY = 'confety-demo-session-v1';
const iterations = 120000;
const hex = bytes => Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');

export function createDemoAuth({local, session, crypto}) {
  function profiles() {
    try {
      const records = JSON.parse(local.getItem(PROFILES_KEY) || '[]');
      if (!Array.isArray(records) || records.some(p => !p || !['id','name','email','salt','hash'].every(key => typeof p[key] === 'string') || !/^[a-f0-9]{32}$/.test(p.salt) || !/^[a-f0-9]{64}$/.test(p.hash))) throw new Error();
      return records;
    } catch { throw new Error('Demo profiles could not be read. Allow browser storage and try again.'); }
  }
  const publicProfile = ({id,name,email}) => ({id,name,email});
  async function hash(password, salt) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bytes = Uint8Array.from(salt.match(/../g), pair => parseInt(pair,16));
    return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:bytes,iterations,hash:'SHA-256'},key,256)));
  }
  function start(profile) {
    try { session.setItem(SESSION_KEY,profile.id); }
    catch { throw new Error('Allow session storage to sign in to this demo.'); }
    return publicProfile(profile);
  }
  return {
    currentUser() {
      try { const id=session.getItem(SESSION_KEY);const profile=profiles().find(p=>p.id===id);return profile?publicProfile(profile):null; }
      catch { return null; }
    },
    async register({name,email,password}) {
      name=name.trim();email=email.trim().toLowerCase();
      if(!name || name.length>80)throw new Error('Enter a name between 1 and 80 characters.');
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>150)throw new Error('Enter a valid demo email address.');
      if(password.length<8||password.length>128)throw new Error('Use a demo password between 8 and 128 characters.');
      if(profiles().some(p=>p.email===email))throw new Error('A demo profile already uses this email. Log in instead.');
      const salt=hex(crypto.getRandomValues(new Uint8Array(16)));
      const profile={id:crypto.randomUUID(),name,email,salt,hash:await hash(password,salt)};
      // Read again after hashing so another in-tab submission cannot overwrite a profile.
      const records=profiles();
      if(records.some(p=>p.email===email))throw new Error('A demo profile already uses this email. Log in instead.');
      try{local.setItem(PROFILES_KEY,JSON.stringify([...records,profile]));}
      catch{throw new Error('Your demo profile could not be saved. Allow browser storage and try again.');}
      try{return start(profile);}catch{throw new Error('Demo profile created. Allow session storage, then log in.');}
    },
    async login({email,password}) {
      const profile=profiles().find(p=>p.email===email.trim().toLowerCase());
      if(!profile || await hash(password,profile.salt)!==profile.hash)throw new Error('Email or password doesn’t match a demo profile in this browser.');
      return start(profile);
    },
    logout(){try{session.removeItem(SESSION_KEY);}catch{throw new Error('Could not clear your demo session. Allow session storage and try again.');}}
  };
}
