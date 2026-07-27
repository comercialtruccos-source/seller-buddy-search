import React, { useEffect } from "react";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { useVoiceSearch } from "../hooks/useVoiceSearch";

interface VoiceSearchButtonProps {
  onSearchResult: (query: string) => void;
  className?: string;
}

export const VoiceSearchButton: React.FC<VoiceSearchButtonProps> = ({
  onSearchResult,
  className = "",
}) => {
  const {
    isListening,
    isSupported,
    error,
    toggleListening,
  } = useVoiceSearch({
    onResult: (text) => {
      if (text) {
        onSearchResult(text);
      }
    },
  });

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isSupported) {
      toast.error("La búsqueda por voz no es compatible con este navegador.");
      return;
    }

    toggleListening();
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={!isSupported}
        title={
          !isSupported
            ? "Búsqueda por voz no disponible en este navegador"
            : isListening
            ? "Escuchando... Haz clic para detener"
            : "Buscar por voz"
        }
        aria-label={
          isListening
            ? "Detener búsqueda por voz"
            : "Iniciar búsqueda por voz"
        }
        className={`relative flex items-center justify-center rounded-xl p-2.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/40 ${
          !isSupported
            ? "cursor-not-allowed opacity-40 text-muted-foreground"
            : isListening
            ? "bg-red-500/10 text-red-500 shadow-md ring-2 ring-red-500/50 dark:bg-red-500/20"
            : "text-muted-foreground hover:bg-accent/10 hover:text-foreground active:scale-95"
        }`}
      >
        {/* Pulsing ring animation when listening */}
        {isListening && (
          <span className="absolute inset-0 rounded-xl bg-red-500/30 animate-ping opacity-75 pointer-events-none" />
        )}

        {!isSupported ? (
          <MicOff className="h-5 w-5" />
        ) : (
          <Mic className={`h-5 w-5 ${isListening ? "animate-pulse" : ""}`} />
        )}
      </button>

      {/* Floating status label when active */}
      {isListening && (
        <div className="absolute right-full mr-2 hidden sm:flex items-center gap-1.5 rounded-lg bg-red-500/90 px-2.5 py-1 text-xs font-medium text-white shadow-md backdrop-blur-sm animate-fade-in pointer-events-none whitespace-nowrap">
          <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
          Escuchando...
        </div>
      )}
    </div>
  );
};
