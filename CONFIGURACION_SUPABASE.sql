-- CONFIGURACIÓN DEL SISTEMA DE MÓDULOS
-- Ejecutar en Supabase SQL Editor si quieres marcar los registros BBVA existentes como Módulo 4.
UPDATE public.bbva_registros
SET sino = 'Módulo 4'
WHERE sino IS NULL OR sino = '';

-- Recomendado: índice para acelerar la separación por módulo.
CREATE INDEX IF NOT EXISTS idx_bbva_registros_sino
ON public.bbva_registros (sino);


-- POLÍTICAS DEL BUCKET PRIVADO bbva-fotos
-- Permiten que usuarios autenticados suban y consulten sus fotos.
-- Ejecutar solo si estas políticas todavía no existen.

DROP POLICY IF EXISTS "bbva_fotos_insert_auth" ON storage.objects;
CREATE POLICY "bbva_fotos_insert_auth"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'bbva-fotos');

DROP POLICY IF EXISTS "bbva_fotos_select_auth" ON storage.objects;
CREATE POLICY "bbva_fotos_select_auth"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'bbva-fotos');

DROP POLICY IF EXISTS "bbva_fotos_delete_auth" ON storage.objects;
CREATE POLICY "bbva_fotos_delete_auth"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'bbva-fotos');


-- POLÍTICA PARA INSERTAR REGISTROS
ALTER TABLE public.bbva_registros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bbva_registros_insert_auth" ON public.bbva_registros;
CREATE POLICY "bbva_registros_insert_auth"
ON public.bbva_registros FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());


-- Permitir actualizar registros propios (necesario para editar si el módulo lo usa).
DROP POLICY IF EXISTS "bbva_registros_update_auth" ON public.bbva_registros;
CREATE POLICY "bbva_registros_update_auth"
ON public.bbva_registros FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.is_admin())
WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- Permitir consultar los registros propios.
DROP POLICY IF EXISTS "bbva_registros_select_auth" ON public.bbva_registros;
CREATE POLICY "bbva_registros_select_auth"
ON public.bbva_registros FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin());


-- La papelera usa borrado lógico (eliminado=true).
-- No se elimina físicamente el registro, por eso puede restaurarse online.
