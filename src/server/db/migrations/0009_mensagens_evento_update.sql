-- Mídia guardada ou áudio transcrito (UPDATE em mensagens) também avisa a tela em tempo real.
CREATE TRIGGER mensagens_evento_update AFTER UPDATE ON mensagens
  FOR EACH ROW EXECUTE FUNCTION notificar_evento('conversa_id');
