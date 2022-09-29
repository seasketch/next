--! Previous: sha1:881c20d63c5db55f950b11e6950518f343c33491
--! Hash: sha1:ac0d81a214bb555fa312646e96d225a6dc56f0a8

-- Enter migration here
DROP POLICY if exists offline_tile_packages_user on public.offline_tile_packages;
CREATE POLICY offline_tile_packages_user ON public.offline_tile_packages FOR SELECT USING ('seasketch_user' = current_setting('role', true));
