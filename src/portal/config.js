// El proyecto de Supabase del portal (SchwarckDevWeb). Son datos públicos: la clave
// publicable solo deja hacer lo que permiten las reglas (RLS) de la base. Lo secreto
// vive en Supabase (Vault y la función `portal`), nunca aquí.
export const SUPABASE_URL = 'https://zblcnysojrogwbflived.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_hxX91IjQd5CsKYN4rkf31w_QICMqcC0';
export const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/portal`;
export const BUCKET = 'portal';
