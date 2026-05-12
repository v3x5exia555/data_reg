-- Set default account seat limit to 2 for new accounts (schema default already 2)
-- Fix existing accounts that were created with a higher limit
UPDATE public.accounts SET seat_limit = 2 WHERE seat_limit > 2;
