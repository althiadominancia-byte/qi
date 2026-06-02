
CREATE POLICY "Anon upload curriculos" ON storage.objects
FOR INSERT TO anon WITH CHECK (bucket_id = 'curriculos');

CREATE POLICY "Auth upload curriculos" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'curriculos');

CREATE POLICY "Recrutadores leem curriculos" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'curriculos' AND public.is_recruiter(auth.uid()));
