-- Optional public host (DDNS hostname or public IP) for port-forwarded remote access.
ALTER TABLE devices ADD COLUMN public_host TEXT;
