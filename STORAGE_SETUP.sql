-- Rode isso no SQL Editor do Supabase antes de publicar a atualização.
-- Cria um espaço de armazenamento de arquivos (bucket) público para as fotos
-- dos produtos, banners e cores, separado do catálogo de dados.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "product_images_read" on storage.objects
  for select using (bucket_id = 'product-images');

create policy "product_images_insert" on storage.objects
  for insert with check (bucket_id = 'product-images');

create policy "product_images_update" on storage.objects
  for update using (bucket_id = 'product-images');

create policy "product_images_delete" on storage.objects
  for delete using (bucket_id = 'product-images');
