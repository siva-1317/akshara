import "./env.js";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const createMissingSupabaseClient = () =>
  new Proxy(
    {},
    {
      get() {
        return () => {
          throw new Error(
            "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env."
          );
        };
      }
    }
  );

export const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false
        }
      })
    : createMissingSupabaseClient();

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "Supabase environment variables are missing. API routes that use Supabase will fail until server/.env is configured."
  );
}
