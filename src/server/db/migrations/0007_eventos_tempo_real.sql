-- Tempo real: avisa (NOTIFY "eventos") quando uma conversa muda, chega/sai mensagem ou muda uma
-- demanda ligada a conversa. Só ids, nunca o conteúdo (LGPD). Entregue no commit.
CREATE FUNCTION notificar_evento() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  PERFORM pg_notify('eventos', json_build_object(
    'tenant', NEW.tenant_id,
    'tabela', TG_TABLE_NAME,
    'conversa', to_jsonb(NEW) ->> TG_ARGV[0]
  )::text);
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER conversas_evento AFTER INSERT OR UPDATE ON conversas
  FOR EACH ROW EXECUTE FUNCTION notificar_evento('id');
--> statement-breakpoint
CREATE TRIGGER mensagens_evento AFTER INSERT ON mensagens
  FOR EACH ROW EXECUTE FUNCTION notificar_evento('conversa_id');
--> statement-breakpoint
CREATE TRIGGER demandas_evento AFTER INSERT OR UPDATE ON demandas
  FOR EACH ROW EXECUTE FUNCTION notificar_evento('conversa_id');
