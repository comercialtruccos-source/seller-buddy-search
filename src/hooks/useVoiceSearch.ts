import { useState, useEffect, useCallback, useRef } from "react";

interface UseVoiceSearchOptions {
  onResult?: (transcript: string) => void;
  lang?: string;
}

export function useVoiceSearch(options: UseVoiceSearchOptions = {}) {
  const { onResult, lang = "es-CO" } = options;
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const onResultRef = useRef(onResult);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const handleError = useCallback((event: any) => {
    setIsListening(false);
    // Ignore benign abort errors (triggered when stopping or restarting recognition)
    if (event.error === "aborted") {
      return;
    }
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      setError("Permiso de micrófono denegado.");
    } else if (event.error === "no-speech") {
      // Optional: silent or subtle notification
      setError("No se detectó voz.");
    } else {
      setError(`Error de voz: ${event.error}`);
    }
  }, []);

  const createRecognition = useCallback(() => {
    if (typeof window === "undefined") return null;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let currentTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }

      setTranscript(currentTranscript);
      if (onResultRef.current) {
        onResultRef.current(currentTranscript);
      }
    };

    recognition.onerror = handleError;

    recognition.onend = () => {
      setIsListening(false);
    };

    return recognition;
  }, [lang, handleError]);

  useEffect(() => {
    const recognition = createRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, [createRecognition]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      recognitionRef.current = createRecognition();
    }

    if (!recognitionRef.current) {
      setIsSupported(false);
      setError("La búsqueda por voz no es compatible con este navegador.");
      return;
    }

    try {
      setTranscript("");
      setError(null);
      recognitionRef.current.start();
    } catch (err: any) {
      if (err?.name === "InvalidStateError") {
        try {
          recognitionRef.current.abort();
          setTimeout(() => {
            try {
              recognitionRef.current?.start();
            } catch (e) {
              console.error(e);
            }
          }, 100);
        } catch (e) {
          console.error(e);
        }
      } else {
        console.error("Error starting speech recognition:", err);
      }
    }
  }, [createRecognition]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error("Error stopping speech recognition:", err);
      }
    }
  }, [isListening]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    isSupported,
    transcript,
    error,
    startListening,
    stopListening,
    toggleListening,
  };
}
