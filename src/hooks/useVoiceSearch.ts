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

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
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
      if (onResult) {
        onResult(currentTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Permiso de micrófono denegado.");
      } else if (event.error === "no-speech") {
        setError("No se escuchó ningún término.");
      } else {
        setError(`Error de voz: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Clean up silently
        }
      }
    };
  }, [lang, onResult]);

  const startListening = useCallback(() => {
    const SpeechRecognition =
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

    if (!SpeechRecognition) {
      setIsSupported(false);
      setError("La búsqueda por voz no es compatible con este navegador.");
      return;
    }

    if (!recognitionRef.current) {
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
        if (onResult) {
          onResult(currentTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setError("Permiso de micrófono denegado.");
        } else if (event.error === "no-speech") {
          setError("No se escuchó ningún término.");
        } else {
          setError(`Error de voz: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    try {
      setTranscript("");
      setError(null);
      recognitionRef.current.start();
    } catch (err: any) {
      if (err?.name === "InvalidStateError") {
        try {
          recognitionRef.current.stop();
          setTimeout(() => {
            try {
              recognitionRef.current.start();
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
  }, [lang, onResult]);

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
