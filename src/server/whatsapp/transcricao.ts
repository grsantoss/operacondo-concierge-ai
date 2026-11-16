/**
 * Transcrição de áudio do WhatsApp por API externa, escolhida por variável de ambiente:
 *   TRANSCRICAO_PROVEDOR = openai | deepgram  (vazio = sem transcrição; o áudio fica guardado)
 *   TRANSCRICAO_API_KEY, TRANSCRICAO_MODELO (opcional), TRANSCRICAO_URL (opcional, para teste)
 * ponytail: formatos conferidos na documentação, não contra as APIs reais; validar no teste final.
 */
export function transcricaoConfigurada(): boolean {
  return !!process.env.TRANSCRICAO_PROVEDOR && !!process.env.TRANSCRICAO_API_KEY;
}

export async function transcrever(
  audio: Uint8Array<ArrayBuffer>,
  mime: string,
): Promise<string | null> {
  const provedor = process.env.TRANSCRICAO_PROVEDOR;
  const chave = process.env.TRANSCRICAO_API_KEY;
  if (!provedor || !chave) return null;
  const modelo = process.env.TRANSCRICAO_MODELO;
  const sinal = AbortSignal.timeout(120_000);

  if (provedor === "openai") {
    const form = new FormData();
    form.append(
      "file",
      new Blob([audio], { type: mime }),
      `audio.${mime.includes("mpeg") ? "mp3" : "ogg"}`,
    );
    form.append("model", modelo ?? "whisper-1");
    form.append("language", "pt");
    const r = await fetch(
      `${process.env.TRANSCRICAO_URL ?? "https://api.openai.com/v1"}/audio/transcriptions`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${chave}` },
        body: form,
        signal: sinal,
      },
    );
    if (!r.ok) throw new Error(`Transcrição (openai) respondeu ${r.status}.`);
    return ((await r.json()) as { text?: string }).text?.trim() || null;
  }

  if (provedor === "deepgram") {
    const q = new URLSearchParams({
      model: modelo ?? "nova-2",
      language: "pt-BR",
      smart_format: "true",
    });
    const r = await fetch(
      `${process.env.TRANSCRICAO_URL ?? "https://api.deepgram.com/v1"}/listen?${q}`,
      {
        method: "POST",
        headers: { Authorization: `Token ${chave}`, "Content-Type": mime },
        body: audio,
        signal: sinal,
      },
    );
    if (!r.ok) throw new Error(`Transcrição (deepgram) respondeu ${r.status}.`);
    const j = (await r.json()) as {
      results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
    };
    return j.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || null;
  }

  throw new Error(`TRANSCRICAO_PROVEDOR desconhecido: ${provedor} (use openai ou deepgram).`);
}
