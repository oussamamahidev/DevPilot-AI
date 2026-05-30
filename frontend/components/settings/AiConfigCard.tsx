import { useMemo, useState } from "react";
import { LoadingState } from "@/components/LoadingState";
import {
  CardError,
  CardNote,
  FieldRow,
  SettingsButton,
  SettingsCard,
  StatusBadge,
} from "@/components/settings/SettingsCard";
import {
  displayValue,
  getConfigValue,
  getProviderBadgeTone,
  isMissingConfigValue,
  maskSensitiveConfig,
} from "@/components/settings/settingsUtils";

type AiConfigCardProps = {
  config: Record<string, unknown> | null;
  error: string | null;
  isLoading: boolean;
  onRefresh: () => void;
};

function ProviderBadge({ provider }: { provider: unknown }) {
  return (
    <span className="inline-flex items-center gap-2">
      <StatusBadge tone={getProviderBadgeTone(provider)}>
        {displayValue(provider)}
      </StatusBadge>
    </span>
  );
}

export function AiConfigCard({
  config,
  error,
  isLoading,
  onRefresh,
}: AiConfigCardProps) {
  const [showRawConfig, setShowRawConfig] = useState(false);

  const warnings = useMemo(() => {
    if (!config) {
      return [];
    }

    const nextWarnings: string[] = [];
    const llmProvider = getConfigValue(config, "llm_provider");
    const embeddingProvider = getConfigValue(config, "embedding_provider");
    const generationModel = getConfigValue(config, "generation_model");
    const embeddingModel = getConfigValue(config, "embedding_model");
    const enableReranking = getConfigValue(config, "enable_reranking");

    if (
      typeof llmProvider === "string" &&
      llmProvider.toLowerCase() === "gemini" &&
      isMissingConfigValue(generationModel)
    ) {
      nextWarnings.push("Gemini generation is selected, but no generation model is configured.");
    }

    if (
      typeof embeddingProvider === "string" &&
      embeddingProvider.toLowerCase() === "ollama" &&
      isMissingConfigValue(embeddingModel)
    ) {
      nextWarnings.push("Ollama embeddings are selected, but no embedding model is configured.");
    }

    if (enableReranking === false) {
      nextWarnings.push("Reranking is disabled.");
    }

    return nextWarnings;
  }, [config]);

  const rawSafeConfig = useMemo(() => {
    if (!config) {
      return null;
    }

    return JSON.stringify(maskSensitiveConfig(config), null, 2);
  }, [config]);

  return (
    <SettingsCard
      title="AI Configuration"
      action={
        <SettingsButton type="button" disabled={isLoading} onClick={onRefresh}>
          {isLoading ? "Refreshing..." : "Refresh AI Config"}
        </SettingsButton>
      }
    >
      <div className="grid gap-4">
        {isLoading && !config ? <LoadingState label="Loading AI config" /> : null}
        {error ? <CardError message={error} /> : null}

        {config ? (
          <>
            <CardNote>Embeddings are handled separately from generation.</CardNote>

            {warnings.length > 0 ? (
              <div className="grid gap-2">
                {warnings.map((warning) => (
                  <div
                    key={warning}
                    className="rounded-md border border-warning-line bg-warning-subtle px-4 py-3 text-sm text-warning-surface-fg"
                  >
                    {warning}
                  </div>
                ))}
              </div>
            ) : null}

            <dl>
              <FieldRow
                label="Generation provider"
                value={<ProviderBadge provider={getConfigValue(config, "llm_provider")} />}
              />
              <FieldRow
                label="Embedding provider"
                value={
                  <ProviderBadge provider={getConfigValue(config, "embedding_provider")} />
                }
              />
              <FieldRow
                label="Generation model"
                value={displayValue(getConfigValue(config, "generation_model"))}
              />
              <FieldRow
                label="Embedding model"
                value={displayValue(getConfigValue(config, "embedding_model"))}
              />
              <FieldRow
                label="Temperature"
                value={displayValue(getConfigValue(config, "generation_temperature"))}
              />
              <FieldRow
                label="Max tokens"
                value={displayValue(getConfigValue(config, "generation_max_tokens"))}
              />
              <FieldRow
                label="Reranking enabled"
                value={displayValue(getConfigValue(config, "enable_reranking"))}
              />
              <FieldRow
                label="Retrieval candidates"
                value={displayValue(getConfigValue(config, "retrieval_candidates"))}
              />
              <FieldRow
                label="Rerank top K"
                value={displayValue(getConfigValue(config, "rerank_top_k"))}
              />
              {!isMissingConfigValue(getConfigValue(config, "ollama_base_url")) ? (
                <FieldRow
                  label="Ollama base URL"
                  value={displayValue(getConfigValue(config, "ollama_base_url"))}
                />
              ) : null}
              {!isMissingConfigValue(getConfigValue(config, "rag_top_k")) ? (
                <FieldRow
                  label="RAG top K"
                  value={displayValue(getConfigValue(config, "rag_top_k"))}
                />
              ) : null}
              {!isMissingConfigValue(getConfigValue(config, "rag_max_context_chars")) ? (
                <FieldRow
                  label="RAG max context"
                  value={displayValue(getConfigValue(config, "rag_max_context_chars"))}
                />
              ) : null}
            </dl>

            {rawSafeConfig ? (
              <div className="border-t border-line-subtle pt-4">
                <button
                  type="button"
                  onClick={() => setShowRawConfig((current) => !current)}
                  className="text-sm font-medium text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                  {showRawConfig ? "Hide raw safe config" : "Show raw safe config"}
                </button>
                {showRawConfig ? (
                  <pre className="mt-3 max-h-72 overflow-auto rounded-md border border-line bg-sunken p-4 text-xs leading-5 text-fg">
                    {rawSafeConfig}
                  </pre>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}

        {!isLoading && !config && !error ? (
          <p className="text-sm text-fg-muted">Not available</p>
        ) : null}
      </div>
    </SettingsCard>
  );
}
